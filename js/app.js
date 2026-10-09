// UI wiring and app state.

import { POSITIONS, CLUB_LABELS, clubText } from './positions.js';
import { getLandmarker, processVideo, captureFrames, canCaptureFrames, grabFrame } from './pose.js';
import { prepareFrames, detectPositions, guessView, orientation } from './detect.js';
import { analyzePosition, cardStatus, summarize } from './analyze.js';
import { drawFrame } from './overlay.js';
import { clamp } from './geometry.js';
import { cardCanvas, contactSheet, saveCanvas } from './export.js';
import { initPhotos } from './photos.js';
import { renderChecks, renderReadouts, renderLegend as renderSharedLegend } from './ui.js';

const $ = (sel) => document.querySelector(sel);
const video = $('#video');

const state = {
  url: null,
  range: { start: 0, end: 0 },
  raw: null,
  pts: null,
  times: null,
  width: 0,
  height: 0,
  handedness: 'right',
  club: 'driver',
  viewChoice: 'auto',
  view: 'face',
  viewGuess: null,
  autoIdx: null,
  confidence: null,
  idx: null,
  orient: null,
  results: [],
  frameCache: new Map(),
  showOverlay: true,
  cancelled: false,
  cards: [],
};

// ---------- Mode: video or photos ----------

// Set to false to hide the Video | Photos toggle and offer photos only.
const VIDEO_ENABLED = true;

// Longest stretch of video analysed. A swing takes under 2 s, and a short window keeps analysis quick.
const MAX_CLIP_SECONDS = 5;

const mode = () => document.querySelector('input[name="mode"]:checked').value;

function applyMode() {
  const photos = mode() === 'photos';
  $('#photos-section').hidden = !photos;
  if (photos) {
    video.pause();
    ['#upload-section', '#setup-section', '#progress-section', '#results-section'].forEach((s) => { $(s).hidden = true; });
    hideError();
    initPhotos();
  } else {
    show(currentStep);
  }
}

document.querySelectorAll('input[name="mode"]').forEach((el) => el.addEventListener('change', applyMode));

// ---------- Step 1: choose a video ----------

const fileInput = $('#file-input');
const dropzone = $('#dropzone');
fileInput.addEventListener('change', () => fileInput.files[0] && loadFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) loadFile(file);
});

function loadFile(file) {
  hideError();
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(file.name)) {
    showError('That file does not look like a video.');
    return;
  }
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(file);
  state.frameCache.clear();
  video.src = state.url;
  video.addEventListener('loadedmetadata', () => {
    setupWindow();
    show('setup');
  }, { once: true });
  video.addEventListener('error', () => {
    showError('This browser cannot play that video format. Try an MP4 (H.264) — on iPhone choose "Most Compatible" in Camera settings, or open the app in Safari.');
    show('upload');
  }, { once: true });
}

// ---------- Step 2: setup ----------

// Clips up to MAX_CLIP_SECONDS are analysed whole; for longer ones the user slides a window over the swing.
const windowStart = $('#window-start');

function setupWindow() {
  const long = video.duration > MAX_CLIP_SECONDS;
  $('#window-picker').hidden = !long;
  $('#window-hint').textContent = long
    ? `Only ${MAX_CLIP_SECONDS} seconds is analysed. Slide the window so it covers your swing, from address to the finish.`
    : 'The whole clip is analysed.';
  windowStart.max = long ? (video.duration - MAX_CLIP_SECONDS).toFixed(2) : 0;
  setWindow(0);
}

function setWindow(start) {
  start = clamp(start, 0, Math.max(0, video.duration - MAX_CLIP_SECONDS));
  state.range = { start, end: Math.min(video.duration, start + MAX_CLIP_SECONDS) };
  windowStart.value = start;
  updateRangeLabel();
}

windowStart.addEventListener('input', () => {
  setWindow(Number(windowStart.value));
  video.pause();
  video.currentTime = state.range.start; // preview where the window starts
});
$('#set-start').addEventListener('click', () => setWindow(video.currentTime));
$('#change-video').addEventListener('click', () => { fileInput.value = ''; show('upload'); });
$('#new-video').addEventListener('click', () => { fileInput.value = ''; show('upload'); window.scrollTo(0, 0); });

