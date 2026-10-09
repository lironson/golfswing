// Runs the app's real browser pipeline (MediaPipe pose on every frame) on each clip in
// tests/fixtures/ and saves the landmarks as <clip>.landmarks.json, so `npm test` can
// check detection on real footage without a browser.
//
//   npm start &                       # serve the app on http://localhost:8000
//   node tests/fixtures/extract.mjs   # needs Playwright (npm i -D playwright) and Chromium
//
// Options: --url <app url>, --chromium <path to a Chromium binary>,
//   --mediapipe <dir> and --model <file> to serve @mediapipe/tasks-vision and the pose model
//   from disk when the CDN can't be reached.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://localhost:8000/');
const { chromium } = await import('playwright');

const clips = readdirSync(dir).filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f));
if (!clips.length) {
  console.log('No clips in tests/fixtures/. Add .mp4/.mov/.webm swing videos (5 s or less) first.');
  process.exit(0);
}

const browser = await chromium.launch({
  executablePath: arg('chromium', process.env.PLAYWRIGHT_CHROMIUM || undefined),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const mp = arg('mediapipe');
if (mp) {
  await page.route('https://cdn.jsdelivr.net/npm/@mediapipe/**', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\/npm\/@mediapipe\/tasks-vision@[^/]+/, '');
    route.fulfill({ body: readFileSync(join(mp, p)), contentType: p.endsWith('.wasm') ? 'application/wasm' : 'text/javascript' });
  });
}
const model = arg('model');
if (model) {
  await page.route('https://storage.googleapis.com/mediapipe-models/**', (route) =>
    route.fulfill({ body: readFileSync(model), contentType: 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } }));
}
await page.goto(url);

for (const clip of clips) {
  await page.setInputFiles('#file-input', join(dir, clip));
  await page.waitForSelector('#setup-section:not([hidden])');
  const t0 = Date.now();
  const out = await page.evaluate(async () => {
    const pose = await import(document.querySelector('script[type="importmap"]')
      ? JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports['./js/pose.js']
      : './js/pose.js');
    const v = document.querySelector('#video');
    const { start, end } = window.__swing.range;
    const frames = await pose.captureFrames(v, { start, end });
    return { width: v.videoWidth, height: v.videoHeight, start, end, frames };
  });
  const file = join(dir, clip.replace(/\.[^.]+$/, '.landmarks.json'));
  writeFileSync(file, JSON.stringify(out));
  const found = out.frames.filter((f) => f.lm).length;
  console.log(`${clip}: ${out.frames.length} frames (${found} with a pose) in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${file}`);
  const expected = join(dir, clip.replace(/\.[^.]+$/, '.expected.json'));
  if (!existsSync(expected)) console.log(`  add ${expected} with the true P1–P10 times to test detection on it`);
}
await browser.close();
