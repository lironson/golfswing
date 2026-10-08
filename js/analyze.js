// Rule-based swing feedback for each P-position. DOM-free so it can be unit-tested.
//
// Each rule returns { status: 'good' | 'warn' | 'info', title, detail, priority }.
// Priority 1 = biggest impact on ball striking, 3 = minor.

import { CONFIG, sides } from './positions.js';
import { jointAngle, angleFromVertical, deg } from './geometry.js';
import { handsOf, hipMidOf, shoulderMidOf } from './detect.js';

const good = (title, detail = '') => ({ status: 'good', title, detail, priority: 9 });
const warn = (title, detail, priority = 2) => ({ status: 'warn', title, detail, priority });
const info = (title, detail = '') => ({ status: 'info', title, detail, priority: 9 });

const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '–');

/**
 * Body measurements for one frame, expressed relative to the address frame (P1).
 * ctx: { pts, idx, handedness, view, orient: { torso, targetDir, facingDir }, hasReference? }
 * When ctx.hasReference === false (a photo with no P1 to compare against), the
 * address-relative values are NaN and the rules that need them are skipped.
 */
export function measure(frameIndex, ctx) {
  const S = sides(ctx.handedness);
  const f = ctx.pts[frameIndex];
  const a = ctx.pts[ctx.idx[0]];
  const { torso, targetDir, facingDir } = ctx.orient;
  const P = (frame, pair, k) => frame[pair[k]];

  const hipMid = hipMidOf(f), shMid = shoulderMidOf(f), hands = handsOf(f);
  const hipMidA = hipMidOf(a), shMidA = shoulderMidOf(a), handsA = handsOf(a);
  const nose = f[0], noseA = a[0];

  const shoulderWidth = Math.abs(P(f, S.shoulder, 0).x - P(f, S.shoulder, 1).x);
  const shoulderWidthA = Math.abs(P(a, S.shoulder, 0).x - P(a, S.shoulder, 1).x) || 1;
  const stance = Math.abs(P(f, S.ankle, 0).x - P(f, S.ankle, 1).x) || 1;

  // Face-on spine tilt: positive = upper body tilted away from the target.
  const spineAway = deg(Math.atan2(-(shMid.x - hipMid.x) * targetDir, hipMid.y - shMid.y));

  const m = {
    spine: angleFromVertical(hipMid, shMid),
    spineA: angleFromVertical(hipMidA, shMidA),
    spineAway,
    leadElbow: jointAngle(P(f, S.shoulder, 0), P(f, S.elbow, 0), P(f, S.wrist, 0)),
    trailElbow: jointAngle(P(f, S.shoulder, 1), P(f, S.elbow, 1), P(f, S.wrist, 1)),
    trailKnee: jointAngle(P(f, S.hip, 1), P(f, S.knee, 1), P(f, S.ankle, 1)),
    trailKneeA: jointAngle(P(a, S.hip, 1), P(a, S.knee, 1), P(a, S.ankle, 1)),
    leadKnee: jointAngle(P(f, S.hip, 0), P(f, S.knee, 0), P(f, S.ankle, 0)),
    // Trail shoulder lower than lead shoulder (positive) at this frame, in degrees.
    shoulderTilt: deg(Math.atan2(P(f, S.shoulder, 1).y - P(f, S.shoulder, 0).y, shoulderWidth || 1)),
    shoulderTurnRatio: shoulderWidth / shoulderWidthA,
    // Displacements in torso lengths. "toward target" (face-on) / "toward ball" (down-the-line).
    headTarget: ((nose.x - noseA.x) * targetDir) / torso,
    headBall: ((nose.x - noseA.x) * facingDir) / torso,
    headDown: (nose.y - noseA.y) / torso,
    hipTarget: ((hipMid.x - hipMidA.x) * targetDir) / torso,
    hipBall: ((hipMid.x - hipMidA.x) * facingDir) / torso,
    handsTarget: ((hands.x - handsA.x) * targetDir) / torso,
    handsBall: ((hands.x - handsA.x) * facingDir) / torso,
    handsUnderShoulders: ((hands.x - shMid.x) * facingDir) / torso,
    handsAboveTrailShoulder: (P(f, S.shoulder, 1).y - hands.y) / torso,
    trailHipOutside: ((P(f, S.ankle, 1).x - P(f, S.hip, 1).x) * targetDir) / torso,
    leadHipPastAnkle: ((P(f, S.hip, 0).x - P(f, S.ankle, 0).x) * targetDir) / torso,
    hipOverLead: Math.abs(hipMid.x - P(f, S.ankle, 0).x) / stance,
    trailHeelUp: (P(f, S.heel, 1).y < P(a, S.heel, 1).y - 0.06 * torso),
    // Height of the address shoulder-plane line (address hands -> trail shoulder) at the hands' x.
    aboveShoulderPlane: (() => {
      const h0 = handsA, s0 = P(a, S.shoulder, 1);
      if (Math.abs(s0.x - h0.x) < 1) return 0;
      const yLine = h0.y + ((hands.x - h0.x) * (s0.y - h0.y)) / (s0.x - h0.x);
      return (yLine - hands.y) / torso;
    })(),
  };
  if (ctx.hasReference === false) {
    for (const k of RELATIVE) m[k] = NaN;
    m.trailHeelUp = null;
  }
  return m;
}

