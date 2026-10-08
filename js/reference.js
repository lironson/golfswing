// Reference visuals for each P-position: a simple face-on golfer drawn in SVG.
// If assets/reference/P1.jpg … P10.jpg exist, those photos are shown instead.

// Pose parameters for a right-handed golfer seen face-on (target to the right).
// Angles are measured from straight down; positive swings toward the trail side (left of the image).
//  arm: direction from the shoulders to the hands; club: direction of the shaft from the hands;
//  hip: sideways hip shift (+ = toward target); turn: 0–1 how far the shoulders are rotated;
//  tilt: upper body lean away from the target (degrees); heel: trail heel up (finish).
const POSES = [
  { arm: 0, club: 0, hip: 0, turn: 0, tilt: 6 },
  { arm: 28, club: 90, hip: -2, turn: 0.3, tilt: 7 },
  { arm: 90, club: 180, hip: -3, turn: 0.6, tilt: 8 },
  { arm: 140, club: 270, hip: -3, turn: 0.9, tilt: 8 },
  { arm: 88, club: 175, hip: 4, turn: 0.6, tilt: 10 },
  { arm: 38, club: 92, hip: 6, turn: 0.3, tilt: 12 },
  { arm: -6, club: 6, hip: 8, turn: 0.1, tilt: 12 },
  { arm: -42, club: -90, hip: 10, turn: 0.3, tilt: 10 },
  { arm: -95, club: -180, hip: 12, turn: 0.6, tilt: 6 },
  { arm: -150, club: 80, hip: 15, turn: 0.9, tilt: 0, heel: true },
];

const dir = (deg) => {
  const r = (deg * Math.PI) / 180;
  return { x: -Math.sin(r), y: Math.cos(r) };
};
const pt = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

/** Inline SVG markup for position p (0-based). */
export function referenceSVG(p, handedness = 'right') {
  const s = POSES[p];
  const groundY = 222;
  const hip = { x: 100 + s.hip, y: 132 };
  const tilt = (s.tilt * Math.PI) / 180;
  // Upper body leans away from the target (to the left of the image).
  const sh = { x: hip.x - Math.sin(tilt) * 62, y: hip.y - Math.cos(tilt) * 62 };
  const head = { x: sh.x - Math.sin(tilt) * 26, y: sh.y - Math.cos(tilt) * 26 };
  const half = 22 * (1 - 0.55 * s.turn);
  const trailSh = { x: sh.x - half, y: sh.y + 2 }, leadSh = { x: sh.x + half, y: sh.y - 2 };
  const leadAnkle = { x: 121, y: groundY - 4 };
  const trailAnkle = s.heel ? { x: 90, y: groundY - 10 } : { x: 79, y: groundY - 4 };
  const leadKnee = { x: 116 + s.hip * 0.4, y: 177 };
  const trailKnee = s.heel ? { x: 104, y: 180 } : { x: 84 + s.hip * 0.4, y: 177 };
  const hipL = { x: hip.x + 11, y: hip.y }, hipT = { x: hip.x - 11, y: hip.y };
  const a = dir(s.arm);
  const hands = { x: sh.x + a.x * 74, y: sh.y + a.y * 74 };
  const c = dir(s.club);
  const clubLen = p === 0 || p === 6 ? Math.max(40, groundY - 3 - hands.y) / Math.max(0.3, c.y) : 78;
  const head2 = { x: hands.x + c.x * clubLen, y: hands.y + c.y * clubLen };

  const mirror = handedness === 'left' ? ' transform="translate(200 0) scale(-1 1)"' : '';
  return `<svg class="ref-figure" viewBox="0 0 200 240" role="img" aria-label="Reference figure for P${p + 1}">
  <line x1="10" y1="${groundY}" x2="190" y2="${groundY}" class="ref-ground"/>
  <g${mirror}>
    <circle cx="100" cy="${groundY - 4}" r="4" class="ref-ball"/>
    <polyline points="${pt(hipT)} ${pt(trailKnee)} ${pt(trailAnkle)}" class="ref-body"/>
    <polyline points="${pt(hipL)} ${pt(leadKnee)} ${pt(leadAnkle)}" class="ref-body"/>
    <line x1="${hipT.x}" y1="${hipT.y}" x2="${hipL.x}" y2="${hipL.y}" class="ref-body"/>
    <line x1="${hip.x}" y1="${hip.y}" x2="${sh.x.toFixed(1)}" y2="${sh.y.toFixed(1)}" class="ref-body"/>
    <line x1="${trailSh.x.toFixed(1)}" y1="${trailSh.y.toFixed(1)}" x2="${leadSh.x.toFixed(1)}" y2="${leadSh.y.toFixed(1)}" class="ref-body"/>
    <circle cx="${head.x.toFixed(1)}" cy="${head.y.toFixed(1)}" r="12" class="ref-head"/>
    <line x1="${hands.x.toFixed(1)}" y1="${hands.y.toFixed(1)}" x2="${head2.x.toFixed(1)}" y2="${head2.y.toFixed(1)}" class="ref-club"/>
    <circle cx="${head2.x.toFixed(1)}" cy="${head2.y.toFixed(1)}" r="3.5" class="ref-clubhead"/>
    <polyline points="${pt(trailSh)} ${pt(hands)} ${pt(leadSh)}" class="ref-arms"/>
    <circle cx="${hands.x.toFixed(1)}" cy="${hands.y.toFixed(1)}" r="4" class="ref-hands"/>
  </g>
</svg>`;
}

/**
 * Element showing the reference for position p: the user's own photo from
 * assets/reference/P#.jpg if present, otherwise the drawn figure.
 */
export function referenceElement(p, handedness = 'right') {
  const wrap = document.createElement('div');
  wrap.className = 'ref-visual';
  wrap.innerHTML = referenceSVG(p, handedness);
  const img = new Image();
  img.alt = `Reference photo for P${p + 1}`;
  img.className = 'ref-photo';
  img.onload = () => { wrap.innerHTML = ''; wrap.appendChild(img); };
  img.src = `assets/reference/P${p + 1}.jpg`;
  return wrap;
}
