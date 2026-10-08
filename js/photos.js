// Photo mode: a P1–P10 page the golfer fills in with whatever stills they have.
// Each photo is analysed on its own; when P1 is present, the others are also
// compared against it (aligned by the lead foot and body size).

import { POSITIONS, CLUB_LABELS, clubText } from './positions.js';
import { detectImage } from './pose.js';
import { toPixels, feetOrientation, alignTo, guessView } from './detect.js';
import { analyzePosition, cardStatus, summarize } from './analyze.js';
import { drawFrame } from './overlay.js';
import { referenceElement } from './reference.js';
import { cardCanvas, contactSheet, saveCanvas } from './export.js';
import { renderChecks, renderReadouts, renderLegend } from './ui.js';

const $ = (sel, root = document) => root.querySelector(sel);
const MAX_SIDE = 1600;
const viewName = (v) => (v === 'dtl' ? 'down-the-line' : 'face-on');

// The club choice is remembered per browser; storage can be blocked, so it's best-effort.
function savedClub() {
  try { return localStorage.getItem('club') === 'iron7' ? 'iron7' : 'driver'; } catch { return 'driver'; }
}

const state = {
  handedness: 'right',
  view: 'face',
  club: savedClub(),
  showOverlay: true,
  // Per position: null (empty) or { img, pts, error, busy, result, ctx }
  slots: Array(10).fill(null),
  rows: [],
  railLinks: [],
};

let initialised = false;

export function initPhotos() {
  if (initialised) return;
  initialised = true;
  buildRows();
  buildRail();
  const clubRadio = $(`input[name="photo-club"][value="${state.club}"]`);
  if (clubRadio) clubRadio.checked = true;
  document.querySelectorAll('input[name="photo-club"]').forEach((r) => r.addEventListener('change', () => {
    state.club = r.value;
    try { localStorage.setItem('club', state.club); } catch { /* storage blocked: choice lasts this visit */ }
    refreshClubText(); refreshReferences(); analyzeAll();
  }));
  document.querySelectorAll('input[name="photo-hand"]').forEach((r) => r.addEventListener('change', () => {
    state.handedness = r.value; refreshReferences(); analyzeAll();
  }));
  document.querySelectorAll('input[name="photo-view"]').forEach((r) => r.addEventListener('change', () => {
    state.view = r.value; suggestView(); updateLegend(); analyzeAll();
  }));
  $('#photo-overlay').addEventListener('change', (e) => { state.showOverlay = e.target.checked; state.slots.forEach((_, p) => renderRow(p)); });
  $('#photo-clear').addEventListener('click', () => {
    if (!state.slots.some(Boolean) || !confirm('Remove all photos?')) return;
    state.slots = Array(10).fill(null);
    analyzeAll();
  });
  $('#photo-download-all').addEventListener('click', () => {
    const filled = state.rows.filter((_, p) => state.slots[p] && state.slots[p].result).map((row) => $('canvas', row));
    if (filled.length) saveCanvas(contactSheet(filled), 'swing-photos.png');
  });
  updateLegend();
  renderSummary();
}

function updateLegend() {
  renderLegend($('#photo-legend-list'), state.view, { photos: true });
}

function buildRows() {
  const list = $('#photo-rows');
  const tpl = $('#photo-row-template');
  state.rows = POSITIONS.map((pos, p) => {
    const row = tpl.content.firstElementChild.cloneNode(true);
    row.id = `photo-${pos.id}`;
    $('.p-num', row).textContent = pos.id;
    $('.row-title', row).textContent = pos.name;
    $('.ref-media', row).appendChild(referenceElement(p, state.handedness, state.club));
    $('.dz-title', row).textContent = `Add your ${pos.id} photo`;
    $('.dz-sub', row).textContent = `${pos.name}. Tap to choose, or drop an image. Optional.`;

    const input = $('input[type=file]', row);
    input.addEventListener('change', () => { if (input.files[0]) loadPhoto(p, input.files[0]); input.value = ''; });
    $('.replace', row).addEventListener('click', () => input.click());
    $('.remove', row).addEventListener('click', () => removePhoto(p));
    $('.download', row).addEventListener('click', () => {
      const s = state.slots[p];
      if (s && s.result) saveCanvas(cardCanvas($('canvas', row), s.result.checks), `swing-${pos.id}.png`);
    });
    const slot = $('.slot', row);
    ['dragenter', 'dragover'].forEach((ev) => slot.addEventListener(ev, (e) => { e.preventDefault(); slot.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach((ev) => slot.addEventListener(ev, (e) => { e.preventDefault(); slot.classList.remove('drag'); }));
    slot.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) loadPhoto(p, file);
    });
    list.appendChild(row);
    return row;
  });
  refreshClubText();
}

