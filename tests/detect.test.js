import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSwing, keyTimes } from './synth.js';
import { prepareFrames, detectPositions, guessView, orientation, enforceOrder } from '../js/detect.js';
import { analyzePosition, summarize } from '../js/analyze.js';

function run(opts) {
  const { frames, width, height } = makeSwing(opts);
  const pts = prepareFrames(frames, width, height);
  const times = frames.map((f) => f.t);
  const { indices } = detectPositions(pts, times, 'right');
  return { pts, times, indices };
}

const near = (actual, expected, tol, label) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: got ${actual.toFixed(3)}s, expected ~${expected.toFixed(3)}s`);

for (const view of ['face', 'dtl']) {
  test(`detects P1–P10 in order (${view})`, () => {
    const { times, indices } = run({ view });
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
