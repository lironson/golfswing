// UI wiring and app state.

import { POSITIONS } from './positions.js';
import { getLandmarker, processVideo, grabFrame } from './pose.js';
import { prepareFrames, detectPositions, guessView, orientation } from './detect.js';
import { analyzePosition, cardStatus, summarize } from './analyze.js';
import { drawFrame, COLORS } from './overlay.js';
import { clamp } from './geometry.js';

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
  viewChoice: 'auto',
  view: 'face',
  viewGuess: null,
  autoIdx: null,
  idx: null,
  orient: null,
  results: [],
  frameCache: new Map(),
  showOverlay: true,
  cancelled: false,
  cards: [],
};

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
    state.range = { start: 0, end: video.duration };
    updateRangeLabel();
    show('setup');
  }, { once: true });
  video.addEventListener('error', () => {
    showError('This browser cannot play that video format. Try an MP4 (H.264) — on iPhone choose "Most Compatible" in Camera settings, or open the app in Safari.');
    show('upload');
  }, { once: true });
}

// ---------- Step 2: setup ----------

$('#set-start').addEventListener('click', () => {
  state.range.start = Math.min(video.currentTime, state.range.end - 0.2);
  updateRangeLabel();
});
$('#set-end').addEventListener('click', () => {
  state.range.end = Math.max(video.currentTime, state.range.start + 0.2);
  updateRangeLabel();
});
$('#reset-range').addEventListener('click', () => {
  state.range = { start: 0, end: video.duration };
  updateRangeLabel();
});
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
  state.viewChoice = document.querySelector('input[name="view"]:checked').value;
  const fps = Number($('#fps-select').value);
  state.cancelled = false;
  video.pause();
  show('progress');
  setProgress(0, 'Loading pose model (first run downloads ~15 MB)…');

  try {
    await getLandmarker();
    let { start, end } = state.range;
    const isCancelled = () => state.cancelled;

    // Long clip: quick coarse scan to find the swing, then analyse just that window in detail.
    if (end - start > 6) {
      setProgress(0, 'Scanning the clip for your swing…');
      const coarse = await processVideo(video, {
        start, end, fps: 8, isCancelled,
        onProgress: (f) => setProgress(f * 0.3, 'Scanning the clip for your swing…'),
      });
      try {
        const pts = prepareFrames(coarse, video.videoWidth, video.videoHeight, 1);
        const { indices } = detectPositions(pts, coarse.map((f) => f.t), state.handedness);
        start = Math.max(start, coarse[indices[0]].t - 1.0);
        end = Math.min(end, coarse[indices[9]].t + 1.0);
      } catch (e) {
        console.warn('Coarse scan failed, analysing the full range.', e);
      }
    }

    const base = state.range.end - state.range.start > 6 ? 0.3 : 0;
    const frames = await processVideo(video, {
      start, end, fps, isCancelled,
      onProgress: (f) => setProgress(base + f * (1 - base), `Detecting body positions… ${Math.round(f * 100)}%`),
    });
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
  state.idx = det.indices.slice();
  state.viewGuess = guessView(state.pts, state.idx[0]);
  state.view = state.viewChoice === 'auto' ? state.viewGuess.view : state.viewChoice;
  $('#result-view').value = state.view;
  $('#result-hand').value = state.handedness;
  updateViewNote();
  analyzeAll();
}

function ctx() {
  return { pts: state.pts, idx: state.idx, handedness: state.handedness, view: state.view, orient: state.orient };
}

function analyzeAll() {
  state.orient = orientation(state.pts, state.idx[0], state.handedness);
  state.results = POSITIONS.map((_, p) => analyzePosition(p, state.idx[p], ctx()));
}

function updateViewNote() {
  const name = (v) => (v === 'dtl' ? 'down-the-line' : 'face-on');
  const g = state.viewGuess;
  $('#view-note').textContent = state.viewChoice === 'auto'
    ? `Camera angle auto-detected as ${name(g.view)}. Change it above if that's wrong.`
    : `Analysed as ${name(state.view)} (auto-detect suggested ${name(g.view)}).`;
}

