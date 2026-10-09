// Small geometry + signal helpers shared by detection, analysis and overlays.
// Points are {x, y} in pixels with y pointing down (image coordinates).

export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const deg = (rad) => (rad * 180) / Math.PI;

// Interior angle at b formed by a-b-c, in degrees (0–180).
export function jointAngle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const n = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!n) return 180;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / n));
  return deg(Math.acos(cos));
}

// Unsigned angle of the line from -> to, measured from vertical (0 = straight up/down).
export function angleFromVertical(from, to) {
  return deg(Math.atan2(Math.abs(to.x - from.x), Math.abs(to.y - from.y)));
}

// Signed tilt of a line from horizontal in degrees; positive when `b` is higher than `a`.
export function tiltFromHorizontal(a, b) {
  return deg(Math.atan2(a.y - b.y, Math.abs(b.x - a.x) || 1e-6));
}

// Signed perpendicular distance of p from the infinite line a->b (positive = left of a->b in image coords).
export function sideOfLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return ((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

// Centred moving average of a numeric array.
export function smooth(arr, window) {
  if (window <= 1) return arr.slice();
  const half = Math.floor(window / 2);
  return arr.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(arr.length - 1, i + half); j++) {
      sum += arr[j]; n++;
    }
    return sum / n;
  });
}

export function argMax(arr, from = 0, to = arr.length - 1) {
  let best = from;
  for (let i = from; i <= to; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

export function argMin(arr, from = 0, to = arr.length - 1) {
  let best = from;
  for (let i = from; i <= to; i++) if (arr[i] < arr[best]) best = i;
  return best;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Value at fraction q (0–1) of the sorted array, e.g. 0.95 for the 95th percentile.
export function percentile(arr, q) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[clamp(Math.round(q * (s.length - 1)), 0, s.length - 1)];
}
