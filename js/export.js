// PNG export helpers shared by video and photo modes.

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

const BODY = '"Barlow", "Helvetica Neue", Arial, sans-serif';
const DISPLAY = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
const TAGS = { warn: 'WORK ON', good: 'GOOD', info: 'NOTE' };

/** An annotated frame canvas with its coaching notes written underneath (spec-sheet style). */
export function cardCanvas(src, checks) {
  const W = src.width, pad = Math.round(W * 0.05), fs = Math.max(13, Math.round(W / 40));
  const tagW = fs * 5.2, textX = pad + tagW, textW = W - textX - pad;
  const measure = document.createElement('canvas').getContext('2d');
  const blocks = checks.map((c) => {
    measure.font = `600 ${fs}px ${BODY}`;
    const t = wrapText(measure, c.title, textW);
    measure.font = `400 ${fs}px ${BODY}`;
    const d = c.detail ? wrapText(measure, c.detail, textW) : [];
    return { c, t, d };
  });
  const lineH = fs * 1.4, gap = fs * 0.9;
  const textH = blocks.reduce((s, b) => s + (b.t.length + b.d.length) * lineH + gap * 2, 0) + pad;
  const out = document.createElement('canvas');
  out.width = W; out.height = src.height + textH;
  const g = out.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(src, 0, 0);
  let y = src.height + pad * 0.6;
  g.textBaseline = 'top';
  for (const b of blocks) {
    y += gap;
    const warn = b.c.status === 'warn';
    g.fillStyle = warn ? '#ff4f00' : b.c.status === 'good' ? '#0b0b0b' : '#767676';
    g.fillRect(pad, y + fs * 0.35, fs * 0.55, fs * 0.55);
    g.font = `700 ${Math.round(fs * 0.85)}px ${DISPLAY}`;
    g.fillText(TAGS[b.c.status] || 'NOTE', pad + fs * 1.1, y + fs * 0.1);
    g.fillStyle = '#0b0b0b'; g.font = `600 ${fs}px ${BODY}`;
    for (const l of b.t) { g.fillText(l, textX, y); y += lineH; }
    g.fillStyle = '#767676'; g.font = `400 ${fs}px ${BODY}`;
    for (const l of b.d) { g.fillText(l, textX, y); y += lineH; }
    y += gap;
    g.fillStyle = '#e6e6e6'; g.fillRect(pad, y - 1, W - pad * 2, 1);
  }
  return out;
}

/** Tile canvases into a grid; each cell keeps its own aspect ratio, letterboxed in black. */
export function contactSheet(srcs, cols = 5, cw = 360) {
  const ratio = Math.max(...srcs.map((c) => c.height / c.width));
  const ch = Math.round(ratio * cw);
  cols = Math.min(cols, srcs.length);
  const out = document.createElement('canvas');
  out.width = cols * cw; out.height = Math.ceil(srcs.length / cols) * ch;
  const g = out.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, out.width, out.height);
  srcs.forEach((c, k) => {
    const h = Math.round((c.height / c.width) * cw);
    g.drawImage(c, (k % cols) * cw, Math.floor(k / cols) * ch + (ch - h) / 2, cw, h);
  });
  return out;
}

export function saveCanvas(c, name) {
  c.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}