// Summary, checkpoints and reference label for the selected club.
function refreshClubText() {
  state.rows.forEach((row, p) => {
    const t = clubText(p, state.club);
    $('.row-summary', row).textContent = t.summary;
    $('.ref-label', row).textContent = `Reference · ${CLUB_LABELS[state.club]}`;
    const cp = $('.checkpoint-list', row);
    cp.innerHTML = '';
    t.checkpoints.forEach((c) => { const li = document.createElement('li'); li.textContent = c; cp.appendChild(li); });
  });
}

// Rolodex-style index: P1–P10, with the plate in view held in the orange band.
function buildRail() {
  const rail = $('#p-rail');
  state.railLinks = POSITIONS.map((pos, p) => {
    const a = document.createElement('a');
    a.href = `#photo-${pos.id}`;
    a.textContent = pos.id;
    a.setAttribute('aria-label', `${pos.id} ${pos.name}`);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      state.rows[p].scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrent(p);
    });
    rail.appendChild(a);
    return a;
  });
  setCurrent(0);
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) setCurrent(state.rows.indexOf(e.target));
  }, { rootMargin: '-30% 0px -65% 0px' });
  state.rows.forEach((row) => io.observe(row));
}

function setCurrent(p) {
  state.railLinks.forEach((a, k) => {
    a.classList.toggle('current', k === p);
    if (k === p) {
      a.setAttribute('aria-current', 'true');
      // Keep the current tab visible on the horizontal phone rail without moving the page.
      const rail = a.parentElement;
      if (rail.scrollWidth > rail.clientWidth) rail.scrollTo({ left: a.offsetLeft - rail.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
    } else {
      a.removeAttribute('aria-current');
    }
  });
}

function refreshReferences() {
  state.rows.forEach((row, p) => {
    const media = $('.ref-media', row);
    media.innerHTML = '';
    media.appendChild(referenceElement(p, state.handedness, state.club));
  });
}

async function decodeImage(file) {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(file.name)) {
    throw new Error('That file does not look like an image.');
  }
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This browser cannot open that image format. Try a JPEG or PNG (iPhone: Settings → Camera → Formats → Most Compatible).');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close && bmp.close();
  return c;
}

async function loadPhoto(p, file) {
  state.slots[p] = { busy: true };
  renderRow(p);
  try {
    const img = await decodeImage(file);
    state.slots[p] = { img, busy: true };
    renderRow(p);
    const lm = await detectImage(img);
    if (state.slots[p] && state.slots[p].img !== img) return; // replaced while detecting
    state.slots[p] = lm
      ? { img, pts: toPixels(lm, img.width, img.height) }
      : { img, error: 'No golfer was found in this photo. Use a photo with your whole body in view and good light.' };
  } catch (err) {
    console.error(err);
    state.slots[p] = { error: err.message || String(err) };
  }
  if (p === 0) {
    suggestView();
    analyzeAll();
  } else {
    analyzeSlot(p);
    renderRow(p);
    renderSummary();
  }
}

function removePhoto(p) {
  state.slots[p] = null;
  if (p === 0) analyzeAll();
  else { renderRow(p); renderSummary(); }
}

function analyzeSlot(p) {
  const s = state.slots[p];
  if (!s || !s.pts) return;
  const ref = state.slots[0] && state.slots[0].pts;
  const addr = p === 0 ? s.pts : ref ? alignTo(ref, s.pts, state.handedness) : s.pts;
  s.ctx = {
    pts: [addr, s.pts],
    idx: [0],
    handedness: state.handedness,
    view: state.view,
    club: state.club,
    orient: feetOrientation(s.pts, state.handedness),
    hasReference: p === 0 || !!ref,
  };
  s.result = analyzePosition(p, 1, s.ctx);
}

function analyzeAll() {
  state.slots.forEach((_, p) => { analyzeSlot(p); renderRow(p); });
  renderSummary();
}

function suggestView() {
  const s = state.slots[0];
  const note = $('#photo-view-hint');
  if (!s || !s.pts) { note.hidden = true; return; }
  const { view } = guessView([s.pts], 0);
  if (view === state.view) { note.hidden = true; return; }
  note.hidden = false;
  note.textContent = '';
  note.append(`Your P1 photo looks like a ${viewName(view)} shot. `);
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'text-btn';
  btn.textContent = `Switch to ${viewName(view)} →`;
  btn.addEventListener('click', () => {
    state.view = view;
    $(`input[name="photo-view"][value="${view}"]`).checked = true;
    note.hidden = true;
    updateLegend();
    analyzeAll();
  });
  note.appendChild(btn);
}

function renderRow(p) {
  const row = state.rows[p];
  if (!row) return;
  const s = state.slots[p];
  const drop = $('.slot-drop', row), filled = $('.slot-filled', row);
  row.classList.toggle('is-empty', !s);
  if (state.railLinks[p]) state.railLinks[p].classList.toggle('filled', !!(s && s.result));
  drop.hidden = !!s;
  filled.hidden = !s;
  if (!s) return;

  const canvas = $('canvas', row);
  const status = $('.slot-status', row);
  const list = $('.checks', row);
  const metrics = $('.metrics', row);
  list.innerHTML = '';
  metrics.innerHTML = '';
  $('.download', row).hidden = !s.result;

  if (s.img) {
    drawFrame(canvas, s.img, {
      srcW: s.img.width, srcH: s.img.height, ctx: s.ctx, p, frameIndex: 1, handPath: false,
      showOverlay: state.showOverlay && !!s.result,
      title: `${POSITIONS[p].id} · ${POSITIONS[p].name} · ${CLUB_LABELS[state.club]}`,
      status: s.result && s.result.checks.length ? cardStatus(s.result.checks) : null,
    });
    canvas.hidden = false;
  } else {
    canvas.hidden = true;
  }

  $('.notes-label', row).hidden = !s.result;
  status.classList.toggle('err', !!s.error);
  if (s.busy) { status.textContent = 'Finding your body position… The first photo also loads the pose model.'; return; }
  if (s.error) { status.textContent = s.error; return; }

  status.textContent = p > 0 && !(state.slots[0] && state.slots[0].pts)
    ? 'Add a P1 (address) photo to also check head, hip and spine movement against your setup.'
    : '';
  const checks = s.result.checks.length ? s.result.checks : [{ status: 'info', title: 'Reference position', detail: 'Compare your photo with the ideal checkpoints.' }];
  renderChecks(list, checks);
  renderReadouts(metrics, s.result.metrics);
}

function renderSummary() {
  const results = state.slots.map((s) => (s && s.result) || null);
  const count = results.filter(Boolean).length;
  $('#photo-count').textContent = `${count} / 10`;
  const body = $('#photo-summary');
  body.innerHTML = '';
  const line = document.createElement('p');
  line.className = 'summary-line';
  body.appendChild(line);
  if (!count) {
    line.textContent = 'Nothing added yet. Start with whichever positions you have photos of. The rest can stay blank.';
    return;
  }
  const { top, warnCount, goodCount } = summarize(results, Infinity, { byPosition: true });
  if (!top.length) {
    line.textContent = 'No major issues flagged so far. Compare each photo with its checkpoints.';
  } else {
    line.remove();
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'Things to work on · P1 → P10';
    const ul = document.createElement('ul');
    ul.className = 'todo';
    for (const c of top) {
      const li = document.createElement('li');
      const tag = document.createElement('span'); tag.className = 'p'; tag.textContent = POSITIONS[c.p].id;
      const t = document.createElement('strong'); t.textContent = c.title;
      const go = document.createElement('button');
      go.type = 'button'; go.className = 'text-btn'; go.textContent = `Go to ${POSITIONS[c.p].id} →`;
      go.addEventListener('click', () => {
        const row = state.rows[c.p];
        row.scrollIntoView({ behavior: 'smooth', block: 'start' });
        row.classList.add('flash');
        setTimeout(() => row.classList.remove('flash'), 1500);
      });
      const d = document.createElement('span'); d.className = 'detail'; d.textContent = c.detail;
      li.append(tag, t, go, d);
      ul.appendChild(li);
    }
    body.append(label, ul);
  }
  const tally = document.createElement('div');
  tally.className = 'tally';
  tally.innerHTML = `<span><b>${goodCount}</b> GOOD</span><span><b>${warnCount}</b> TO WORK ON</span>`;
  body.appendChild(tally);
}

// Expose state for debugging in the console.
window.__photos = state;
