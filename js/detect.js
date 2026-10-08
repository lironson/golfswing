// Turns raw per-frame pose landmarks into smoothed pixel tracks, then locates
// the 10 P-positions from body motion alone (no club tracking).
//
// Everything here is DOM-free so it can be unit-tested in Node.

import { CONFIG, LM, sides } from './positions.js';
import { mid, dist, smooth, argMax, argMin, clamp } from './geometry.js';

const N_LANDMARKS = 33;

/**
 * @param {Array<{t:number, lm:Array<{x:number,y:number,visibility?:number}>|null}>} raw
 *        Normalised landmarks per sampled frame (null when no pose was found).
 * @returns {Array<Array<{x:number,y:number,v:number}>>} pixel-space, gap-filled, smoothed landmarks.
 */
export function prepareFrames(raw, width, height, window = CONFIG.smoothingWindow) {
  const n = raw.length;
  const valid = raw.map((f) => !!(f && f.lm && f.lm.length >= N_LANDMARKS));
  if (!valid.some(Boolean)) throw new Error('No person was detected in this video.');

  const out = Array.from({ length: n }, () => new Array(N_LANDMARKS));
  for (let k = 0; k < N_LANDMARKS; k++) {
    const xs = new Array(n), ys = new Array(n), vs = new Array(n);
    for (let i = 0; i < n; i++) {
      if (valid[i]) {
        const p = raw[i].lm[k];
        xs[i] = p.x * width; ys[i] = p.y * height; vs[i] = p.visibility ?? 1;
      }
    }
    fillGaps(xs, valid); fillGaps(ys, valid); fillGaps(vs, valid);
    const sx = smooth(xs, window), sy = smooth(ys, window);
    for (let i = 0; i < n; i++) out[i][k] = { x: sx[i], y: sy[i], v: valid[i] ? vs[i] : 0 };
  }
  return out;
}

// Linear interpolation over missing samples; edges copy the nearest valid sample.
function fillGaps(arr, valid) {
  const n = arr.length;
  let prev = -1;
  for (let i = 0; i < n; i++) {
    if (!valid[i]) continue;
    if (prev === -1) for (let j = 0; j < i; j++) arr[j] = arr[i];
    else for (let j = prev + 1; j < i; j++) arr[j] = arr[prev] + ((arr[i] - arr[prev]) * (j - prev)) / (i - prev);
    prev = i;
  }
  for (let j = prev + 1; j < n; j++) arr[j] = arr[prev];
}

export function torsoLength(frame) {
  return dist(mid(frame[LM.lShoulder], frame[LM.rShoulder]), mid(frame[LM.lHip], frame[LM.rHip]));
}

export const handsOf = (frame) => mid(frame[LM.lWrist], frame[LM.rWrist]);
export const hipMidOf = (frame) => mid(frame[LM.lHip], frame[LM.rHip]);
export const shoulderMidOf = (frame) => mid(frame[LM.lShoulder], frame[LM.rShoulder]);

function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/**
 * Per-frame motion signals, normalised by torso length so they are independent of
 * video resolution and how far the camera is from the golfer.
 */
export function computeSignals(pts, times, handedness) {
  const S = sides(handedness);
  const torso = median(pts.map(torsoLength)) || 1;
  const n = pts.length;
  const H = new Array(n), lead = new Array(n), trail = new Array(n), speed = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const f = pts[i];
    const hipY = hipMidOf(f).y;
    H[i] = (hipY - handsOf(f).y) / torso; // hand height above the hip line
    lead[i] = (hipY - f[S.shoulder[0]].y) / torso; // lead shoulder height above the hip line
    trail[i] = (hipY - f[S.shoulder[1]].y) / torso;
    if (i > 0) {
      const dt = Math.max(1e-3, times[i] - times[i - 1]);
      speed[i] = dist(handsOf(f), handsOf(pts[i - 1])) / torso / dt;
    }
  }
  speed[0] = speed[1] ?? 0;
  return { torso, H: smooth(H, 3), lead, trail, speed: smooth(speed, 3) };
}

function firstIndex(from, to, pred) {
  for (let i = Math.max(0, from); i <= to; i++) if (pred(i)) return i;
  return -1;
}

/**
 * Locate P1–P10. Returns frame indices in swing order plus the signals used.
 *
 * Strategy: the top (P4) and impact (P7) are the most reliable landmarks, so find
 * those first, then search the windows either side of them for the rest.
 */
