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

function analyzePhoto(p, photo, ref, view, club = 'iron7') {
  const ctx = {
    pts: [ref ? alignTo(ref, photo, 'right') : photo, photo],
    idx: [0],
    handedness: 'right',
    view,
    club,
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

test('hands slightly behind at impact: a flip with a 7-iron, fine with a driver', () => {
  const swing = photos({ view: 'face', handsBehind: 0.1 });
  const iron = analyzePhoto(6, swing.p7, swing.p1, 'face', 'iron7');
  const driver = analyzePhoto(6, swing.p7, swing.p1, 'face', 'driver');
  assert.ok(titles(iron).includes('Hands behind at impact (flip)'), titles(iron).join(', '));
  assert.ok(!titles(driver).includes('Hands behind at impact (flip)'), titles(driver).join(', '));
  assert.ok(titles(driver).includes('Hands level at impact'), titles(driver).join(', '));
});

test('an upright spine at impact: fine with a 7-iron, "stay behind the ball" with a driver', () => {
  const swing = photos({ view: 'face' }); // synthetic golfer has a vertical spine at impact
  assert.ok(!titles(analyzePhoto(6, swing.p7, swing.p1, 'face', 'iron7')).includes('Stay behind the ball'));
  assert.ok(titles(analyzePhoto(6, swing.p7, swing.p1, 'face', 'driver')).includes('Stay behind the ball'));
});

test('address shoulder tilt: a lot of tilt suits the driver, not the 7-iron', () => {
  const { p1 } = photos({ view: 'face' });
  // Drop the trail (right) shoulder to give about 14° of tilt.
  const tilted = p1.map((pt, k) => (k === 12 ? { ...pt, y: pt.y + 28 } : pt));
  const iron = titles(analyzePhoto(0, tilted, tilted, 'face', 'iron7'));
  const driver = titles(analyzePhoto(0, tilted, tilted, 'face', 'driver'));
  assert.ok(iron.includes('Too much tilt for an iron'), iron.join(', '));
  assert.ok(driver.includes('Good shoulder tilt'), driver.join(', '));
  // Level shoulders: good for the iron, too little tilt for the driver.
  const level = p1.map((pt, k) => (k === 11 || k === 12 ? { ...pt, y: 400 } : pt));
  assert.ok(titles(analyzePhoto(0, level, level, 'face', 'iron7')).includes('Good shoulder tilt'));
  assert.ok(titles(analyzePhoto(0, level, level, 'face', 'driver')).includes('Add some tilt for the driver'));
});

test('every position has researched notes for both clubs', async () => {
  const { POSITIONS, CLUB_IDS, clubText } = await import('../js/positions.js');
  for (let p = 0; p < POSITIONS.length; p++) {
    for (const club of CLUB_IDS) {
      const t = clubText(p, club);
      assert.ok(t.summary && t.summary.length > 20, `${POSITIONS[p].id} ${club} summary`);
      assert.ok(t.checkpoints.length >= 3, `${POSITIONS[p].id} ${club} checkpoints`);
    }
    assert.notDeepEqual(clubText(p, 'driver'), clubText(p, 'iron7'), `${POSITIONS[p].id} notes should differ by club`);
  }
});

test('video-mode detection is unaffected by photo helpers', () => {
  const { frames, width, height } = makeSwing({ view: 'face' });
  const { indices } = detectPositions(prepareFrames(frames, width, height), frames.map((f) => f.t), 'right');
  assert.equal(indices.length, 10);
});

test('summarize byPosition lists every warning in P order', async () => {
  const { summarize } = await import('../js/analyze.js');
  const w = (title, priority) => ({ status: 'warn', title, detail: '', priority });
  const results = Array(10).fill(null);
  results[6] = { checks: [w('Hands behind at impact (flip)', 1), w('Head sliding toward the target', 2)] };
  results[0] = { checks: [w('Reverse shoulder tilt', 2), { status: 'good', title: 'ok', priority: 9 }] };
  results[4] = { checks: [w('Shift toward the target', 1)] };
  results[5] = { checks: [w('Shift toward the target', 1)] };

  const s = summarize(results, Infinity, { byPosition: true });
  assert.deepEqual(s.top.map((c) => c.p), [0, 4, 5, 6, 6]);
  assert.equal(s.top[3].title, 'Hands behind at impact (flip)'); // priority order within a position
  assert.equal(s.warnCount, s.top.length);
  assert.equal(s.goodCount, 1);

  const d = summarize(results, 3);
  assert.equal(d.top.length, 3);
  assert.equal(d.warnCount, 4); // de-duplicated by title
  assert.deepEqual(d.top.map((c) => c.priority), [1, 1, 2]);
});
