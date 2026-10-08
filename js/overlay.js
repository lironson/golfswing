// Draws a video frame plus skeleton and guide lines onto a canvas.

import { sides, LM } from './positions.js';
import { jointAngle } from './geometry.js';
import { handsOf, hipMidOf, shoulderMidOf } from './detect.js';

export const COLORS = {
  skeleton: 'rgba(255,255,255,0.85)',
  lead: '#ffd23f',
  spine: '#3fd0ff',
  reference: 'rgba(255,255,255,0.9)',
  plane: '#5ee36b',
  butt: '#ff5fa2',
  head: '#ffd23f',
  hands: '#ff9f43',
  hips: '#5ee36b',
};

const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
];

/**
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasImageSource} source  frame image at the video's native resolution
 * @param {object} opts { srcW, srcH, ctx (analysis ctx), p, frameIndex, showOverlay, title, status, maxWidth }
 */
export function drawFrame(canvas, source, opts) {
  const { srcW, srcH, maxWidth = 720 } = opts;
  const scale = Math.min(1, maxWidth / srcW);
  canvas.width = Math.round(srcW * scale);
  canvas.height = Math.round(srcH * scale);
  const g = canvas.getContext('2d');
  g.drawImage(source, 0, 0, canvas.width, canvas.height);

  if (opts.showOverlay && opts.ctx) {
    g.save();
    g.scale(scale, scale);
    drawGuides(g, opts.ctx, opts.frameIndex, Math.max(srcW, srcH));
    g.restore();
  }
  drawHeader(g, canvas.width, opts.title, opts.status);
}