export function detectPositions(pts, times, handedness = 'right') {
  const n = pts.length;
  if (n < 10) throw new Error('The clip is too short — need at least 10 analysed frames.');
  const sig = computeSignals(pts, times, handedness);
  const { H, lead, trail, speed } = sig;
  const cfg = CONFIG.detect;

  // Fastest hand speed happens late in the downswing; the top is the highest-hands frame before it.
  const peak = argMax(speed);
  const peakSpeed = speed[peak] || 1;
  let p4 = argMax(H, 0, Math.max(0, peak - 1));
  if (p4 >= n - 4) p4 = argMax(H, 0, n - 4);

  // Address: scan back from the fastest backswing frame until the hands are still.
  const bsPeak = p4 > 0 ? argMax(speed, 0, p4) : 0;
  const bsThresh = Math.max(speed[bsPeak] * 0.06, peakSpeed * 0.02);
  let p1 = 0;
  for (let i = bsPeak; i >= 0; i--) if (speed[i] < bsThresh) { p1 = i; break; }
  if (p1 >= p4) p1 = 0;

  const H1 = H[p1];

  // P3: hands rise to lead-shoulder height (lead arm parallel to the ground).
  let p3 = -1;
  for (let i = p4; i > p1; i--) if (H[i] < lead[i]) { p3 = i + 1; break; }
  if (p3 < 0 || p3 > p4) p3 = firstIndex(p1 + 1, p4, (i) => H[i] >= H1 + 0.75 * (H[p4] - H1));
  if (p3 < 0) p3 = Math.round(p1 + 0.7 * (p4 - p1));

  // "Shaft parallel" height: a set fraction between address and lead-arm-parallel hand height.
  const Hp = H1 + cfg.shaftParallelFraction * (H[p3] - H1);

  let p2 = firstIndex(p1 + 1, p3, (i) => H[i] >= Hp);
  if (p2 < 0) p2 = Math.round((p1 + p3) / 2);

  // Impact: the lowest point of the hands in the downswing (before they rise back past shaft-parallel).
  let wentLow = false, end = n - 1;
  for (let i = p4 + 1; i < n; i++) {
    if (H[i] <= Hp) wentLow = true;
    else if (wentLow) { end = i; break; }
  }
  const p7 = argMin(H, Math.min(n - 1, p4 + 1), end);

  let p5 = firstIndex(p4 + 1, p7 - 1, (i) => H[i] <= lead[i]);
  if (p5 < 0) p5 = Math.round(p4 + 0.55 * (p7 - p4));

  let p6 = firstIndex(p5 + 1, p7 - 1, (i) => H[i] <= Hp);
  if (p6 < 0) p6 = Math.round((p5 + p7) / 2);

  let p8 = firstIndex(p7 + 1, n - 1, (i) => H[i] >= Hp);
  if (p8 < 0) p8 = Math.min(n - 1, p7 + Math.max(1, p7 - p6));

  let p9 = firstIndex(p8 + 1, n - 1, (i) => H[i] >= trail[i]);
  if (p9 < 0) p9 = firstIndex(p8 + 1, n - 1, (i) => H[i] >= H[p3]);
  if (p9 < 0) p9 = Math.min(n - 1, p8 + Math.max(1, p8 - p7));

  // Finish: first moment after P9 where the hands settle and stay settled briefly.
  const holdFrames = Math.max(2, Math.round(0.12 / avgDt(times)));
  const stillThresh = peakSpeed * cfg.stillSpeedFraction;
  let p10 = -1;
  for (let i = p9 + 1; i < n; i++) {
    let ok = true;
    for (let j = i; j < Math.min(n, i + holdFrames); j++) if (speed[j] >= stillThresh) { ok = false; break; }
    if (ok) { p10 = i; break; }
  }
  if (p10 < 0) p10 = argMax(H, Math.min(n - 1, p9), n - 1);

  const indices = enforceOrder([p1, p2, p3, p4, p5, p6, p7, p8, p9, p10], n);
  return { indices, signals: { ...sig, Hp, peak } };
}

function avgDt(times) {
  if (times.length < 2) return 1 / 30;
  return (times[times.length - 1] - times[0]) / (times.length - 1) || 1 / 30;
}

// Make the sequence strictly increasing where the clip length allows it.
export function enforceOrder(idx, n) {
  const out = idx.map((v) => clamp(Math.round(v), 0, n - 1));
  for (let i = 1; i < out.length; i++) if (out[i] <= out[i - 1]) out[i] = Math.min(n - 1, out[i - 1] + 1);
  for (let i = out.length - 2; i >= 0; i--) if (out[i] >= out[i + 1]) out[i] = Math.max(0, out[i + 1] - 1);
  return out;
}

/** Guess the camera angle from how wide the shoulders look relative to the torso at address. */
export function guessView(pts, p1) {
  const torso = torsoLength(pts[p1]) || 1;
  let sum = 0, cnt = 0;
  for (let i = Math.max(0, p1 - 3); i <= Math.min(pts.length - 1, p1 + 3); i++) {
    sum += Math.abs(pts[i][LM.lShoulder].x - pts[i][LM.rShoulder].x) / torso; cnt++;
  }
  const ratio = sum / cnt;
  return { view: ratio < CONFIG.detect.dtlShoulderRatio ? 'dtl' : 'face', ratio };
}

/**
 * Directions needed to interpret motion:
 *  - targetDir (face-on): +1 if the target is toward image-right, -1 if image-left.
 *  - facingDir (down-the-line): +1 if the golfer faces image-right (toward the ball), else -1.
 */
export function orientation(pts, p1, handedness) {
  const S = sides(handedness);
  const f = pts[p1];
  const leadSide = (f[S.shoulder[0]].x - f[S.shoulder[1]].x) + (f[S.hip[0]].x - f[S.hip[1]].x);
  const facing = handsOf(f).x - hipMidOf(f).x;
  return {
    torso: torsoLength(f) || 1,
    targetDir: leadSide >= 0 ? 1 : -1,
    facingDir: facing >= 0 ? 1 : -1,
  };
}
