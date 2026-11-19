import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTORS,
  DEFAULT_CAPABILITIES,
  canExecuteAction,
  createInteractionScheduler,
} from '../src/scene/princess-kitten/interaction-scheduler.mjs';
import {
  evaluateHeldKittenAdditivePose,
  evaluatePrincessPivotPose,
} from '../src/scene/princess-kitten/held-kitten-rig.mjs';
import {
  GROUND_CAT_IDS,
  actorIdForGroundCat,
  evaluateGroundCatAdditivePose,
} from '../src/scene/princess-kitten/ground-cat-adapter.mjs';

test('1. deterministic seeded scheduling produces identical timelines', () => {
  const s1 = createInteractionScheduler({ seed: 4242 });
  const s2 = createInteractionScheduler({ seed: 4242 });
  for (let i = 0; i < 600; i++) {
    s1.step(0.05);
    s2.step(0.05);
  }
  assert.deepEqual(s1.getSnapshot(), s2.getSnapshot());
});

test('2. initial calm window (3s) keeps all actors idle before staggered secondary motion', () => {
  const s = createInteractionScheduler({ seed: 1001 });
  for (let i = 0; i < 60; i++) s.step(0.05);
  const snap = s.getSnapshot();
  for (const a of ACTORS) {
    assert.equal(snap.actions[a], null, `Actor ${a} should remain calm during initial 3s`);
  }
});

test('3. tap cooldown (2s), drag suppression, and 30 rapid taps never lock or drift', () => {
  const s = createInteractionScheduler({ seed: 777 });
  s.step(0.05);
  s.dispatch({ type: 'camera-drag-start' });
  assert.equal(s.dispatch({ type: 'tap', actor: 'held-cat' }).handled, false);
  s.dispatch({ type: 'camera-drag-end' });

  const r1 = s.dispatch({ type: 'tap', actor: 'held-cat' });
  assert.equal(r1.handled, true);
  assert.equal(s.getSnapshot().actions['held-cat'].id, 'held.nuzzle');
  assert.equal(s.getSnapshot().actions['princess'].id, 'pair.cuddle_response');

  for (let i = 0; i < 30; i++) {
    const r = s.dispatch({ type: 'tap', actor: 'held-cat' });
    assert.equal(r.handled, false);
    assert.equal(r.reason, 'COOLDOWN');
  }

  for (let i = 0; i < 42; i++) s.step(0.05);
  const r2 = s.dispatch({ type: 'tap', actor: 'held-cat' });
  assert.equal(r2.handled, true);
  assert.equal(s.getSnapshot().actions['held-cat'].id, 'pair.cuddle_response');
});

test('4. dialog-open / hidden freezes clock with zero catch-up burst on resume', () => {
  const s = createInteractionScheduler({ seed: 99 });
  s.step(0.05);
  s.dispatch({ type: 'tap', actor: 'ground-black' });
  const before = s.getSnapshot().clock;

  s.dispatch({ type: 'dialog-open', name: 'album' });
  for (let i = 0; i < 600; i++) s.step(0.05);
  assert.equal(s.getSnapshot().clock, before);
  assert.equal(s.getSnapshot().frozen, true);

  s.dispatch({ type: 'dialog-close' });
  s.step(10.0);
  assert.ok(Math.abs(s.getSnapshot().clock - (before + 0.05)) < 1e-6);
});

test('5. reduced-motion clears active actions and returns neutral zero-drift poses', () => {
  const s = createInteractionScheduler({ seed: 123 });
  s.step(0.05);
  s.dispatch({ type: 'tap', actor: 'princess' });
  assert.ok(s.getSnapshot().actions['princess']);
  s.dispatch({ type: 'reduced-motion', enabled: true });
  for (const a of ACTORS) assert.equal(s.getSnapshot().actions[a], null);

  const catPose = evaluateHeldKittenAdditivePose(12.34, null, true);
  assert.equal(catPose.bodyLiftY, 0);
  assert.deepEqual(catPose.head, [0, 0, 0]);
  const pPose = evaluatePrincessPivotPose(12.34, null, true);
  assert.deepEqual(pPose, { posY: 0, rotX: 0, rotY: -0.24, rotZ: 0 });
  const gPose = evaluateGroundCatAdditivePose('black', 12.34, null, 0.2, true);
  assert.deepEqual(gPose.head, [0, 0, 0]);
});

