// Static reference data for the 10 P-positions and the tunable thresholds
// used by detection (detect.js) and feedback (analyze.js).
//
// Notes are club-specific. The driver is swept up off a tee from a wide, tilted
// setup with the ball forward; the 7-iron is struck down (ball, then turf) from a
// centred setup with a near-neutral spine and the hands ahead. Sources: MyGolfSpy,
// Golf Monthly, HackMotion, GOLFTEC, Performance Golf, Rotary Swing, Golf Digest.

export const CLUB_IDS = ['driver', 'iron7'];

export const POSITIONS = [
  {
    id: 'P1',
    name: 'Address',
    clubs: {
      driver: {
        summary: 'Wide, tilted setup for an upward strike: ball just inside the lead heel, spine tilted away from the target.',
        checkpoints: [
          'Ball just inside the lead heel, teed so about half the ball sits above the crown',
          'Stance a little wider than shoulder width',
          'Spine tilted away from the target about 5–15°; trail shoulder clearly lower than the lead (face-on)',
          'Weight even, or slightly favouring the trail foot',
          'Shaft close to vertical: hands level with or just ahead of the ball, not pressed forward',
          'Forward bend from the hips about 30–40°, a touch taller than with an iron (down-the-line)',
        ],
      },
      iron7: {
        summary: 'Balanced, centred setup to strike down on the ball: ball in the middle of the stance, spine close to neutral.',
        checkpoints: [
          'Ball in the middle of the stance, or up to a ball-width forward',
          'Stance about shoulder width',
          'Spine close to neutral side-to-side; shoulders nearly level, trail only slightly lower (face-on)',
          'Weight even, or slightly on the lead foot (about 50–55%)',
          'Hands slightly ahead of the ball, so the lead arm and shaft form roughly a straight line',
          'Forward bend from the hips about 35–45°, slightly more bent over than with a driver (down-the-line)',
        ],
      },
    },
  },
  {
    id: 'P2',
    name: 'Takeaway — shaft parallel',
    clubs: {
      driver: {
        summary: 'Low, wide takeaway: arms, hands and club move back together until the shaft is parallel to the ground.',
        checkpoints: [
          'Club moves back low and wide; hands stay in front of the chest',
          'Shaft roughly over the hands and parallel to the target line, not whipped inside',
          'Clubface roughly matching the spine angle (toe slightly down, not wide open)',
          'Lead wrist close to neutral; spine tilt from address held, no early lift',
        ],
      },
      iron7: {
        summary: 'Compact one-piece takeaway: shoulders turn the arms and club back until the shaft is parallel to the ground.',
        checkpoints: [
          'Hands around hip height with the shaft over the hands, parallel to the target line',
          'Clubface roughly matching the spine angle (toe slightly down, not wide open)',
          'Weight stays centred; head steady over the ball',
          'Spine angle held, no early lift',
        ],
      },
    },
  },
  {
    id: 'P3',
    name: 'Lead arm parallel — backswing',
    clubs: {
      driver: {
        summary: 'Lead arm parallel to the ground on a wide arc; wrists hinged so the shaft points roughly straight up.',
        checkpoints: [
          'Lead arm extended for width',
          'Shoulders turned about 60–75°; pressure moving into the trail foot',
          'Head may drift slightly behind the ball, but the trail hip stays inside the trail foot',
          'Shaft about 90° to the lead arm',
        ],
      },
      iron7: {
        summary: 'Lead arm parallel to the ground; wrists hinged so the shaft is roughly vertical, 90° to the lead arm.',
        checkpoints: [
          'Lead arm fairly straight',
          'Shoulders turned about 60–75°, hips about 30–45°',
          'Head stays centred over the ball; no lateral sway',
        ],
      },
    },
  },
  {
    id: 'P4',
    name: 'Top of the backswing',
    clubs: {
      driver: {
        summary: 'Full turn with the club about parallel to the ground, pointing at the target; weight loaded into the trail side.',
        checkpoints: [
          'Shoulders turned about 90°, hips about 45°',
          'Club near parallel to the ground; lead wrist flat to slightly bowed',
          'Most pressure on the trail foot, with the trail hip still inside the trail foot',
          'Head behind the ball; trail knee keeps some flex',
        ],
      },
      iron7: {
        summary: 'Full but controlled turn with the club at or just short of parallel; a centred pivot over the ball.',
        checkpoints: [
          'Shoulders turned about 90°, hips about 40–45°',
          'Club at or just short of parallel; lead wrist flat to slightly bowed',
          'Pressure into the trail side without swaying; head roughly over the ball',
          'Spine angle from address maintained; trail knee keeps some flex',
        ],
      },
    },
  },
  {
    id: 'P5',
    name: 'Lead arm parallel — downswing',
    clubs: {
      driver: {
        summary: 'Shift and shallow: pressure moves into the lead foot while the hands drop and the club shallows behind them.',
        checkpoints: [
          'Lower body starts the downswing; hips shifting toward the target',
          'Hands below the shoulder plane; club shallowing, not over the top',
          'Wrist hinge still held',
          'Spine still tilted away from the target; head behind the ball',
        ],
      },
      iron7: {
        summary: 'Pressure shifts into the lead foot early so the low point of the swing moves ahead of the ball; lag held.',
        checkpoints: [
          'Hips shift toward the target before they turn',
          'Hands drop onto plane, below the shoulder plane, not over the top',
          'Wrist hinge retained; club still well above the hands',
        ],
      },
    },
  },
  {
    id: 'P6',
    name: 'Shaft parallel — downswing',
    clubs: {
      driver: {
        summary: 'Shaft parallel before impact with lag held and the club approaching from the inside on a shallow path.',
        checkpoints: [
          'Hands in front of the trail thigh; clubhead still behind the hands',
          'Hips open about 20–30°, chest still slightly closed',
          'Head stays behind the ball; spine tilt held',
          'Hip depth kept (no early extension)',
        ],
      },
      iron7: {
        summary: 'Shaft parallel before impact, hands ahead of the clubhead and pressure already on the lead side.',
        checkpoints: [
          'Hands in front of the trail thigh, lag preserved',
          'Hips open about 20–30°, chest still slightly closed',
          'Most pressure on the lead foot',
          'Spine angle and hip depth maintained (no early extension)',
        ],
      },
    },
  },
  {
    id: 'P7',
    name: 'Impact',
    clubs: {
      driver: {
        summary: 'Hit up on the ball: head behind it, spine tilted back, shaft close to vertical, hips open.',
        checkpoints: [
          'Shaft roughly vertical, at most a little forward lean; hands level with or just ahead of the ball',
          'Head well behind the ball; spine tilted away from the target, more than with an iron',
          'Hips open about 35–45°, shoulders near square; most weight on the lead foot',
          'Sweep the ball up off the tee with a level-to-upward strike, no divot',
        ],
      },
      iron7: {
        summary: 'Ball first, then turf: hands ahead of the ball with forward shaft lean and weight on the lead side.',
        checkpoints: [
          'Hands ahead of the ball, over the lead thigh; shaft leaning toward the target',
          'About 70–80% or more of the weight on the lead foot',
          'Hips open about 35–45°, shoulders near square',
          'Head over or just behind the ball; descending strike with the divot starting after the ball',
        ],
      },
    },
  },
  {
    id: 'P8',
    name: 'Shaft parallel — follow-through',
    clubs: {
      driver: {
        summary: 'Shaft parallel past impact with both arms extending out and up as the body keeps rotating.',
        checkpoints: [
          'Both arms extended (no chicken wing)',
          'Chest rotating toward the target; head still behind where the ball was',
          'Posture held through the strike',
        ],
      },
      iron7: {
        summary: 'Shaft parallel past impact with both arms extended low down the target line.',
        checkpoints: [
          'Both arms extended (no chicken wing); club stays low for longer after the strike',
          'Chest rotating toward the target',
          'Posture maintained through the ball',
        ],
      },
    },
  },
  {
    id: 'P9',
    name: 'Trail arm parallel — follow-through',
    clubs: {
      driver: {
        summary: 'Trail arm parallel to the ground, club hinging back up as the chest rises and keeps rotating.',
        checkpoints: [
          'Trail arm straight and parallel to the ground',
          'Chest facing the target or beyond, starting to rise',
          'Weight mostly on the lead foot; trail heel coming up',
        ],
      },
      iron7: {
        summary: 'Trail arm parallel to the ground, club hinged back up; body still rotating with the chest fairly level.',
        checkpoints: [
          'Trail arm straight and parallel to the ground',
          'Chest facing the target or beyond',
          'Weight mostly on the lead foot; trail heel coming up',
        ],
      },
    },
  },
  {
    id: 'P10',
    name: 'Finish',
    clubs: {
      driver: {
        summary: 'Tall, full finish: chest high and facing the target, weight on the lead foot, balanced.',
        checkpoints: [
          'Hips over the lead foot, trail foot up on its toe',
          'Chest and belt buckle facing the target, chest higher than with an iron',
          'Balanced long enough to hold the pose for three seconds',
        ],
      },
      iron7: {
        summary: 'Balanced, fully rotated finish: belt buckle to the target, weight on the lead foot, standing tall.',
        checkpoints: [
          'Hips over the lead foot, trail foot up on its toe',
          'Chest and belt buckle facing the target',
          'Balanced long enough to hold the pose for three seconds',
        ],
      },
    },
  },
];

