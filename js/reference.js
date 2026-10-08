// Reference visuals for each P-position: a face-on golfer drawn like a steel section
// detail (solid body, dash-dot centreline, one orange dimension callout per position).
// If assets/reference/P1.jpg … P10.jpg exist, those photos are shown instead.

// Pose parameters for a right-handed golfer seen face-on (target to the right).
// Angles are measured from straight down; positive swings toward the trail side (left of the image).
//  arm: direction from the shoulders to the hands; club: direction of the shaft from the hands;
//  hip: sideways hip shift (+ = toward target); turn: 0–1 how far the shoulders are rotated;
//  tilt: upper body lean away from the target (degrees); heel: trail heel up (finish);
//  dim: which angle to dimension — 'spine' (from vertical), 'arm' (from vertical) or 'club' (from vertical).
const POSES = [
  { arm: 0, club: 0, hip: 0, turn: 0, tilt: 6, dim: 'spine' },
  { arm: 28, club: 90, hip: -2, turn: 0.3, tilt: 7, dim: 'arm' },
  { arm: 90, club: 180, hip: -3, turn: 0.6, tilt: 8, dim: 'arm' },
  { arm: 140, club: 270, hip: -3, turn: 0.9, tilt: 8, dim: 'arm' },
  { arm: 90, club: 175, hip: 4, turn: 0.6, tilt: 10, dim: 'arm' },
  { arm: 38, club: 92, hip: 6, turn: 0.3, tilt: 12, dim: 'arm' },
  { arm: -6, club: 6, hip: 8, turn: 0.1, tilt: 12, dim: 'spine' },
  { arm: -42, club: -90, hip: 10, turn: 0.3, tilt: 10, dim: 'arm' },
  { arm: -90, club: -180, hip: 12, turn: 0.6, tilt: 6, dim: 'arm' },
  { arm: -150, club: 80, hip: 15, turn: 0.9, tilt: 0, heel: true, dim: 'arm' },
];

const rad = (d) => (d * Math.PI) / 180;
const dir = (d) => ({ x: -Math.sin(rad(d)), y: Math.cos(rad(d)) });
const f1 = (v) => v.toFixed(1);

/** Inline SVG markup for position p (0-based). Left-handed golfers get a mirrored drawing. */
export function referenceSVG(p, handedness = 'right') {
  const s = POSES[p];
  const flip = handedness === 'left';
  const X = (x) => (flip ? 200 - x : x);
  const pt = (q) => `${f1(X(q.x))},${f1(q.y)}`;
  const add = (o, d, r) => ({ x: o.x + d.x * r, y: o.y + d.y * r });

  const groundY = 222;
  const hip = { x: 100 + s.hip, y: 132 };
  const spineDir = 180 - s.tilt; // leaning away from the target
  const sh = add(hip, dir(spineDir), 62);
  const head = add(sh, dir(spineDir), 26);
  const half = 22 * (1 - 0.55 * s.turn);
  const trailSh = { x: sh.x - half, y: sh.y + 2 }, leadSh = { x: sh.x + half, y: sh.y - 2 };
  const leadAnkle = { x: 121, y: groundY - 4 };
  const trailAnkle = s.heel ? { x: 90, y: groundY - 10 } : { x: 79, y: groundY - 4 };
  const leadKnee = { x: 116 + s.hip * 0.4, y: 177 };
  const trailKnee = s.heel ? { x: 104, y: 180 } : { x: 84 + s.hip * 0.4, y: 177 };
  const hipL = { x: hip.x + 11, y: hip.y }, hipT = { x: hip.x - 11, y: hip.y };
  const hands = add(sh, dir(s.arm), 74);
  const c = dir(s.club);
  let clubLen = p === 0 || p === 6 ? Math.max(40, groundY - 3 - hands.y) / Math.max(0.3, c.y) : 78;
  if (c.y < 0) clubLen = Math.min(clubLen, (hands.y - 8) / -c.y); // keep overhead clubs inside the drawing
  const clubHead = add(hands, c, clubLen);

  // Dimension callout: an arc between a vertical reference and the measured line.
  const line = (a, b, cls) => `<line x1="${f1(X(a.x))}" y1="${f1(a.y)}" x2="${f1(X(b.x))}" y2="${f1(b.y)}" class="${cls}"/>`;
  let dim = '';
  {
    let pivot, from, to, r;
    if (s.dim === 'spine') { pivot = hip; from = 180; to = spineDir; r = 104; } // arc sits clear of the head
    else if (s.dim === 'club') { pivot = hands; from = 0; to = s.club; r = 30; }
    else { pivot = sh; from = 0; to = s.arm; r = 30; }
    const deg = Math.round(Math.abs(to - from));
    const a = add(pivot, dir(from), r), b = add(pivot, dir(to), r);
    const sweep = (to > from) !== flip ? 1 : 0;
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    // Small arm angles would put the label on the torso, so set it just outside the arm instead.
    const outside = s.dim === 'arm' && Math.abs(to) < 60;
    const at = outside
      ? add(pivot, dir(to + Math.sign(to || 1) * 24), r + 22)
      : add(pivot, dir((from + to) / 2), r + (s.dim === 'spine' ? 12 : 15));
    const anchor = !outside ? 'middle' : X(at.x) < X(pivot.x) ? 'end' : 'start';
    dim = line(pivot, add(pivot, dir(from), r + 8), 'ref-ext') +
      (deg ? `<path d="M${pt(a)} A${r},${r} 0 ${large} ${sweep} ${pt(b)}" class="ref-dim"/>` : '') +
      `<text x="${f1(X(at.x))}" y="${f1(at.y + 4)}" text-anchor="${anchor}" class="ref-dim-text">${deg}°</text>`;
  }

  // Dash-dot centreline through the spine, overshooting like a drafting centreline.
  const clA = add(hip, dir(spineDir), -18), clB = add(hip, dir(spineDir), 112);

  return `<svg class="ref-figure" viewBox="0 0 200 240" role="img" aria-label="Reference figure for P${p + 1}">
  <line x1="6" y1="${groundY}" x2="194" y2="${groundY}" class="ref-ground"/>
  <circle cx="${X(100)}" cy="${groundY - 4}" r="4" class="ref-ball"/>
  <polyline points="${pt(hipT)} ${pt(trailKnee)} ${pt(trailAnkle)}" class="ref-body"/>
  <polyline points="${pt(hipL)} ${pt(leadKnee)} ${pt(leadAnkle)}" class="ref-body"/>
  ${line(hipT, hipL, 'ref-body')}
  ${line(hip, sh, 'ref-body')}
  ${line(trailSh, leadSh, 'ref-body')}
  <circle cx="${f1(X(head.x))}" cy="${f1(head.y)}" r="12" class="ref-head"/>
  ${line(hands, clubHead, 'ref-club')}
  <rect x="${f1(X(clubHead.x) - 3)}" y="${f1(clubHead.y - 3)}" width="6" height="6" class="ref-clubhead"/>
  <polyline points="${pt(trailSh)} ${pt(hands)} ${pt(leadSh)}" class="ref-arms"/>
  <circle cx="${f1(X(hands.x))}" cy="${f1(hands.y)}" r="4" class="ref-hands"/>
  ${line(clA, clB, 'ref-cl')}
  ${dim}
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
