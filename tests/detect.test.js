import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { makeSwing, keyTimes, addNoise } from './synth.js';
import { prepareFrames, detectPositions, guessView, orientation, enforceOrder } from '../js/detect.js';
import { analyzePosition, summarize } from '../js/analyze.js';

function run(opts) {
  const { frames, width, height } = makeSwing(opts);
  const pts = prepareFrames(frames, width, height);
  const times = frames.map((f) => f.t);
  const { indices, confidence } = detectPositions(pts, times, 'right');
  return { pts, times, indices, confidence };
}

const near = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: got ${actual.toFixed(3)}s, expected ~${expected.toFixed(3)}s`);

for (const view of ['face', 'dtl']) {
  test(`detects P1–P10 in order (${view})`, () => {
    const { times, indices, confidence } = run({ view });
    assert.ok(confidence.every(Boolean), `clean swing: every position confident (${confidence})`);
    for (let i = 1; i < 10; i++) assert.ok(indices[i] > indices[i - 1], `P${i + 1} after P${i}: ${indices}`);
    const kt = keyTimes();
    const t = indices.map((i) => times[i]);
    assert.ok(t[0] <= kt.takeawayStart + 0.05, `P1 at ${t[0]} should be at address`);
    near(t[2], kt.p3, 0.06, 'P3');
    near(t[3], kt.top, 0.06, 'P4');
    near(t[6], kt.impact, 0.05, 'P7');
    assert.ok(t[9] >= kt.finish - 0.05, `P10 at ${t[9]} should be in the finish`);
  });
}

test('works with a coarse 30 fps sample', () => {
  const { indices } = run({ view: 'face', fps: 30 });
  for (let i = 1; i < 10; i++) assert.ok(indices[i] > indices[i - 1]);
});

// Real MediaPipe output is noisy: jitter, lost wrists, wrong-but-confident wrists,
// repeated frames and long still lead-ins. Detection must hold up to all of them.
const kt = keyTimes();
const NOISE = {
  jitter: { jitter: 4 },
  'lost wrists': { jitter: 3, dropout: 0.08 },
  'wrist glitch in the follow-through': { jitter: 3, spikes: [kt.finish - 0.1] },
  'wrist glitch in the downswing': { jitter: 3, spikes: [kt.impact - 0.06] },
  'wrists blurred out at impact': { jitter: 3, lost: [kt.impact - 0.05, kt.impact + 0.05] },
  'repeated frames': { jitter: 3, dupes: 0.25 },
  'long address': { jitter: 3, padStart: 2 },
  everything: { jitter: 4, dropout: 0.06, spikes: [kt.finish - 0.1], dupes: 0.15, padStart: 1 },
};

for (const view of ['face', 'dtl']) {
  for (const fps of [30, 60]) {
    for (const [name, noise] of Object.entries(NOISE)) {
      test(`finds P1–P10 despite ${name} (${view}, ${fps} fps)`, () => {
        const { frames, width, height } = makeSwing({ view, fps });
        const noisy = addNoise(frames, { seed: 7, ...noise });
        const times = noisy.map((f) => f.t);
        const { indices, confidence } = detectPositions(prepareFrames(noisy, width, height), times, 'right');
        for (let i = 1; i < 10; i++) assert.ok(indices[i] > indices[i - 1], `P${i + 1} after P${i}: ${indices}`);
        const pad = noise.padStart || 0;
        const t = indices.map((i) => times[i] - pad);
        const tol = Math.max(0.034, 2 / fps); // two frames
        assert.ok(t[0] <= kt.takeawayStart + 0.07, `P1 at ${t[0].toFixed(3)}s should be at address`);
        near(t[3], kt.top, tol, 'P4');
        near(t[6], kt.impact, tol, 'P7');
        assert.ok(t[9] >= kt.finish - 0.05, `P10 at ${t[9].toFixed(3)}s should be in the finish`);
        // In-between positions may be flagged "check this frame" when the data is poor; the anchors may not.
        assert.ok([0, 3, 6, 9].every((p) => confidence[p]), `P1/P4/P7/P10 confident: ${confidence}`);
      });
    }
  }
}

// Real clips: tests/fixtures/<clip>.landmarks.json (made by tests/fixtures/extract.mjs) with
// <clip>.expected.json holding the true P1–P10 times in seconds, e.g.
// { "handedness": "right", "times": [0.82, 1.10, 1.31, 1.62, 1.75, 1.80, 1.86, 1.92, 2.01, 2.60] }
const FIXTURES = new URL('./fixtures/', import.meta.url);
for (const file of existsSync(FIXTURES) ? readdirSync(FIXTURES).filter((f) => f.endsWith('.landmarks.json')) : []) {
  const expectedFile = new URL(file.replace('.landmarks.json', '.expected.json'), FIXTURES);
  if (!existsSync(expectedFile)) continue;
  test(`finds P1–P10 in real clip ${file.replace('.landmarks.json', '')}`, () => {
    const { width, height, frames } = JSON.parse(readFileSync(new URL(file, FIXTURES), 'utf8'));
    const { handedness = 'right', times: truth, tolerance = 0.1 } = JSON.parse(readFileSync(expectedFile, 'utf8'));
    const times = frames.map((f) => f.t);
    const { indices } = detectPositions(prepareFrames(frames, width, height), times, handedness);
    const got = indices.map((i) => times[i]);
    const off = got.map((t, p) => `P${p + 1} ${t.toFixed(2)}s (true ${truth[p].toFixed(2)}s)`).join(', ');
    // Address and finish are judgement calls; the moving positions must be close.
    for (let p = 1; p < 9; p++) assert.ok(Math.abs(got[p] - truth[p]) <= tolerance, `P${p + 1} off: ${off}`);
    assert.ok(got[0] <= truth[1] && got[9] >= truth[8], `P1/P10 out of place: ${off}`);
  });
}

test('a clip with no swing is flagged as low confidence', () => {
  const { frames, width, height } = makeSwing({ view: 'face' });
  const still = addNoise(frames.slice(0, 30).map((f) => ({ t: f.t, lm: frames[0].lm })), { seed: 3, jitter: 2 });
  const { confidence } = detectPositions(prepareFrames(still, width, height), still.map((f) => f.t), 'right');
  assert.ok(!confidence.every(Boolean));
});

test('guesses the camera view from shoulder width', () => {
  for (const view of ['face', 'dtl']) {
    const { pts, indices } = run({ view });
    assert.equal(guessView(pts, indices[0]).view, view);
  }
});

test('orientation: target is image-right for the synthetic face-on golfer', () => {
  const { pts, indices } = run({ view: 'face' });
  assert.equal(orientation(pts, indices[0], 'right').targetDir, 1);
  const dtl = run({ view: 'dtl' });
  assert.equal(orientation(dtl.pts, dtl.indices[0], 'right').facingDir, 1);
});

test('enforceOrder keeps indices strictly increasing', () => {
  assert.deepEqual(enforceOrder([0, 0, 3, 2, 5, 5, 6, 9, 8, 9], 20), [0, 1, 3, 4, 5, 6, 7, 9, 10, 11]);
  assert.deepEqual(enforceOrder([5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

function analyzeAll(opts) {
  const { pts, indices } = run(opts);
  const ctx = { pts, idx: indices, handedness: 'right', view: opts.view, orient: orientation(pts, indices[0], 'right') };
  return indices.map((i, p) => analyzePosition(p, i, ctx));
}
const titles = (results) => results.flatMap((r) => r.checks.filter((c) => c.status === 'warn').map((c) => c.title));

test('clean face-on swing has no hip-sway or flip warnings', () => {
  const t = titles(analyzeAll({ view: 'face' }));
  assert.ok(!t.includes('Hip sway'), t.join(', '));
  assert.ok(!t.includes('Hands behind at impact (flip)'), t.join(', '));
});

test('flags hip sway in face-on view', () => {
  assert.ok(titles(analyzeAll({ view: 'face', hipSway: 0.35 })).includes('Hip sway'));
});

test('flags hands behind at impact', () => {
  assert.ok(titles(analyzeAll({ view: 'face', handsBehind: 0.3 })).includes('Hands behind at impact (flip)'));
});

test('clean down-the-line swing keeps spine angle', () => {
  const t = titles(analyzeAll({ view: 'dtl' }));
  assert.ok(!t.includes('Losing spine angle'), t.join(', '));
});

test('flags early extension in down-the-line view', () => {
  const res = analyzeAll({ view: 'dtl', spineLoss: 15 });
  const t = titles(res);
  assert.ok(t.includes('Losing spine angle'), t.join(', '));
  const s = summarize(res);
  assert.ok(s.top.length >= 1 && s.top[0].priority === 1);
});