const RELATIVE = ['spineA', 'trailKneeA', 'shoulderTurnRatio', 'headTarget', 'headBall', 'headDown', 'hipTarget',
  'hipBall', 'handsTarget', 'handsBall', 'aboveShoulderPlane'];

/** Checks for P-position `p` (0-based) evaluated at `frameIndex`. */
export function analyzePosition(p, frameIndex, ctx) {
  const m = measure(frameIndex, ctx);
  const rel = ctx.hasReference !== false;
  const checks = ctx.view === 'dtl' ? dtlChecks(p, m, rel) : faceOnChecks(p, m, rel);
  checks.push(...commonChecks(p, m));
  return { checks, metrics: readouts(p, m, ctx.view, rel) };
}

function dtlChecks(p, m, rel) {
  const c = CONFIG.dtl;
  const out = [];
  const spineLoss = m.spineA - m.spine;

  if (p === 0) {
    if (m.spine < c.spineMin) out.push(warn('Too upright at address', `Spine tilt is ${fmt(m.spine)}°. Hinge more from the hips (aim for ~30–45°) so the arms can hang and swing freely.`, 2));
    else if (m.spine > c.spineMax) out.push(warn('Bent over too much', `Spine tilt is ${fmt(m.spine)}°. Stand a little taller (~30–45°) to make turning easier and protect your back.`, 2));
    else out.push(good('Good spine tilt', `${fmt(m.spine)}° of forward bend from the hips.`));

    if (m.trailKnee < c.kneeFlexMin) out.push(warn('Too much knee bend', `Knee angle ${fmt(m.trailKnee)}°. Sitting too low restricts the hip turn — straighten the legs slightly.`, 3));
    else if (m.trailKnee > c.kneeFlexMax) out.push(warn('Legs too straight', `Knee angle ${fmt(m.trailKnee)}°. Add a little flex (about 20°) for an athletic, balanced base.`, 3));
    else out.push(good('Athletic knee flex', `Knee angle ${fmt(m.trailKnee)}°.`));

    if (m.handsUnderShoulders > c.handsReachWarn) out.push(warn('Reaching for the ball', 'Hands are well out in front of the shoulders. Let the arms hang more vertically — stand a touch closer or tilt more.', 2));
    else if (m.handsUnderShoulders < -0.15) out.push(warn('Hands crowded close to the body', 'Give the arms a bit more room so they hang just in front of the thighs.', 3));
    else out.push(good('Arms hang naturally', 'Hands sit roughly under the shoulders.'));
  }

  if (p === 1 && rel) {
    if (m.handsBall < -c.takeawayInsideWarn) out.push(warn('Takeaway too far inside', 'Hands have moved sharply behind you toward your body. Keep the hands in front of the chest and let the club work back on a straighter line to P2.', 2));
    else if (m.handsBall > 0.12) out.push(warn('Takeaway pushed outside', 'Hands are moving out toward the ball. Rotate the chest to move the club back rather than pushing the arms away.', 3));
    else out.push(good('Takeaway on line', 'Hands stay in front of the body as the club moves back.'));
  }

  if (p >= 1 && p <= 6 && rel) {
    if (spineLoss > c.spineLossWarn) {
      const where = p >= 5 ? 'Early extension: you are standing up into the ball.' : 'You are standing up during the backswing.';
      out.push(warn('Losing spine angle', `${where} Spine tilt ${fmt(m.spine)}° vs ${fmt(m.spineA)}° at address. Feel your chest stay over the ball and your hips stay back.`, p >= 5 ? 1 : 2));
    } else if (spineLoss < -c.spineLossWarn) {
      out.push(warn('Bending further over', `Spine tilt increased to ${fmt(m.spine)}° (address ${fmt(m.spineA)}°). Keep the same posture as you turn.`, 3));
    } else if (p === 3 || p === 6) {
      out.push(good('Spine angle maintained', `${fmt(m.spine)}° vs ${fmt(m.spineA)}° at address.`));
    }
  }

  if (!rel) {
    // Hip depth needs the address photo.
  } else if ((p === 5 || p === 6) && m.hipBall > c.hipTowardBallWarn) {
    out.push(warn('Hips moving toward the ball', 'Your hips have moved off the "butt line" toward the ball (early extension). This crowds the arms and leads to blocks and flips. Keep your backside on the line as you rotate through.', 1));
  } else if (p === 6) {
    out.push(good('Hip depth kept', 'Hips stayed back on the butt line through impact.'));
  }

  if (p === 3 && rel && m.trailKneeA - m.trailKnee < -c.trailKneeStraightenWarn) {
    out.push(warn('Trail leg straightening', `Trail knee went from ${fmt(m.trailKneeA)}° to ${fmt(m.trailKnee)}°. Some straightening is fine, but keep a little flex to stay in posture.`, 3));
  }

  if (!rel) {
    // The shoulder plane is drawn from the address photo.
  } else if (p === 5 && m.aboveShoulderPlane > c.overTopWarn) {
    out.push(warn('Possible over-the-top move', 'Hands are above the shoulder-plane line coming down. Let the trail elbow drop toward your hip so the club shallows and approaches from the inside.', 1));
  } else if (p === 5) {
    out.push(good('Hands under the shoulder plane', 'The downswing is approaching from below the shoulder plane.'));
  }

  if (p >= 1 && p <= 7 && rel) {
    if (m.headDown > c.headMoveWarn) out.push(warn('Head dipping', 'Your head has dropped from its address height. Keep your chest up and your eyes level.', 2));
    else if (m.headDown < -c.headMoveWarn) out.push(warn('Head lifting', 'Your head has risen from its address height, usually a sign of standing up. Stay down through the shot.', 2));
    if (m.headBall > c.headMoveWarn) out.push(warn('Head moving toward the ball', 'Your upper body is drifting toward the ball, which often comes with early extension.', 2));
  }

  if (p === 7 && rel) {
    if (Math.abs(spineLoss) <= 10) out.push(good('Posture held through the ball', 'Spine angle stays close to address after impact.'));
    else out.push(warn('Posture lost after impact', `Spine tilt ${fmt(m.spine)}° vs ${fmt(m.spineA)}° at address. Keep rotating with the chest over the ball until the arms are past parallel.`, 3));
  }

  if (p === 9) {
    if (m.spine <= c.finishSpineMax) out.push(good('Tall finish', 'You finish standing up straight and balanced.'));
    else out.push(warn('Finish more upright', `Upper body still tilted ${fmt(m.spine)}°. Rotate fully through so you finish tall with the belt buckle at the target.`, 3));
  }
  return out;
}

