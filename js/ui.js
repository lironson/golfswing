// Shared DOM renderers for coaching notes, measurement readouts and the guide-line legend
// (video and photo modes).

import { COLORS } from './overlay.js';

const TAGS = { warn: 'Work on', good: 'Good', info: 'Note' };

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/** Fill a <ul class="checks"> with marker · tag · title / detail lines. */
export function renderChecks(ul, checks) {
  ul.innerHTML = '';
  for (const c of checks) {
    const li = el('li', c.status);
    li.append(el('span', 'mark'), el('span', 'tag', TAGS[c.status] || 'Note'), el('strong', null, c.title));
    if (c.detail) li.append(el('span', 'detail', c.detail)); // CSS places it under the title
    ul.appendChild(li);
  }
}

/** Fill a <dl class="metrics"> with [label, value] readouts. */
export function renderReadouts(dl, metrics) {
  dl.innerHTML = '';
  for (const [k, v] of metrics) {
    const d = el('div');
    d.append(el('dt', null, k), el('dd', null, v));
    dl.appendChild(d);
  }
}

/**
 * Fill a <ul> with what each guide line means for the given camera view.
 * Photo mode has no hand path, and its address-based lines need a P1 photo.
 */
export function renderLegend(ul, view, { photos = false } = {}) {
  const ref = photos ? ' (shown once a P1 photo is added)' : '';
  const items = view === 'dtl'
    ? [
        [COLORS.spine, false, 'Spine angle now'],
        [COLORS.reference, true, `Spine angle at address. A gap between the two lines means standing up or early extension${ref}`],
        [COLORS.butt, true, `Butt line. Hips should stay on it through impact${ref}`],
        [COLORS.plane, true, `Shoulder plane, from the address hands through the trail shoulder. Hands should come down under it${ref}`],
        [COLORS.head, true, `Head box from address${ref}`],
        ['#ffffff', false, 'Number by the knee: trail knee angle'],
        !photos && [COLORS.hands, false, 'Hand path from address'],
        [COLORS.lead, false, 'Lead arm'],
      ]
    : [
        [COLORS.spine, false, 'Shoulder line and spine'],
        [COLORS.hips, false, 'Hip line'],
        [COLORS.lead, false, 'Lead arm. The number is the lead elbow angle'],
        [COLORS.head, true, `Head position at address. Watch for sway or lift${ref}`],
        [COLORS.butt, true, `Sway lines: hip positions at address${ref}`],
        !photos && [COLORS.hands, false, 'Hand path from address'],
      ];
  ul.innerHTML = '';
  for (const item of items.filter(Boolean)) {
    const [color, dashed, text] = item;
    const li = el('li');
    // The swatch sits on a black chip, like the photo, so white lines read as white in both themes.
    const sw = el('span', `swatch${dashed ? ' dashed' : ''}`);
    sw.style.setProperty('--swatch', color);
    sw.setAttribute('aria-hidden', 'true');
    li.append(sw, el('span', null, text));
    ul.appendChild(li);
  }
}