test('6. princess.pet_cat, princess.adjust_hold, and cat.blink are strictly BLOCKED_BY_RIG', () => {
  assert.deepEqual(canExecuteAction('princess.pet_cat', DEFAULT_CAPABILITIES.princess), {
    allowed: false,
    reason: 'BLOCKED_BY_RIG',
  });
  assert.deepEqual(canExecuteAction('princess.adjust_hold', DEFAULT_CAPABILITIES.princess), {
    allowed: false,
    reason: 'BLOCKED_BY_RIG',
  });
  assert.deepEqual(canExecuteAction('cat.blink', DEFAULT_CAPABILITIES['held-cat']), {
    allowed: false,
    reason: 'BLOCKED_BY_RIG',
  });

  const s = createInteractionScheduler({ seed: 55 });
  const res = s.dispatch({ type: 'request-action', actor: 'princess', actionId: 'princess.pet_cat' });
  assert.equal(res.started, false);
  assert.equal(res.reason, 'BLOCKED_BY_RIG');
  assert.equal(s.getBlockedLog('princess').length, 1);
});

test('7. 60-second continuous simulation produces bounded zero-drift poses and independent ground cats', () => {
  const s = createInteractionScheduler({ seed: 2026 });
  const seenGroundActions = { 'ground-black': new Set(), 'ground-cream': new Set(), 'ground-calico': new Set() };
  const seenHeldActions = new Set();

  for (let stepIdx = 0; stepIdx < 1200; stepIdx++) {
    const snap = s.step(0.05);
    for (const gid of Object.keys(seenGroundActions)) {
      if (snap.actions[gid]) seenGroundActions[gid].add(snap.actions[gid].id);
    }
    if (snap.actions['held-cat']) seenHeldActions.add(snap.actions['held-cat'].id);

    const catPose = evaluateHeldKittenAdditivePose(snap.clock, snap.actions['held-cat'], false);
    const pPose = evaluatePrincessPivotPose(snap.clock, snap.actions['princess'], false);
    assert.ok(Math.abs(catPose.bodyLiftY) <= 0.025);
    assert.ok(Math.abs(pPose.rotX) <= 0.06);
  }

  assert.ok(seenHeldActions.size >= 3);
  for (const [, set] of Object.entries(seenGroundActions)) {
    assert.ok(set.size >= 3);
  }
});

test('8. tapping one ground cat does not hijack sibling ground cats or trigger duplicate vigorous actions', () => {
  const s = createInteractionScheduler({ seed: 303 });
  s.step(0.05);
  const rBlack = s.dispatch({ type: 'tap', actor: 'ground-black' });
  assert.equal(rBlack.handled, true);
  assert.equal(s.getSnapshot().actions['ground-cream'], null);
  assert.equal(s.getSnapshot().actions['ground-calico'], null);

  // Even if both black and cream are tapped simultaneously, vigorous cap (=1) prevents simultaneous pounce/paw spam
  const rCream = s.dispatch({ type: 'tap', actor: 'ground-cream' });
  assert.equal(rCream.handled, true);
  const snap = s.getSnapshot();
  const vigorousCount = GROUND_CAT_IDS
    .map((id) => snap.actions[actorIdForGroundCat(id)]?.id)
    .filter((id) => id === 'cat.one_paw_reach' || id === 'cat.crouch_pounce').length;
  assert.ok(vigorousCount <= 1, 'At most 1 vigorous ground cat action allowed simultaneously');
});

test('9. ground-cat adapter produces non-zero expressive offsets and clamps glance yaw', () => {
  const act = { actor: 'ground-calico', id: 'cat.head_tilt', elapsed: 0.55, duration: 1.1, intensity: 1, seed: 2 };
  const pose = evaluateGroundCatAdditivePose('calico', 5.0, act, 1.5, false);
  assert.ok(Math.abs(pose.head[2]) > 0.2, 'head_tilt should tilt head roll visibly');
  assert.ok(pose.head[1] <= 0.28 + 1e-6, 'sibling glance yaw must be safely clamped');
});

test('10. low-power mobile mode throttles idle intensity while keeping all 3 ground cats active', () => {
  const s = createInteractionScheduler({ seed: 808, lowPower: true });
  let sawThrottled = false;
  for (let i = 0; i < 600; i++) {
    const snap = s.step(0.05);
    for (const id of GROUND_CAT_IDS) {
      const act = snap.actions[actorIdForGroundCat(id)];
      if (act && act.intensity < 1.0) sawThrottled = true;
    }
  }
  assert.equal(sawThrottled, true, 'Low-power mode should reduce secondary idle intensity');
});
