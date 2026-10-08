import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSwing, keyTimes } from './synth.js';
import { toPixels, feetOrientation, alignTo, prepareFrames, detectPositions } from '../js/detect.js';
import { analyzePosition } from '../js/analyze.js';

// Pick single "photos" out of a synthetic swing at the true P-position times.
function photos(opts, transform = (p) => p) {
  const { frames, width, height } = makeSwing(opts);
  const kt = keyTimes();
  const at = (t) => frames.reduce((best, f) => (Math.abs(f.t - t) < Math.abs(best.t - t) ? f : best));
  const px = (f) => toPixels(f.lm, width, height).map(transform);
  return { p1: px(at(0.3)), p4: px(at(kt.top)), p7: px(at(kt.impact)) };
}

// Simulate a different zoom/framing for a photo.
const reframe = (p) => ({ x: p.x * 0.6 + 120, y: p.y * 0.6 + 40, v: p.v });

function analyzePhoto(p, photo, ref, view) {
  const ctx = {
    pts: [ref ? alignTo(ref, photo, 'right') : photo, photo],
    idx: [0],
    handedness: 'right',
    view,
    orient: feetOrientation(photo, 'right'),
    hasReference: !!ref,
  };
  return analyzePosition(p, 1, ctx);
}
const titles = (r) => r.checks.map((c) => c.title);

test('feetOrientation reads target / facing direction from the feet', () => {
  const face = photos({ view: 'face' });
  assert.equal(feetOrientation(face.p4, 'right').targetDir, 1);
  assert.equal(feetOrientation(face.p4, 'left').targetDir, -1);
  const dtl = photos({ view: 'dtl' });
  assert.equal(feetOrientation(dtl.p7, 'right').facingDir, 1);
});

test('alignTo maps the reference into a re-framed photo', () => {
  const { p1 } = photos({ view: 'face' });
  const moved = p1.map(reframe);
  const aligned = alignTo(p1, moved, 'right');
  aligned.forEach((pt, k) => {
    assert.ok(Math.abs(pt.x - moved[k].x) < 1e-6 && Math.abs(pt.y - moved[k].y) < 1e-6, `landmark ${k}`);
  });
});

test('without a P1 photo, no address-relative checks or readouts appear', () => {
  const { p7 } = photos({ view: 'face', handsBehind: 0.3 });
  const r = analyzePhoto(6, p7, null, 'face');
  assert.ok(!titles(r).includes('Hands ahead at impact'), titles(r).join(', '));
  assert.ok(!titles(r).includes('Hands behind at impact (flip)'));
  assert.ok(titles(r).includes('Good spine tilt at impact') || titles(r).some((t) => /spine|ahead|back/i.test(t)));
  assert.ok(!r.metrics.some(([k]) => k === 'Head shift'));
  const dtl = photos({ view: 'dtl' });
  const d = analyzePhoto(6, dtl.p7, null, 'dtl');
  assert.ok(!titles(d).some((t) => /spine angle|Hip depth|Hips moving|Head/.test(t)), titles(d).join(', '));
});

test('with a P1 photo from a different framing, relative checks still work', () => {
  const swing = photos({ view: 'face', handsBehind: 0.3 });
  const r = analyzePhoto(6, swing.p7.map(reframe), swing.p1, 'face');
  assert.ok(titles(r).includes('Hands behind at impact (flip)'), titles(r).join(', '));
  const clean = photos({ view: 'face' });
  const c = analyzePhoto(6, clean.p7.map(reframe), clean.p1, 'face');
  assert.ok(titles(c).includes('Hands ahead at impact'), titles(c).join(', '));
  const dtl = photos({ view: 'dtl', spineLoss: 15 });
  assert.ok(titles(analyzePhoto(6, dtl.p7, dtl.p1, 'dtl')).includes('Losing spine angle'));
});

test('video-mode detection is unaffected by photo helpers', () => {
  const { frames, width, height } = makeSwing({ view: 'face' });
  const { indices } = detectPositions(prepareFrames(frames, width, height), frames.map((f) => f.t), 'right');
  assert.equal(indices.length, 10);
});
