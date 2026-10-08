// Synthetic swing generator: produces MediaPipe-style normalised landmarks for a
// stick-figure golfer so detection and feedback can be tested without a video.

const W = 1000, H = 1000;
const ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));

// Arm angle (degrees) over time: 0 = hands hanging at address, + = backswing, - = follow-through.
export const PHASES = { address: 0.6, back: 0.8, down: 0.28, through: 0.35, hold: 0.7 };

export function armAngle(t) {
  const { address, back, down, through } = PHASES;
  let s = t;
  if (s < address) return 0;
  s -= address;
  if (s < back) return 150 * ease(s / back);
  s -= back;
  if (s < down) return 150 - 150 * (s / down) ** 1.6; // accelerating downswing
  s -= down;
  if (s < through) return -160 * Math.sin((Math.PI / 2) * (s / through));
  return -160;
}

export const keyTimes = () => {
  const { address, back, down, through } = PHASES;
  return {
    takeawayStart: address,
    top: address + back,
    impact: address + back + down,
    finish: address + back + down + through,
    p3: address + back * (Math.acos(1 - 2 * (90 / 150)) / Math.PI),
  };
};

/**
 * @param {object} o
 *  view: 'face' | 'dtl'; fps; spineLoss (deg lost at impact, dtl); hipSway (torso lengths away at top, face-on);
 *  handsBehind (torso lengths, face-on impact)
 */
export function makeSwing(o = {}) {
  const { view = 'face', fps = 60, spineLoss = 0, hipSway = 0, handsBehind = 0 } = o;
  const total = Object.values(PHASES).reduce((a, b) => a + b, 0);
  const frames = [];
  const torso = 200;
  const kt = keyTimes();
  for (let t = 0; t <= total + 1e-9; t += 1 / fps) {
    const th = armAngle(t);
    const rad = (th * Math.PI) / 180;
    // Weight of "how far into the swing" for gradual effects.
    const toTop = ease((t - kt.takeawayStart) / (kt.top - kt.takeawayStart)) * (t < kt.top ? 1 : Math.max(0, 1 - (t - kt.top) / 0.15));
    const nearImpact = Math.max(0, 1 - Math.abs(t - kt.impact) / 0.25);
    const lm = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    const set = (k, x, y) => { lm[k] = { x: x / W, y: y / H, visibility: 0.95 }; };

    if (view === 'face') {
      // Target is image-right; golfer's left (lead) side appears on image-right.
      const sway = -hipSway * torso * toTop;
      const hip = { x: 500 + sway, y: 600 };
      const sh = { x: 500 + sway * 0.6, y: 400 };
      const shW = 80 * (1 - 0.45 * Math.min(1, Math.max(0, th) / 120));
      set(11, sh.x + shW, sh.y - 6); set(12, sh.x - shW, sh.y + 6); // lead (L) slightly higher
      set(23, hip.x + 50, hip.y); set(24, hip.x - 50, hip.y);
      set(25, 580, 750); set(26, 420, 750); set(27, 590, 900); set(28, 410, 900);
      set(29, 585, 910); set(30, 405, 910); set(31, 610, 915); set(32, 390, 915);
      set(0, sh.x - 5, 330);
      const R = 240;
      const hx = sh.x - R * Math.sin(rad) - handsBehind * torso * nearImpact;
      const hy = sh.y + R * Math.cos(rad);
      set(15, hx + 3, hy); set(16, hx - 3, hy);
      set(13, (sh.x + shW + hx) / 2, (sh.y + hy) / 2); set(14, (sh.x - shW + hx) / 2, (sh.y + hy) / 2);
    } else {
      // Down-the-line: golfer faces image-right.
      const phi = ((35 - spineLoss * nearImpact) * Math.PI) / 180;
      const hip = { x: 450 + spineLoss * 1.5 * nearImpact, y: 600 };
      const sh = { x: hip.x + torso * Math.sin(phi), y: hip.y - torso * Math.cos(phi) };
      set(11, sh.x + 8, sh.y - 4); set(12, sh.x - 8, sh.y + 4);
      set(23, hip.x + 6, hip.y); set(24, hip.x - 6, hip.y);
      set(25, 520, 760); set(26, 515, 760); set(27, 480, 900); set(28, 475, 900);
      set(29, 470, 910); set(30, 465, 910); set(31, 520, 915); set(32, 515, 915);
      set(0, sh.x + 50, sh.y - 40);
      const R = 240;
      const hx = sh.x + 30 * Math.cos(rad) - 90 * Math.sin(Math.abs(rad)) * (th > 0 ? 1 : -0.5);
      const hy = sh.y + R * Math.cos(rad);
      set(15, hx + 2, hy); set(16, hx - 2, hy);
      set(13, (sh.x + hx) / 2 + 10, (sh.y + hy) / 2); set(14, (sh.x + hx) / 2 - 10, (sh.y + hy) / 2);
    }
    frames.push({ t: +t.toFixed(4), lm });
  }
  return { frames, width: W, height: H };
}
