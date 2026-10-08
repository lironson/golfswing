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

/** An annotated frame canvas with its feedback written underneath. */
export function cardCanvas(src, checks) {
  const W = src.width, pad = Math.round(W * 0.04), fs = Math.max(13, Math.round(W / 42));
  const measure = document.createElement('canvas').getContext('2d');
  const blocks = checks.map((c) => {
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
