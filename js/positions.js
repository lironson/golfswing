// Static reference data for the 10 P-positions and the tunable thresholds
// used by detection (detect.js) and feedback (analyze.js).

export const POSITIONS = [
  {
    id: 'P1',
    name: 'Address',
    summary: 'Athletic setup: tilted from the hips, soft knees, arms hanging naturally under the shoulders.',
    checkpoints: [
      'Spine tilted forward roughly 30–45° from the hips (down-the-line)',
      'Knees flexed about 20–25°, weight over the balls of the feet',
      'Hands hang roughly under the shoulders',
      'Trail shoulder slightly lower than the lead shoulder (face-on)',
    ],
  },
  {
    id: 'P2',
    name: 'Takeaway — shaft parallel',
    summary: 'Club shaft parallel to the ground on the way back; the triangle of arms and shoulders moves together.',
    checkpoints: [
      'Hands around hip height, club roughly over the hands (not whipped inside)',
      'Club face roughly matching spine angle (toe slightly down, not wide open)',
      'Head and spine angle steady; no early lift',
    ],
  },
  {
    id: 'P3',
    name: 'Lead arm parallel — backswing',
    summary: 'Lead arm parallel to the ground; wrists hinged so the shaft is roughly vertical (90° to the lead arm).',
    checkpoints: [
      'Lead arm fairly straight',
      'Shoulders turned ~60–75°, hips turned ~30–45°',
      'Head stays centred; no lateral sway away from the target',
    ],
  },
  {
    id: 'P4',
    name: 'Top of the backswing',
    summary: 'Full shoulder turn (~90°), lead arm across the chest, weight loaded into the trail side.',
    checkpoints: [
      'Shoulders turned about 90°, hips about 45°',
      'Lead arm reasonably straight; lead wrist flat-to-slightly bowed',
      'Trail knee keeps some flex; trail hip stays inside the trail foot',
      'Spine angle from address maintained',
    ],
  },
  {
    id: 'P5',
    name: 'Lead arm parallel — downswing',
    summary: 'Lead arm parallel on the way down with the wrist angle (lag) still held; lower body leading.',
    checkpoints: [
      'Hips have started rotating open and shifted toward the target',
      'Hands drop onto plane (below the shoulder plane), not over the top',
      'Wrist hinge retained — club still well above the hands',
    ],
  },
  {
    id: 'P6',
    name: 'Shaft parallel — downswing',
    summary: 'Shaft parallel to the ground before impact, hands in front of the trail thigh, lag preserved.',
    checkpoints: [
      'Hands around trail-hip height, ahead of the club head',
      'Hips open ~20–30°, chest still slightly closed',
      'Spine angle and hip depth maintained (no early extension)',
    ],
  },
  {
    id: 'P7',
    name: 'Impact',
    summary: 'Hands slightly ahead of the ball (forward shaft lean), hips open, weight on the lead side.',
    checkpoints: [
      'Hands ahead of their address position toward the target',
      'Hips open ~35–45°, shoulders roughly square',
      'Head behind the ball; spine tilted slightly away from the target',
      'Hips stay back (hip depth kept) and spine angle retained',
    ],
  },
  {
    id: 'P8',
    name: 'Shaft parallel — follow-through',
    summary: 'Shaft parallel past impact with both arms extended down the target line.',
    checkpoints: [
      'Both arms extended (no chicken wing)',
      'Chest rotating toward the target',
      'Posture maintained through the ball',
    ],
  },
  {
    id: 'P9',
    name: 'Trail arm parallel — follow-through',
    summary: 'Trail arm parallel to the ground, club hinged back up; body continuing to rotate.',
    checkpoints: [
      'Trail arm straight and parallel to the ground',
      'Chest facing the target or beyond',
      'Weight mostly on the lead foot; trail heel coming up',
    ],
  },
  {
    id: 'P10',
    name: 'Finish',
    summary: 'Balanced, fully rotated finish: belt buckle to the target, weight on the lead foot, standing tall.',
    checkpoints: [
      'Hips over the lead foot, trail foot up on its toe',
      'Chest and belt buckle facing the target',
      'Balanced long enough to hold the pose',
    ],
  },
];

// All detection/analysis thresholds in one place. Distances are in units of
// torso length (mid-hip to mid-shoulder at address) unless stated otherwise.
export const CONFIG = {
  smoothingWindow: 5, // frames, centred moving average on landmarks
  minVisibility: 0.3,

  detect: {
    // Hand height fraction between address and lead-arm-parallel that marks "shaft parallel".
    shaftParallelFraction: 0.3,
    // A frame counts as "still" when hand speed is below this fraction of the swing's peak speed.
    stillSpeedFraction: 0.12,
    // Shoulder width / torso length at address below which we guess down-the-line.
    dtlShoulderRatio: 0.42,
  },

  dtl: {
    spineMin: 25, // degrees from vertical at address
    spineMax: 50,
    kneeFlexMin: 140, // hip-knee-ankle interior angle at address
    kneeFlexMax: 170,
    spineLossWarn: 8, // degrees lost vs address
    hipTowardBallWarn: 0.1, // early extension (hips toward the ball)
    headMoveWarn: 0.12,
    handsReachWarn: 0.25, // hands horizontally away from under the shoulders at address
    takeawayInsideWarn: 0.3,
    overTopWarn: 0.12, // hands above the shoulder-plane reference in the downswing
    trailKneeStraightenWarn: 18, // degrees
    finishSpineMax: 25,
  },

  faceOn: {
    headSwayWarn: 0.15,
    headAheadWarn: 0.1,
    shoulderTiltMin: 2, // degrees, trail shoulder lower at address
    leadArmBentWarn: 150, // elbow interior angle below this = bent
    shoulderTurnRatioWarn: 0.75, // shoulder width at top / address above this = restricted turn
    hipSlideMax: 0.12, // lead hip beyond lead ankle (toward target) at impact
    handsBehindWarn: 0.05, // hands behind address position at impact
    trailArmBentWarn: 145,
    finishHipOverLead: 0.35, // hip centre must be within this fraction of stance from the lead ankle
  },
};

// MediaPipe Pose landmark indices.
export const LM = {
  nose: 0,
  lShoulder: 11, rShoulder: 12,
  lElbow: 13, rElbow: 14,
  lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24,
  lKnee: 25, rKnee: 26,
  lAnkle: 27, rAnkle: 28,
  lHeel: 29, rHeel: 30,
  lFoot: 31, rFoot: 32,
};

// Lead/trail side mapping for a golfer. Right-handed golfers lead with the left side.
export function sides(handedness) {
  const rh = handedness !== 'left';
  return rh
    ? { shoulder: [LM.lShoulder, LM.rShoulder], elbow: [LM.lElbow, LM.rElbow], wrist: [LM.lWrist, LM.rWrist],
        hip: [LM.lHip, LM.rHip], knee: [LM.lKnee, LM.rKnee], ankle: [LM.lAnkle, LM.rAnkle], heel: [LM.lHeel, LM.rHeel] }
    : { shoulder: [LM.rShoulder, LM.lShoulder], elbow: [LM.rElbow, LM.lElbow], wrist: [LM.rWrist, LM.lWrist],
        hip: [LM.rHip, LM.lHip], knee: [LM.rKnee, LM.lKnee], ankle: [LM.rAnkle, LM.lAnkle], heel: [LM.rHeel, LM.lHeel] };
}
