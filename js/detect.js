// Turns raw per-frame pose landmarks into smoothed pixel tracks, then locates
// the 10 P-positions from body motion alone (no club tracking).
//
// Everything here is DOM-free so it can be unit-tested in Node.

import { CONFIG, LM, sides } from './positions.js';
import { mid, dist, smooth, argMax, argMin, clamp, percentile } from './geometry.js';

const N_LANDMARKS = 33;
// Hand-track landmarks: blurred and often mislabelled during the fast part of the swing.
const HAND_LANDMARKS = [LM.lElbow, LM.rElbow, LM.lWrist, LM.rWrist];

/**
 * @param {Array<{t:number, lm:Array<{x:number,y:number,visibility?:number}>|null}>} raw
 *        Normalised landmarks per sampled frame (null when no pose was found).
 * @param {number} [window] smoothing window in frames; by default about CONFIG.smoothingSeconds.
 * @returns {Array<Array<{x:number,y:number,v:number}>>} pixel-space, gap-filled, smoothed landmarks.
 */
export function prepareFrames(raw, width, height, window = defaultWindow(raw)) {
  const n = raw.length;
  const valid = raw.map((f, i) => !!(f && f.lm && f.lm.length >= N_LANDMARKS) && !sameAsPrevious(raw, i));
  if (!valid.some(Boolean)) throw new Error('No person was detected in this video.');

  const torso = median(raw.filter((_, i) => valid[i]).map((f) => torsoLength(toPixels(f.lm, width, height)))) || 1;
  const tracks = [];
  for (let k = 0; k < N_LANDMARKS; k++) {
    const xs = new Array(n), ys = new Array(n), vs = new Array(n);
    const ok = valid.slice();
    for (let i = 0; i < n; i++) {
      if (!ok[i]) continue;
      const p = raw[i].lm[k];
      xs[i] = p.x * width; ys[i] = p.y * height; vs[i] = p.visibility ?? 1;
    }
    if (HAND_LANDMARKS.includes(k)) cleanHandTrack(xs, ys, vs, ok, torso);
    tracks.push({ xs, ys, vs, ok });
  }

  // The wrists are together on the grip, so a hidden wrist (the lead one, down the line)
  // is better placed on the visible one than filled in from frames far away.
  const [a, b] = [tracks[LM.lWrist], tracks[LM.rWrist]];
  for (let i = 0; i < n; i++) {
    const [from, to] = a.ok[i] && !b.ok[i] ? [a, b] : b.ok[i] && !a.ok[i] ? [b, a] : [null, null];
    if (!from) continue;
    to.xs[i] = from.xs[i]; to.ys[i] = from.ys[i]; to.vs[i] = from.vs[i]; to.ok[i] = true;
  }

  const out = Array.from({ length: n }, () => new Array(N_LANDMARKS));
  tracks.forEach(({ xs, ys, vs, ok }, k) => {
    if (!ok.some(Boolean)) ok.splice(0, n, ...valid); // never lose a landmark entirely
    fillGaps(xs, ok); fillGaps(ys, ok); fillGaps(vs, ok);
    const sx = smooth(xs, window), sy = smooth(ys, window);
    for (let i = 0; i < n; i++) out[i][k] = { x: sx[i], y: sy[i], v: ok[i] ? vs[i] : 0 };
  });
  return out;
}

// About CONFIG.smoothingSeconds worth of frames, always odd, 1–7.
function defaultWindow(raw) {
  const span = raw.length > 1 ? raw[raw.length - 1].t - raw[0].t : 0;
  const fps = span > 0 ? (raw.length - 1) / span : 30;
  return clamp(Math.round(fps * CONFIG.smoothingSeconds / 2) * 2 + 1, 1, 7);
}

// A repeated frame (imprecise seeking returns the same image twice) carries no new motion.
function sameAsPrevious(raw, i) {
  const a = raw[i] && raw[i].lm, b = i > 0 && raw[i - 1] && raw[i - 1].lm;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((p, k) => p.x === b[k].x && p.y === b[k].y);
}

/**
 * Drop low-visibility hand samples, then glitches: samples far from the median of their
 * neighbours (a Hampel filter). The median ignores a one- or two-frame jump but follows
 * genuinely fast hand motion, which stays smooth from frame to frame.
 */