export const CLUB_LABELS = { driver: 'Driver', iron7: '7-Iron' };

/** Summary and checkpoints for position p (0-based) with the given club. */
export function clubText(p, club = 'driver') {
  return POSITIONS[p].clubs[club] || POSITIONS[p].clubs.driver;
}

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
    shoulderTiltMax: 20,
    leadArmBentWarn: 150, // elbow interior angle below this = bent
    shoulderTurnRatioWarn: 0.75, // shoulder width at top / address above this = restricted turn
    hipSlideMax: 0.12, // lead hip beyond lead ankle (toward target) at impact
    handsBehindWarn: 0.05, // hands behind address position at impact
    impactTiltMin: 0, // spine tilt away from the target at impact, degrees
    impactTiltMax: 30,
    trailArmBentWarn: 145,
    finishHipOverLead: 0.35, // hip centre must be within this fraction of stance from the lead ankle
  },

  // Club-specific overrides of the values above.
  clubs: {
    driver: {
      // Taller, wider setup; tilted away from the target; shaft near vertical at impact.
      dtl: { spineMin: 25, spineMax: 42, handsReachWarn: 0.32 },
      faceOn: { shoulderTiltMin: 3, shoulderTiltMax: 18, handsBehindWarn: 0.15, impactTiltMin: 5, impactTiltMax: 35, headAheadWarn: 0.06 },
    },
    iron7: {
      // Centred setup, shoulders nearly level; hands must lead at impact.
      dtl: { spineMin: 30, spineMax: 48, handsReachWarn: 0.25 },
      faceOn: { shoulderTiltMin: 0, shoulderTiltMax: 12, handsBehindWarn: 0.03, impactTiltMin: 0, impactTiltMax: 28, headAheadWarn: 0.1 },
    },
  },
};

/** Thresholds for a camera view ('dtl' | 'face') and club, with club overrides applied. */
export function thresholds(view, club = 'driver') {
  const key = view === 'dtl' ? 'dtl' : 'faceOn';
  return { ...CONFIG[key], ...((CONFIG.clubs[club] || CONFIG.clubs.driver)[key]) };
}

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