function drawGuides(g, ctx, i, side) {
  const f = ctx.pts[i];
  const a = ctx.pts[ctx.idx[0]];
  const S = sides(ctx.handedness);
  const torso = ctx.orient.torso;
  // Size strokes and labels for legibility on a ~350px-wide card, but grow them for a large golfer in frame.
  const lw = Math.max(side * 0.005, torso * 0.015);
  const font = Math.max(side * 0.026, torso * 0.09);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const line = (p1, p2, color, width = lw, dash = null) => {
    g.beginPath();
    g.setLineDash(dash ? dash.map((d) => d * lw) : []);
    g.strokeStyle = color; g.lineWidth = width;
    g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
    g.setLineDash([]);
  };
  const extend = (p1, p2, k) => ({ x: p1.x + (p2.x - p1.x) * k, y: p1.y + (p2.y - p1.y) * k });
  const label = (text, at, color) => {
    g.font = `600 ${font}px system-ui, sans-serif`;
    const w = g.measureText(text).width + font * 0.6;
    const h = font * 1.35;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(g, at.x - w / 2, at.y - h / 2, w, h, h / 3); g.fill();
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, at.x, at.y + font * 0.05);
  };

  // Hand path from address to this frame.
  g.beginPath();
  g.strokeStyle = COLORS.hands; g.lineWidth = lw * 0.7; g.globalAlpha = 0.85;
  for (let k = ctx.idx[0]; k <= i; k++) {
    const h = handsOf(ctx.pts[k]);
    if (k === ctx.idx[0]) g.moveTo(h.x, h.y); else g.lineTo(h.x, h.y);
  }
  g.stroke(); g.globalAlpha = 1;

  const hipMid = hipMidOf(f), shMid = shoulderMidOf(f);
  const hipMidA = hipMidOf(a), shMidA = shoulderMidOf(a);

  if (ctx.view === 'dtl') {
    const dir = ctx.orient.facingDir;
    // Address spine reference vs current spine.
    line(hipMidA, extend(hipMidA, shMidA, 1.35), COLORS.reference, lw * 0.8, [2, 2]);
    line(hipMid, extend(hipMid, shMid, 1.35), COLORS.spine, lw);
    // Butt line: just behind the hips at address.
    const buttX = hipMidA.x - dir * torso * 0.2;
    const footY = Math.max(a[LM.lAnkle].y, a[LM.rAnkle].y);
    line({ x: buttX, y: shMidA.y }, { x: buttX, y: footY }, COLORS.butt, lw * 0.8, [3, 2]);
    // Shoulder plane: address hands through the trail shoulder.
    const h0 = handsOf(a), s0 = a[S.shoulder[1]];
    line(extend(s0, h0, 1.4), extend(h0, s0, 1.5), COLORS.plane, lw * 0.8, [3, 2]);
    // Head box from address.
    drawBox(g, a[LM.nose], torso * 0.22, torso * 0.26, COLORS.head, lw * 0.8);
    // Knee angle readout.
    const knee = f[S.knee[1]];
    label(`${Math.round(jointAngle(f[S.hip[1]], knee, f[S.ankle[1]]))}°`, { x: knee.x + dir * torso * 0.35, y: knee.y }, '#fff');
    const spineDeg = Math.round(Math.atan2(Math.abs(shMid.x - hipMid.x), Math.abs(hipMid.y - shMid.y)) * 180 / Math.PI);
    label(`Spine ${spineDeg}°`, extend(hipMid, shMid, 1.55), COLORS.spine);
  } else {
    // Head position from address: vertical + horizontal reference.
    const nA = a[LM.nose];
    line({ x: nA.x, y: nA.y - torso * 0.5 }, { x: nA.x, y: hipMidA.y }, COLORS.head, lw * 0.8, [3, 2]);
    line({ x: nA.x - torso * 0.3, y: nA.y }, { x: nA.x + torso * 0.3, y: nA.y }, COLORS.head, lw * 0.6, [2, 2]);
    // Sway lines at the address hip positions.
    const footY = Math.max(a[LM.lAnkle].y, a[LM.rAnkle].y);
    for (const k of [S.hip[0], S.hip[1]]) {
      line({ x: a[k].x, y: shMidA.y }, { x: a[k].x, y: footY }, COLORS.butt, lw * 0.7, [3, 2]);
    }
    // Shoulder and hip lines (extended), plus the spine.
    const ls = f[S.shoulder[0]], ts = f[S.shoulder[1]], lh = f[S.hip[0]], th = f[S.hip[1]];
    line(extend(ts, ls, 1.35), extend(ls, ts, 1.35), COLORS.spine, lw);
    line(extend(th, lh, 1.4), extend(lh, th, 1.4), COLORS.hips, lw);
    line(hipMid, extend(hipMid, shMid, 1.3), COLORS.spine, lw * 0.8);
    // Elbow readouts.
    const le = f[S.elbow[0]];
    label(`${Math.round(jointAngle(ls, le, f[S.wrist[0]]))}°`, { x: le.x, y: le.y - torso * 0.18 }, COLORS.lead);
  }

  // Skeleton on top.
  for (const [p, q] of BONES) {
    const isLead = (p === S.shoulder[0] && q === S.elbow[0]) || (p === S.elbow[0] && q === S.wrist[0]) ||
      (q === S.shoulder[0] && p === S.elbow[0]) || (q === S.elbow[0] && p === S.wrist[0]);
    line(f[p], f[q], isLead ? COLORS.lead : COLORS.skeleton, lw * (isLead ? 1 : 0.7));
  }
  g.fillStyle = '#fff';
  for (const k of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    g.beginPath(); g.arc(f[k].x, f[k].y, lw * 0.9, 0, Math.PI * 2); g.fill();
  }
  const hands = handsOf(f);
  g.fillStyle = COLORS.hands;
  g.beginPath(); g.arc(hands.x, hands.y, lw * 1.6, 0, Math.PI * 2); g.fill();
}

function drawBox(g, c, hw, hh, color, lw) {
  g.setLineDash([lw * 3, lw * 2]);
  g.strokeStyle = color; g.lineWidth = lw;
  g.strokeRect(c.x - hw, c.y - hh, hw * 2, hh * 2);
  g.setLineDash([]);
}

function drawHeader(g, w, title, status) {
  if (!title) return;
  const fs = Math.max(12, Math.round(w / 26));
  const h = fs * 1.9;
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(0, 0, w, h);
  g.font = `700 ${fs}px system-ui, sans-serif`;
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(title, fs * 0.6, h / 2);
  if (status) {
    const txt = status === 'warn' ? '⚠ Work on' : '✓ Looks good';
    g.font = `600 ${Math.round(fs * 0.8)}px system-ui, sans-serif`;
    const tw = g.measureText(txt).width + fs;
    g.fillStyle = status === 'warn' ? '#f0a020' : '#2fb36a';
    roundRect(g, w - tw - fs * 0.5, h * 0.18, tw, h * 0.64, h * 0.2); g.fill();
    g.fillStyle = '#111'; g.textAlign = 'center';
    g.fillText(txt, w - tw / 2 - fs * 0.5, h / 2 + 1);
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

