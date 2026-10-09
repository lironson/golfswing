// MediaPipe Pose Landmarker wrapper + frame-by-frame video sampling.
// Everything runs locally in the browser; the video never leaves the device.

const MP_VERSION = '0.10.21';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

const landmarkers = {};
let lastTimestamp = 0;

/** Pose landmarker for 'VIDEO' (frame sequences) or 'IMAGE' (single photos), created once per mode. */
export function getLandmarker(mode = 'VIDEO') {
  if (!landmarkers[mode]) {
    landmarkers[mode] = createLandmarker(mode).catch((err) => {
      delete landmarkers[mode];
      throw err;
    });
  }
  return landmarkers[mode];
}

async function createLandmarker(runningMode) {
  const { FilesetResolver, PoseLandmarker } = await import(`${MP_BASE}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode,
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

/** Detect the golfer in a single image. Returns normalised landmarks or null. */
export async function detectImage(source) {
  const landmarker = await getLandmarker('IMAGE');
  const res = landmarker.detect(source);
  return res.landmarks && res.landmarks[0]
    ? res.landmarks[0].map((p) => ({ x: p.x, y: p.y, visibility: p.visibility ?? 1 }))
    : null;
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
  const landmarker = await getLandmarker('VIDEO');
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

/** True when the browser can hand over each decoded frame during playback (all current browsers). */
export const canCaptureFrames = () =>
  typeof HTMLVideoElement !== 'undefined' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

/**
 * Run pose detection on every frame between start and end (seconds) in one pass.
 * Instead of seeking to each sample (slow: every seek decodes from the last keyframe),
 * the video plays muted and pauses on each new frame while it is analysed, so no frame
 * is skipped however long detection takes.
 * @returns {Promise<Array<{t:number, lm:Array|null}>>} t is the frame's own media time.
 */
export async function captureFrames(video, { start = 0, end = video.duration, maxSide = 640, onProgress, isCancelled } = {}) {
  const landmarker = await getLandmarker('VIDEO');
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const g = canvas.getContext('2d', { willReadFrequently: true });

  video.pause();
  video.muted = true;
  video.playbackRate = 1; // faster playback skips frames between pauses
  await seek(video, start);
  const base = lastTimestamp + 1000; // detectForVideo timestamps must keep increasing across runs
  const frames = [];
  let lastT = -Infinity;

  const analyse = (t) => {
    lastT = t;
    g.drawImage(video, 0, 0, canvas.width, canvas.height);
    lastTimestamp = base + (t - start) * 1000;
    const res = landmarker.detectForVideo(canvas, lastTimestamp);
    frames.push({
      t,
      lm: res.landmarks && res.landmarks[0]
        ? res.landmarks[0].map((p) => ({ x: p.x, y: p.y, visibility: p.visibility ?? 1 }))
        : null,
    });
    if (onProgress) onProgress(Math.min(1, (t - start) / Math.max(1e-3, end - start)));
  };

  return new Promise((resolve, reject) => {
    let handle = 0, watchdog = 0, done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(watchdog);
      video.cancelVideoFrameCallback(handle);
      video.removeEventListener('ended', onEnded);
      video.pause();
      if (err) reject(err);
      else resolve(frames);
    };
    const onEnded = () => finish();
    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => finish(new Error('Video playback stalled. Keep this tab open in front while the swing is analysed.')), 5000);
    };
    const resume = () => {
      armWatchdog();
      handle = video.requestVideoFrameCallback(onFrame);
      video.play().catch((err) => finish(err));
    };

    function onFrame(_now, meta) {
      if (done) return;
      video.pause();
      if (isCancelled && isCancelled()) { finish(new Error('cancelled')); return; }
      const t = meta.mediaTime;
      if (t > end + 1e-3) { finish(); return; }
      try {
        if (t > lastT + 1e-4) analyse(t);
      } catch (err) { finish(err); return; }
      resume();
    }

    video.addEventListener('ended', onEnded);
    try {
      analyse(video.currentTime); // the frame already on screen won't trigger a callback
    } catch (err) { finish(err); return; }
    resume();
  });
}