function updateRangeLabel() {
  const { start, end } = state.range;
  $('#range-label').textContent = `${start.toFixed(2)}s – ${end.toFixed(2)}s (${(end - start).toFixed(1)}s)`;
}

$('#analyze-btn').addEventListener('click', analyze);
$('#cancel-btn').addEventListener('click', () => { state.cancelled = true; });

async function analyze() {
  hideError();
  state.handedness = document.querySelector('input[name="hand"]:checked').value;
  state.club = document.querySelector('input[name="club"]:checked').value;
  state.viewChoice = document.querySelector('input[name="view"]:checked').value;
  state.cancelled = false;
  video.pause();
  show('progress');
  setProgress(0, 'Loading pose model (first run downloads ~15 MB)…');

  try {
    await getLandmarker('VIDEO');
    const { start, end } = state.range;
    const isCancelled = () => state.cancelled;
    const onProgress = (f) => setProgress(f, `Detecting body positions… ${Math.round(f * 100)}%`);
    setProgress(0, 'Detecting body positions…');
    const frames = canCaptureFrames()
      ? await captureFrames(video, { start, end, isCancelled, onProgress })
      : await processVideo(video, { start, end, fps: 30, isCancelled, onProgress });
    if (frames.length < 10) {
      throw new Error(`Only ${frames.length} frames could be read from this video. Try an MP4 (H.264), or open the app in another browser.`);
    }
    const found = frames.filter((f) => f.lm).length;
    if (found < frames.length * 0.4) {
      throw new Error(`A person was only detected in ${found} of ${frames.length} frames. Make sure your whole body is in view and well lit.`);
    }

    state.raw = frames;
    state.times = frames.map((f) => f.t);
    state.width = video.videoWidth;
    state.height = video.videoHeight;
    state.frameCache.clear();
    runDetection();
    show('results');
    await renderAll();
    $('#results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    if (err && err.message === 'cancelled') { show('setup'); return; }
    console.error(err);
    showError(err && err.message ? err.message : String(err));
    show('setup');
  }
}

// ---------- Detection + analysis ----------

function runDetection() {
  state.pts = prepareFrames(state.raw, state.width, state.height);
  const det = detectPositions(state.pts, state.times, state.handedness);
  state.autoIdx = det.indices.slice();
  state.confidence = det.confidence;
  state.idx = det.indices.slice();
  state.viewGuess = guessView(state.pts, state.idx[0]);
  state.view = state.viewChoice === 'auto' ? state.viewGuess.view : state.viewChoice;
  $('#result-view').value = state.view;
  $('#result-hand').value = state.handedness;
  $('#result-club').value = state.club;
  updateViewNote();
  analyzeAll();
}

function ctx() {
  return { pts: state.pts, idx: state.idx, handedness: state.handedness, view: state.view, club: state.club, orient: state.orient };
}

function analyzeAll() {
  state.orient = orientation(state.pts, state.idx[0], state.handedness);
  state.results = POSITIONS.map((_, p) => analyzePosition(p, state.idx[p], ctx()));
}

function updateViewNote() {
  const name = (v) => (v === 'dtl' ? 'down-the-line' : 'face-on');
  const g = state.viewGuess;
  const unsure = state.confidence.filter((ok) => !ok).length;
  $('#view-note').textContent = (state.viewChoice === 'auto'
    ? `Camera angle auto-detected as ${name(g.view)}. Change it above if that's wrong.`
    : `Analysed as ${name(state.view)} (auto-detect suggested ${name(g.view)}).`)
    + (unsure ? ` ${unsure} of the 10 positions are best guesses: check those frames and nudge them with ◀ ▶ if needed.` : '');
}

$('#result-view').addEventListener('change', async (e) => {
  state.view = e.target.value;
  state.viewChoice = state.view;
  updateViewNote();
  analyzeAll();
  await renderAll();
});
$('#result-club').addEventListener('change', async (e) => {
  state.club = e.target.value;
  updateCardClubText();
  analyzeAll();
  await renderAll();
});
$('#result-hand').addEventListener('change', async (e) => {
  state.handedness = e.target.value;
  runDetection();
  await renderAll();
});
$('#overlay-toggle').addEventListener('change', async (e) => {
  state.showOverlay = e.target.checked;
  for (let p = 0; p < 10; p++) await drawCard(p);
});

// ---------- Rendering ----------

async function frameImage(i) {
  if (state.frameCache.has(i)) return state.frameCache.get(i);
  const img = await grabFrame(video, state.times[i] + 0.001); // just inside the frame, not on its edge
  state.frameCache.set(i, img);
  if (state.frameCache.size > 60) state.frameCache.delete(state.frameCache.keys().next().value);
  return img;
}

function buildCards() {
  const wrap = $('#cards');
  wrap.innerHTML = '';
  const tpl = $('#card-template');
  state.cards = POSITIONS.map((pos, p) => {
    const el = tpl.content.firstElementChild.cloneNode(true);
    el.id = `card-${pos.id}`;
    el.querySelector('.card-title').textContent = `${pos.id} · ${pos.name}`;
    const slider = el.querySelector('.frame-slider');
    el.querySelector('.prev').addEventListener('click', () => nudge(p, state.idx[p] - 1));
    el.querySelector('.next').addEventListener('click', () => nudge(p, state.idx[p] + 1));
    el.querySelector('.reset').addEventListener('click', () => nudge(p, state.autoIdx[p]));
    slider.addEventListener('input', () => nudge(p, Number(slider.value)));
    el.querySelector('.download').addEventListener('click', () => downloadCard(p));
    wrap.appendChild(el);
    return el;
  });
}

// Summary and checkpoints for the selected club on each card.
function updateCardClubText() {
  state.cards.forEach((el, p) => {
    const t = clubText(p, state.club);
    el.querySelector('.card-summary').textContent = t.summary;
    const cp = el.querySelector('.checkpoints ul');
    cp.innerHTML = '';
    t.checkpoints.forEach((c) => { const li = document.createElement('li'); li.textContent = c; cp.appendChild(li); });
  });
}

async function renderAll() {
  if (!state.cards.length) buildCards();
  updateCardClubText();
  renderSummary();
  renderLegend();
  for (let p = 0; p < 10; p++) {
    updateCardText(p);
    await drawCard(p);
  }
}

function updateCardText(p) {
  const el = state.cards[p];
  const res = state.results[p];
  const i = state.idx[p];
  const slider = el.querySelector('.frame-slider');
  const span = Math.max(15, Math.round(state.times.length * 0.08));
  slider.min = Math.max(0, state.autoIdx[p] - span);
  slider.max = Math.min(state.times.length - 1, state.autoIdx[p] + span);
  slider.value = i;
  const off = i - state.autoIdx[p];
  const unsure = !off && !state.confidence[p];
  const info = el.querySelector('.frame-info');
  info.classList.toggle('unsure', unsure);
  info.textContent = `${state.times[i].toFixed(2)}s · frame ${i + 1}/${state.times.length}${
    off ? ` · ${off > 0 ? '+' : ''}${off} from auto` : unsure ? ' · best guess, check this frame' : ' · auto-detected'}`;

  renderChecks(el.querySelector('.checks'), res.checks.length ? res.checks
    : [{ status: 'info', title: 'Reference position', detail: 'Compare your frame with the ideal checkpoints below.' }]);
  renderReadouts(el.querySelector('.metrics'), res.metrics);
}

async function drawCard(p) {
  const el = state.cards[p];
  const i = state.idx[p];
  const img = await frameImage(i);
  if (state.idx[p] !== i) return; // a newer nudge superseded this draw
  const res = state.results[p];
  drawFrame(el.querySelector('canvas'), img, {
    srcW: state.width, srcH: state.height, ctx: ctx(), p, frameIndex: i,
    showOverlay: state.showOverlay,
    title: `${POSITIONS[p].id} · ${POSITIONS[p].name} · ${CLUB_LABELS[state.club]}`,
    status: res.checks.length ? cardStatus(res.checks) : null,
  });
}

async function nudge(p, i) {
  i = clamp(i, 0, state.times.length - 1);
  if (i === state.idx[p]) return;
  state.idx[p] = i;
  if (p === 0) {
    // Address is the reference for every other position: re-analyse everything.
    analyzeAll();
    renderSummary();
    for (let q = 0; q < 10; q++) updateCardText(q);
    for (let q = 0; q < 10; q++) await drawCard(q);
  } else {
    state.results[p] = analyzePosition(p, i, ctx());
    renderSummary();
    updateCardText(p);
    await drawCard(p);
  }
}

function renderSummary() {
  const { top, warnCount, goodCount } = summarize(state.results, 3);
  const body = $('#summary-body');
  body.innerHTML = '';
  if (!top.length) {
    const p = document.createElement('p');
    p.className = 'summary-line';
    p.textContent = 'No major issues flagged. Check each position against its checkpoints below.';
    body.appendChild(p);
  } else {
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'Top priorities';
    const ul = document.createElement('ul');
    ul.className = 'todo';
    top.forEach((c) => {
      const li = document.createElement('li');
      const tag = document.createElement('span'); tag.className = 'p'; tag.textContent = POSITIONS[c.p].id;
      const t = document.createElement('strong'); t.textContent = c.title;
      const go = document.createElement('button');
      go.type = 'button'; go.className = 'text-btn'; go.textContent = `Go to ${POSITIONS[c.p].id} →`;
      go.addEventListener('click', () => {
        const card = state.cards[c.p];
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.classList.add('flash');
        setTimeout(() => card.classList.remove('flash'), 1500);
      });
      const d = document.createElement('span'); d.className = 'detail'; d.textContent = c.detail;
      li.append(tag, t, go, d);
      ul.appendChild(li);
    });
    body.append(label, ul);
  }
  const tally = document.createElement('div');
  tally.className = 'tally';
  tally.innerHTML = `<span><b>${goodCount}</b> GOOD</span><span><b>${warnCount}</b> TO WORK ON</span>`;
  body.appendChild(tally);
}

function renderLegend() {
  renderSharedLegend($('#legend-list'), state.view);
}

// ---------- Downloads ----------

function downloadCard(p) {
  saveCanvas(cardCanvas(state.cards[p].querySelector('canvas'), state.results[p].checks), `swing-${POSITIONS[p].id}.png`);
}

$('#download-all').addEventListener('click', () => {
  saveCanvas(contactSheet(state.cards.map((el) => el.querySelector('canvas'))), 'swing-p1-p10.png');
});

// ---------- Helpers ----------

let currentStep = 'upload';

function show(step) {
  currentStep = step;
  if (mode() !== 'video') return;
  $('#upload-section').hidden = step !== 'upload';
  $('#setup-section').hidden = step !== 'setup';
  $('#progress-section').hidden = step !== 'progress';
  $('#results-section').hidden = step !== 'results';
}

function setProgress(f, text) {
  $('#progress-bar').style.width = `${Math.round(f * 100)}%`;
  if (text) $('#progress-text').textContent = text;
}

function showError(msg) { const e = $('#error'); e.textContent = msg; e.hidden = false; }
function hideError() { $('#error').hidden = true; }

// ---------- Dark mode (saved per browser; applied before first paint in index.html) ----------

const darkToggle = $('#dark-toggle');
darkToggle.checked = document.documentElement.dataset.theme === 'dark';
darkToggle.addEventListener('change', () => {
  const theme = darkToggle.checked ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* storage blocked: theme lasts this visit */ }
});

if (VIDEO_ENABLED) {
  $('#mode-toggle').hidden = false;
  $('#mode-video').checked = true;
}
applyMode();

// Expose state for debugging in the console.
window.__swing = state;