function faceOnChecks(p, m, rel) {
  const c = CONFIG.faceOn;
  const out = [];

  if (p === 0) {
    if (m.shoulderTilt >= c.shoulderTiltMin && m.shoulderTilt <= 20) out.push(good('Good shoulder tilt', `Trail shoulder ${fmt(m.shoulderTilt)}° lower than the lead.`));
    else if (m.shoulderTilt < 0) out.push(warn('Reverse shoulder tilt', 'Your lead shoulder is lower than your trail shoulder. Tilt the spine slightly away from the target so the trail shoulder sits lower (the trail hand is lower on the grip).', 2));
    else if (m.shoulderTilt > 20) out.push(warn('Too much tilt away', `Shoulders are tilted ${fmt(m.shoulderTilt)}°. A little less tilt helps avoid hitting behind the ball.`, 3));
    else out.push(info('Shoulders nearly level', 'A slight tilt (trail shoulder lower) usually helps. Let the trail shoulder sit a touch lower.'));
  }

  if (p === 2 || p === 3) {
    if (m.leadElbow < c.leadArmBentWarn) out.push(warn('Lead arm bending', `Lead elbow at ${fmt(m.leadElbow)}°. Keep the lead arm extended (not locked) for width and a consistent radius.`, 2));
    else out.push(good('Lead arm extended', `Lead elbow ${fmt(m.leadElbow)}°.`));
  }

  if (p >= 1 && p <= 3) {
    if (rel && m.headTarget < -c.headSwayWarn) out.push(warn('Head swaying away from the target', `Head has moved ${fmt(-m.headTarget * 100)}% of a torso length off the ball. Turn around your spine rather than sliding.`, 2));
    if (m.trailHipOutside > 0 || (rel && m.hipTarget < -0.2)) out.push(warn('Hip sway', 'Your trail hip is drifting outside your trail foot. Feel the trail hip turn behind you instead of sliding sideways.', 2));
    else if (p === 3) out.push(good('Centred pivot', 'Trail hip stays inside the trail foot.'));
  }

  if (p === 3 && rel) {
    if (m.shoulderTurnRatio > c.shoulderTurnRatioWarn) out.push(warn('Restricted shoulder turn', 'Your shoulders do not appear to turn much. Let the lead shoulder turn under the chin (aim for ~90°) — allow the hips to turn too.', 2));
    else out.push(good('Full shoulder turn', 'Shoulders have rotated well away from the target.'));
  }

  if ((p === 4 || p === 5) && rel) {
    if (m.hipTarget >= 0.03) out.push(good('Lower body leading', 'Hips have shifted toward the target to start the downswing.'));
    else out.push(warn('Shift toward the target', 'Your hips have not moved toward the target yet. Start the downswing by shifting pressure into the lead foot before turning.', 1));
  }

  if (p === 6) {
    if (!rel) { /* hands vs address needs P1 */ } else if (m.handsTarget < -c.handsBehindWarn) out.push(warn('Hands behind at impact (flip)', 'Hands are behind their address position. Lead with the hands — forward shaft lean compresses the ball.', 1));
    else out.push(good('Hands ahead at impact', 'Hands are level with or ahead of their address position (forward shaft lean).'));
    if (m.spineAway < 0) out.push(warn('Upper body ahead of the ball', 'Spine is tilted toward the target at impact. Keep your head behind the ball with a slight tilt away from the target.', 1));
    else if (m.spineAway > 30) out.push(warn('Hanging back', `Spine tilted ${fmt(m.spineAway)}° away from the target. Get more weight to the lead side through impact.`, 2));
    else out.push(good('Good spine tilt at impact', `Tilted ${fmt(m.spineAway)}° away from the target.`));
    if (rel && m.headTarget > c.headAheadWarn) out.push(warn('Head sliding toward the target', 'Your head has moved ahead of where it started. Keep it behind the ball through impact.', 2));
    if (m.leadHipPastAnkle > c.hipSlideMax) out.push(warn('Hips sliding too far', 'Your lead hip has slid past the lead foot. Rotate the hips open rather than sliding them.', 2));
  }

  if (p === 7 || p === 8) {
    const arm = p === 7 ? m.leadElbow : m.trailElbow;
    const which = p === 7 ? 'Lead' : 'Trail';
    if (arm < (p === 7 ? 140 : c.trailArmBentWarn)) out.push(warn(p === 7 ? 'Chicken wing' : 'Trail arm bent', `${which} elbow at ${fmt(arm)}°. Extend both arms down the target line and keep the chest rotating.`, 2));
    else out.push(good('Good extension', `${which} elbow ${fmt(arm)}°.`));
  }

  if (p === 9) {
    if (m.hipOverLead <= c.finishHipOverLead) out.push(good('Weight on the lead side', 'Hips finish over the lead foot.'));
    else out.push(warn('Finish on your lead side', 'Your hips are still between your feet. Rotate fully so your belt buckle faces the target and your weight is over the lead foot.', 2));
    if (m.trailHeelUp) out.push(good('Trail heel up', 'Trail foot has rolled up onto its toe.'));
  }
  return out;
}

