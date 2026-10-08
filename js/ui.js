// Shared DOM renderers for coaching notes and measurement readouts (video and photo modes).

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