function cleanHandTrack(xs, ys, vs, ok, torso) {
  const n = xs.length;
  for (let i = 0; i < n; i++) if (ok[i] && vs[i] < CONFIG.detect.handVisibility) ok[i] = false;
  const limit = CONFIG.detect.maxJumpTorso * torso;
  // Repeat: once the worst glitch is gone, a neighbouring one stands out too.
  for (let pass = 0; pass < 3; pass++) {
    const idx = [];
    for (let i = 0; i < n; i++) if (ok[i]) idx.push(i);
    const bad = [];
    for (let j = 0; j < idx.length; j++) {
      const near = idx.slice(Math.max(0, j - 2), Math.min(idx.length, j + 3));
      const mx = median(near.map((i) => xs[i])), my = median(near.map((i) => ys[i]));
      if (Math.hypot(xs[idx[j]] - mx, ys[idx[j]] - my) > limit) bad.push(idx[j]);
    }
    if (!bad.length) break;
    for (const i of bad) ok[i] = false;
  }
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
 * The swing: the run of moving-hands frames with the most hand travel. Short pauses
 * (the top, a hitch) don't split it; a waggle or walking off afterwards is a separate run.
 * @returns {[number, number]} first and last frame index
 */
function findSwing(speed, times) {
  const cfg = CONFIG.detect;
  const n = speed.length;
  const threshold = cfg.motionSpeedFraction * (percentile(speed, 0.95) || 1);
  const moving = speed.map((s) => s > threshold);
  const runs = [];
  for (let i = 0; i < n; i++) {
    if (!moving[i]) continue;
    const last = runs[runs.length - 1];
    if (last && times[i] - times[last[1]] <= cfg.mergeGapSeconds) last[1] = i;
    else runs.push([i, i]);
  }
  if (!runs.length) return [0, n - 1];
  const travel = ([a, b]) => {
    let sum = 0;
    for (let i = Math.max(1, a); i <= b; i++) sum += speed[i] * (times[i] - times[i - 1]);
    return sum;
  };
  return runs.reduce((best, r) => (travel(r) > travel(best) ? r : best));
}

/**
 * Locate P1–P10. Returns frame indices in swing order, whether each one is trustworthy,
 * and the signals used.
 *
 * Strategy: find the swing, then the anchors that body motion shows most clearly:
 * impact (P7) is the lowest point of the fast-moving hands after the backswing, and
 * the top (P4) is the highest hand position before that. The other
 * positions are found from hand height in the windows between the anchors.
 */
export function detectPositions(pts, times, handedness = 'right') {
  const n = pts.length;
  if (n < 10) throw new Error('The clip is too short — need at least 10 analysed frames.');
  const sig = computeSignals(pts, times, handedness);
  const { H, lead, trail, speed } = sig;
  const cfg = CONFIG.detect;
  const sure = new Array(10).fill(true);

  const [s0, s1] = findSwing(speed, times);
  const peak = argMax(speed, s0, s1);
  const peakSpeed = speed[peak] || 1;

  // Address: the frame just before the swing starts moving (refined below).
  const a0 = Math.max(0, s0 - 1);
  const topH = H[argMax(H, s0, s1)];

  // Impact: the lowest hands among the fast frames once the hands have been well up.
  // Fast-only rules out address and the finish; "been up" rules out the takeaway.
  let p7 = -1, highest = -Infinity;
  for (let i = s0; i <= s1; i++) {
    highest = Math.max(highest, H[i]);
    if (speed[i] < 0.35 * peakSpeed || highest - H[a0] < 0.5 * (topH - H[a0])) continue;
    if (p7 < 0 || H[i] < H[p7]) p7 = i;
  }
  if (p7 < 0) {
    p7 = argMin(H, Math.min(n - 1, argMax(H, s0, s1) + 1), s1);
    sure[6] = false;
  }

  let p4 = argMax(H, a0, Math.max(a0, p7 - 1));
  if (p4 >= p7) { p4 = Math.max(0, p7 - 1); sure[3] = false; }

  // Address: scan back from the fastest backswing frame until the hands are still.
  const bsPeak = argMax(speed, Math.min(s0, p4), p4);
  const bsThresh = Math.max(speed[bsPeak] * 0.06, peakSpeed * 0.02);
  let p1 = -1;
  for (let i = bsPeak; i >= 0; i--) if (speed[i] < bsThresh) { p1 = i; break; }
  if (p1 < 0 || p1 >= p4) { p1 = Math.min(a0, Math.max(0, p4 - 1)); sure[0] = false; }

  const H1 = H[p1];

  // P3: hands rise to lead-shoulder height (lead arm parallel to the ground).
  let p3 = -1;
  for (let i = p4; i > p1; i--) if (H[i] < lead[i]) { p3 = i + 1; break; }
  if (p3 < 0 || p3 > p4) p3 = firstIndex(p1 + 1, p4, (i) => H[i] >= H1 + 0.75 * (H[p4] - H1));
  if (p3 < 0) { p3 = Math.round(p1 + 0.7 * (p4 - p1)); sure[2] = false; }

  // "Shaft parallel" height: a set fraction between address and lead-arm-parallel hand height.
  const Hp = H1 + cfg.shaftParallelFraction * (H[p3] - H1);

  let p2 = firstIndex(p1 + 1, p3, (i) => H[i] >= Hp);
  if (p2 < 0) { p2 = Math.round((p1 + p3) / 2); sure[1] = false; }

  let p5 = firstIndex(p4 + 1, p7 - 1, (i) => H[i] <= lead[i]);
  if (p5 < 0) { p5 = Math.round(p4 + 0.55 * (p7 - p4)); sure[4] = false; }

  const Hp6 = H1 + cfg.downswingShaftParallelFraction * (H[p3] - H1);
  let p6 = firstIndex(p5 + 1, p7 - 1, (i) => H[i] <= Hp6);
  if (p6 < 0) { p6 = Math.round((p5 + p7) / 2); sure[5] = false; }

  let p8 = firstIndex(p7 + 1, n - 1, (i) => H[i] >= Hp);
  if (p8 < 0) { p8 = Math.min(n - 1, p7 + Math.max(1, p7 - p6)); sure[7] = false; }

  let p9 = firstIndex(p8 + 1, n - 1, (i) => H[i] >= trail[i]);
  if (p9 < 0) p9 = firstIndex(p8 + 1, n - 1, (i) => H[i] >= H[p3]);
  if (p9 < 0) { p9 = Math.min(n - 1, p8 + Math.max(1, p8 - p7)); sure[8] = false; }

  // Finish: first moment after P9 where the hands settle and stay settled briefly.
  const holdFrames = Math.max(2, Math.round(0.12 / avgDt(times)));
  const stillThresh = peakSpeed * cfg.stillSpeedFraction;
  let p10 = -1;
  for (let i = p9 + 1; i < n; i++) {
    let ok = true;
    for (let j = i; j < Math.min(n, i + holdFrames); j++) if (speed[j] >= stillThresh) { ok = false; break; }
    if (ok) { p10 = i; break; }
  }
  if (p10 < 0) { p10 = argMax(H, Math.min(n - 1, p9), n - 1); sure[9] = false; }

  // Implausible timing means the anchors (and everything found from them) are suspect.
  const down = times[p7] - times[p4], back = times[p4] - times[p1];
  const [dMin, dMax] = cfg.downswingSeconds, [rMin, rMax] = cfg.tempoRatio;
  if (!(down >= dMin && down <= dMax && back / down >= rMin && back / down <= rMax)) sure.fill(false);

  const indices = enforceOrder([p1, p2, p3, p4, p5, p6, p7, p8, p9, p10], n);
  return { indices, confidence: sure, signals: { ...sig, Hp, peak, swing: [s0, s1] } };
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

// ---------- Single-photo helpers (photo mode) ----------

/** Normalised landmarks of one image -> pixel-space points. */
export function toPixels(lm, width, height) {
  return lm.map((p) => ({ x: p.x * width, y: p.y * height, v: p.visibility ?? 1 }));
}

/**
 * Directions from the feet, which barely move during a swing, so this works on any
 * single P-position photo (the body itself may be turned or mid-motion).
 */
export function feetOrientation(frame, handedness) {
  const S = sides(handedness);
  const lead = frame[S.ankle[0]], trail = frame[S.ankle[1]];
  const toes = (frame[LM.lFoot].x - frame[LM.lHeel].x) + (frame[LM.rFoot].x - frame[LM.rHeel].x);
  return {
    torso: torsoLength(frame) || 1,
    targetDir: lead.x - trail.x >= 0 ? 1 : -1,
    facingDir: toes >= 0 ? 1 : -1,
  };
}

/**
 * Map a reference pose (e.g. the P1 photo) into another photo's pixel space so the two
 * can be compared even if the framing or zoom differs. Anchored on the lead ankle and
 * scaled by torso length.
 */
export function alignTo(ref, frame, handedness) {
  const k = sides(handedness).ankle[0];
  const s = (torsoLength(frame) || 1) / (torsoLength(ref) || 1);
  const ax = ref[k].x, ay = ref[k].y, bx = frame[k].x, by = frame[k].y;
  return ref.map((p) => ({ x: bx + (p.x - ax) * s, y: by + (p.y - ay) * s, v: p.v }));
}
