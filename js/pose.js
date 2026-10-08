// MediaPipe Pose Landmarker wrapper + frame-by-frame video sampling.
// Everything runs locally in the browser; the video never leaves the device.

const MP_VERSION = '0.10.21';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

let landmarkerPromise = null;
let lastTimestamp = 0;

export function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

async function createLandmarker() {
  const { FilesetResolver, PoseLandmarker } = await import(`${MP_BASE}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  try {
    return await PoseLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (err) {
    console.warn('GPU delegate unavailable, falling back to CPU.', err);
    return PoseLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

// All seeks go through one queue so concurrent requests never fight over currentTime.
let seekChain = Promise.resolve();

function seekRaw(video, t) {
  return new Promise((resolve) => {
    const target = Math.max(0, Math.min(t, (video.duration || t) - 1e-3));
    if (Math.abs(video.currentTime - target) < 1e-4 && video.readyState >= 2) {
      requestAnimationFrame(() => resolve());
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', finish);
      resolve();
    };
    video.addEventListener('seeked', finish);
    setTimeout(finish, 3000); // never hang on a stubborn decoder
    video.currentTime = target;
  });
}

export function seek(video, t) {
  const p = seekChain.then(() => seekRaw(video, t));
  seekChain = p.catch(() => {});
  return p;
}

/** Copy the frame at time t into a new canvas (capped at maxSide pixels on the long edge). */
export async function grabFrame(video, t, maxSide = 1280) {
  const run = async () => {
    await seekRaw(video, t);
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(video.videoWidth * scale);
    c.height = Math.round(video.videoHeight * scale);
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    return c;
  };
  const p = seekChain.then(run);
  seekChain = p.catch(() => {});
  return p;
}

/**
 * Run pose detection on frames between start and end (seconds) at `fps` samples/second.
 * @returns {Promise<Array<{t:number, lm:Array|null}>>}
 */
export async function processVideo(video, { start = 0, end = video.duration, fps = 60, onProgress, isCancelled } = {}) {
  const landmarker = await getLandmarker();
  const step = 1 / fps;
  const times = [];
  for (let t = start; t <= end + 1e-6; t += step) times.push(+t.toFixed(4));

  const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const g = canvas.getContext('2d', { willReadFrequently: true });

  const frames = [];
  for (let i = 0; i < times.length; i++) {
    if (isCancelled && isCancelled()) throw new Error('cancelled');
    await seek(video, times[i]);
    g.drawImage(video, 0, 0, canvas.width, canvas.height);
    lastTimestamp = Math.max(lastTimestamp + 1, performance.now());
    const res = landmarker.detectForVideo(canvas, lastTimestamp);
    const lm = res.landmarks && res.landmarks[0]
      ? res.landmarks[0].map((p) => ({ x: p.x, y: p.y, visibility: p.visibility ?? 1 }))
      : null;
    frames.push({ t: times[i], lm });
    if (onProgress) onProgress((i + 1) / times.length);
  }
  return frames;
}