function commonChecks(p, m) {
  const out = [];
  if (p === 3) {
    if (m.handsAboveTrailShoulder < 0) out.push(info('Short backswing', 'Hands stay below the trail shoulder at the top. Fine for control, but a fuller turn adds speed.'));
  }
  if (p === 9 && !m.trailHeelUp) out.push(info('Hold your finish', 'A balanced finish you can hold for 3 seconds is a great sign of a well-sequenced swing.'));
  return out;
}

function readouts(p, m, view, rel) {
  if (view === 'dtl') {
    const r = [['Spine tilt', `${fmt(m.spine)}°`]];
    if (rel && p > 0) r.push(['Address', `${fmt(m.spineA)}°`]);
    if (p === 0 || p === 3) r.push(['Trail knee', `${fmt(m.trailKnee)}°`]);
    if (rel && p > 0) r.push(['Hips → ball', `${fmt(m.hipBall * 100)}%`]);
    return r;
  }
  const r = [
    ['Shoulder tilt', `${fmt(m.shoulderTilt)}°`],
    ['Lead elbow', `${fmt(m.leadElbow)}°`],
  ];
  if (rel && p > 0) {
    r.push(['Head shift', `${fmt(m.headTarget * 100)}%`]);
    r.push(['Hip shift', `${fmt(m.hipTarget * 100)}%`]);
  }
  if (rel && p === 3) r.push(['Turn (width)', `${fmt(m.shoulderTurnRatio * 100)}%`]);
  return r;
}

/** Overall status for a card: warn if any warning, else good. */
export function cardStatus(checks) {
  return checks.some((c) => c.status === 'warn') ? 'warn' : 'good';
}

/** Top-N priorities across all positions, de-duplicated by title. */
export function summarize(results, n = 3) {
  const seen = new Set();
  const warns = [];
  results.forEach((r, p) => r && r.checks.forEach((c) => {
    if (c.status === 'warn' && !seen.has(c.title)) { seen.add(c.title); warns.push({ ...c, p }); }
  }));
  warns.sort((a, b) => a.priority - b.priority || a.p - b.p);
  const goodCount = results.reduce((s, r) => s + (r ? r.checks.filter((c) => c.status === 'good').length : 0), 0);
  return { top: warns.slice(0, n), warnCount: warns.length, goodCount };
}