$('#result-view').addEventListener('change', async (e) => {
  state.view = e.target.value;
  state.viewChoice = state.view;
  updateViewNote();
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
  const img = await grabFrame(video, state.times[i]);
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
    el.querySelector('.card-summary').textContent = pos.summary;
    const cp = el.querySelector('.checkpoints ul');
    pos.checkpoints.forEach((t) => { const li = document.createElement('li'); li.textContent = t; cp.appendChild(li); });
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

async function renderAll() {
  if (!state.cards.length) buildCards();
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
  el.querySelector('.frame-info').textContent =
    `${state.times[i].toFixed(2)}s · frame ${i + 1}/${state.times.length}${off ? ` · ${off > 0 ? '+' : ''}${off} from auto` : ' · auto-detected'}`;

  const list = el.querySelector('.checks');
  list.innerHTML = '';
  for (const c of res.checks) {
    const li = document.createElement('li');
    li.className = c.status;
    const s = document.createElement('strong'); s.textContent = c.title; li.appendChild(s);
    if (c.detail) li.appendChild(document.createTextNode(c.detail));
    list.appendChild(li);
  }
  if (!res.checks.length) {
    const li = document.createElement('li'); li.className = 'info';
    const s = document.createElement('strong'); s.textContent = 'Reference position'; li.appendChild(s);
    li.appendChild(document.createTextNode('Compare your frame with the ideal checkpoints below.'));
    list.appendChild(li);
  }
  const metrics = el.querySelector('.metrics');
  metrics.innerHTML = '';
  for (const [k, v] of res.metrics) {
    const s = document.createElement('span');
    s.append(`${k} `);
    const b = document.createElement('b'); b.textContent = v; s.appendChild(b);
    metrics.appendChild(s);
  }
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
    title: `${POSITIONS[p].id} · ${POSITIONS[p].name}`,
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
  const h = document.createElement('p');
  h.innerHTML = top.length
    ? '<strong>Top priorities to work on:</strong>'
    : '<strong>Nice swing!</strong> No major issues were flagged. Check each position against the ideal checkpoints below.';
  body.appendChild(h);
  if (top.length) {
    const ol = document.createElement('ol');
    ol.className = 'priorities';
    top.forEach((c) => {
      const li = document.createElement('li');
      const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = POSITIONS[c.p].id;
      const t = document.createElement('strong'); t.textContent = c.title;
      li.append(tag, t, document.createElement('br'), c.detail);
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Show';
      btn.addEventListener('click', () => {
        const card = state.cards[c.p];
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        card.classList.add('flash');
        setTimeout(() => card.classList.remove('flash'), 1500);
      });
      li.appendChild(btn);
      ol.appendChild(li);
    });
    body.appendChild(ol);
  }
  const score = document.createElement('div');
  score.className = 'score';
  score.innerHTML = `<span>✓ ${goodCount} checks look good</span><span>⚠ ${warnCount} things to work on</span>`;
  body.appendChild(score);
}

function renderLegend() {
  const items = state.view === 'dtl'
    ? [
        [COLORS.spine, false, 'Spine angle now'],
        [COLORS.reference, true, 'Spine angle at address (P1). Compare to spot standing up / early extension'],
        [COLORS.butt, true, 'Butt line. Hips should stay on it through impact'],
        [COLORS.plane, true, 'Shoulder plane (address hands → trail shoulder). Hands should come down under it'],
        [COLORS.head, true, 'Head box from address'],
        [COLORS.hands, false, 'Hand path from address'],
        [COLORS.lead, false, 'Lead arm'],
      ]
    : [
        [COLORS.spine, false, 'Shoulder line and spine'],
        [COLORS.hips, false, 'Hip line'],
        [COLORS.head, true, 'Head position at address. Watch for sway or lift'],
        [COLORS.butt, true, 'Hip positions at address (sway lines)'],
        [COLORS.hands, false, 'Hand path from address'],
        [COLORS.lead, false, 'Lead arm (number = elbow angle)'],
      ];
  const ul = $('#legend-list');
  ul.innerHTML = '';
  for (const [color, dashed, text] of items) {
    const li = document.createElement('li');
    const sw = document.createElement('span');
    sw.className = `swatch${dashed ? ' dashed' : ''}`;
    sw.style.background = color; sw.style.color = color;
    li.append(sw, text);
    ul.appendChild(li);
  }
}

// ---------- Downloads ----------

function wrapText(g, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function cardCanvas(p) {
  const src = state.cards[p].querySelector('canvas');
  const res = state.results[p];
  const W = src.width, pad = Math.round(W * 0.04), fs = Math.max(13, Math.round(W / 42));
  const measure = document.createElement('canvas').getContext('2d');
  const blocks = res.checks.map((c) => {
    measure.font = `700 ${fs}px system-ui, sans-serif`;
    const t = wrapText(measure, `${c.status === 'warn' ? '⚠' : c.status === 'good' ? '✓' : 'ℹ'} ${c.title}`, W - pad * 2);
    measure.font = `400 ${fs}px system-ui, sans-serif`;
    const d = c.detail ? wrapText(measure, c.detail, W - pad * 2) : [];
    return { c, t, d };
  });
  const lineH = fs * 1.4;
  const textH = blocks.reduce((s, b) => s + (b.t.length + b.d.length) * lineH + fs * 0.6, 0) + pad * 1.5;
  const out = document.createElement('canvas');
  out.width = W; out.height = src.height + textH;
  const g = out.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(src, 0, 0);
  let y = src.height + pad;
  g.textBaseline = 'top';
  for (const b of blocks) {
    g.fillStyle = b.c.status === 'warn' ? '#b26a00' : b.c.status === 'good' ? '#1f8a4c' : '#2c6ca3';
    g.font = `700 ${fs}px system-ui, sans-serif`;
    for (const l of b.t) { g.fillText(l, pad, y); y += lineH; }
    g.fillStyle = '#333'; g.font = `400 ${fs}px system-ui, sans-serif`;
    for (const l of b.d) { g.fillText(l, pad, y); y += lineH; }
    y += fs * 0.6;
  }
  return out;
}

function saveCanvas(c, name) {
  c.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

function downloadCard(p) {
  saveCanvas(cardCanvas(p), `swing-${POSITIONS[p].id}.png`);
}

$('#download-all').addEventListener('click', () => {
  const srcs = state.cards.map((el) => el.querySelector('canvas'));
  const cols = 5, cw = 360;
  const ch = Math.round((srcs[0].height / srcs[0].width) * cw);
  const out = document.createElement('canvas');
  out.width = cols * cw; out.height = Math.ceil(srcs.length / cols) * ch;
  const g = out.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, out.width, out.height);
  srcs.forEach((c, k) => g.drawImage(c, (k % cols) * cw, Math.floor(k / cols) * ch, cw, ch));
  saveCanvas(out, 'swing-p1-p10.png');
});

// ---------- Helpers ----------

function show(step) {
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

// Expose state for debugging in the console.
window.__swing = state;
