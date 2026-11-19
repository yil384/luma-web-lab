import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WebGLObjects } from 'three/src/renderers/webgl/WebGLObjects.js';
import { createCharacterInteractionRuntime } from '../src/scene/princess-kitten/runtime.mjs';
import { createInteractionScheduler, canExecuteAction } from '../src/scene/princess-kitten/interaction-scheduler.mjs';
import { createHeldKittenPose, evaluateHeldKittenAdditivePose } from '../src/scene/princess-kitten/held-kitten-rig.mjs';
import { createGroundCatPose, evaluateGroundCatAdditivePose } from '../src/scene/princess-kitten/ground-cat-adapter.mjs';

const armBones = ['upperArm_L', 'upperArm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R'];
const lidBones = ['eyelid_upper_L', 'eyelid_upper_R', 'eyelid_lower_L', 'eyelid_lower_R'];
const capabilities = { skinned: true, canUseArmPose: true, canBlink: true, bones: [...armBones, ...lidBones] };

// The renderer contract is exercised with real Three transforms and a real skin.
// Each test owns its skeleton so a held cream cat cannot share ground-cat joints.
function catFixture(id = 'cream') {
  const group = new THREE.Group();
  const roles = ['root', 'body', 'chest', 'neck', 'head', 'ear_L', 'ear_R', 'tail_0', 'tail_1', 'tail_2', 'tail_3', 'tail_4',
    ...['LF', 'RF', 'LH', 'RH'].flatMap(prefix => [`${prefix}_upper`, `${prefix}_lower`, `${prefix}_paw`])];
  const bones = roles.map((name, i) => { const b = new THREE.Bone(); b.name = `${id}__${name}`; b.position.set(i * .03, i * .01, i * .02); return b; });
  for (let i = 1; i < bones.length; i++) bones[0].add(bones[i]);
  group.add(bones[0]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .1, 0, 0, 0, .1, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([4, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  group.add(mesh); group.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  return { id, group, source: group, meshes: [mesh], body: bones[1], head: bones[4],
    rest: bones.map(bone => ({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() })) };
}

function restoreNative(cat) {
  for (const rest of cat.rest) { rest.bone.position.copy(rest.position); rest.bone.quaternion.copy(rest.quaternion); rest.bone.scale.copy(rest.scale); }
}

test('unknown actors/actions and actor-incompatible requests fail without corrupting the schedule', () => {
  const scheduler = createInteractionScheduler();
  for (const actor of ['missing', '__proto__', 'constructor']) {
    assert.equal(scheduler.dispatch({ type: 'request-action', actor, actionId: 'cat.head_tilt' }).reason, 'UNKNOWN_ACTOR');
    assert.equal(scheduler.dispatch({ type: 'tap', actor }).reason, 'UNKNOWN_ACTOR');
  }
  assert.equal(scheduler.dispatch({ type: 'request-action', actor: 'princess', actionId: 'cat.crouch_pounce' }).reason, 'WRONG_ACTOR');
  assert.equal(canExecuteAction('__proto__', {}).reason, 'UNKNOWN_ACTION');
  assert.equal(scheduler.getSnapshot().clock, 0);
});

test('princess actions unlock only with the actual loaded skin and complete arm/eyelid bone contracts', () => {
  assert.equal(canExecuteAction('princess.pet_cat', { canUseArmPose: true }).allowed, false);
  assert.equal(canExecuteAction('princess.blink', { ...capabilities, bones: armBones }).allowed, false);
  assert.equal(canExecuteAction('princess.pet_cat', capabilities).allowed, true);
  assert.equal(canExecuteAction('princess.blink', capabilities).allowed, true);
  const runtime = createCharacterInteractionRuntime();
  runtime.setPrincessRig({ capabilities, update() {} });
  assert.equal(runtime.tap('princess').handled, true);
  assert.equal(runtime.getSnapshot().actions.princess.id, 'princess.pet_cat');
  assert.equal(runtime.getSnapshot().actions['held-cat'].id, 'held.nuzzle');
});

test('princess fallbacks use only actions implemented by the bound rig', () => {
  const unavailable = createCharacterInteractionRuntime();
  assert.equal(unavailable.tap('princess').handled, true);
  assert.equal(unavailable.getSnapshot().actions.princess, null);
  assert.equal(unavailable.getSnapshot().actions['held-cat'].id, 'held.nuzzle');

  const cuddle = createCharacterInteractionRuntime();
  cuddle.setPrincessRig({ capabilities: { ...capabilities, supportedActions: ['pair.cuddle_response'] }, update() {} });
  assert.equal(cuddle.tap('princess').handled, true);
  assert.equal(cuddle.getSnapshot().actions.princess.id, 'pair.cuddle_response');
  assert.equal(cuddle.dispatch({ type: 'request-action', actor: 'princess', actionId: 'pair.mutual_gaze' }).reason, 'BLOCKED_BY_RIG');

  const eyelids = createCharacterInteractionRuntime();
  eyelids.setPrincessRig({ capabilities: { ...capabilities, supportedActions: ['princess.blink'] }, update() {} });
  assert.equal(eyelids.tap('princess').handled, true);
  assert.equal(eyelids.getSnapshot().actions.princess.id, 'princess.blink');
});

test('camera dragging finishes existing actions without starting idle actions', () => {
  const scheduler = createInteractionScheduler({ capabilities: { princess: capabilities } });
  scheduler.dispatch({ type: 'tap', actor: 'princess' });
  scheduler.dispatch({ type: 'camera-drag-start' });
  scheduler.advance(.05);
  assert.equal(scheduler.getSnapshot().actions.princess.elapsed, .05);
  for (let frame = 0; frame < 1200; frame++) {
    scheduler.advance(.05);
    if (frame > 50) {
      assert.ok(Object.values(scheduler.getSnapshot().actions).every(action => action === null), 'No idle action starts during a long orbit gesture');
    }
  }
  assert.equal(scheduler.dispatch({ type: 'tap', actor: 'held-cat' }).reason, 'SUPPRESSED');
  scheduler.dispatch({ type: 'camera-drag-end' });
  scheduler.advance(.05);
  assert.ok(Object.values(scheduler.getSnapshot().actions).every(action => action === null), 'Releasing a long drag does not release a burst of overdue idle actions');
  assert.equal(scheduler.dispatch({ type: 'tap', actor: 'held-cat' }).handled, true);
});

test('suspending the scene clears drag state even when OrbitControls never sends end', () => {
  const transitions = [
    [{ type: 'pause', paused: true }, { type: 'pause', paused: false }],
    [{ type: 'visibility', visible: false }, { type: 'visibility', visible: true }],
    [{ type: 'dialog-open' }, { type: 'dialog-close' }],
    [{ type: 'reduced-motion', enabled: true }, { type: 'reduced-motion', enabled: false }],
  ];
  for (const [suspend, resume] of transitions) {
    const runtime = createCharacterInteractionRuntime();
    runtime.dispatch({ type: 'camera-drag-start' });
    assert.equal(runtime.getSnapshot().cameraDragging, true);
    runtime.dispatch(suspend);
    assert.equal(runtime.getSnapshot().cameraDragging, false, suspend.type);
    runtime.dispatch({ type: 'camera-drag-start' });
    assert.equal(runtime.getSnapshot().cameraDragging, false, 'A late control event cannot latch while suspended');
    runtime.dispatch(resume);
    assert.equal(runtime.tap('held-cat').handled, true, `${suspend.type} resumes interaction without an end event`);
  }
});

test('held kitten poses use actual bones, reset every frame, and never touch the ground kitten skeleton', () => {
  const held = catFixture(), ground = catFixture();
  const runtime = createCharacterInteractionRuntime({ seed: 13 });
  runtime.setHeldCat(held); runtime.setGroundTrio({ cats: [ground] });
  runtime.tap('held-cat'); runtime.step(.05); runtime.applyHeld();
  const initial = held.head.quaternion.clone();
  assert.ok(initial.angleTo(new THREE.Quaternion()) > .01);
  const skinPoint = new THREE.Vector3(.1, 0, 0);
  held.meshes[0].applyBoneTransform(1, skinPoint);
  assert.ok(skinPoint.distanceTo(new THREE.Vector3(.1, 0, 0)) > .001, 'bone pose deforms weighted vertices');
  for (let i = 0; i < 600; i++) { runtime.step(0); runtime.applyHeld(); }
  assert.ok(held.head.quaternion.angleTo(initial) < 1e-7, 'no cumulative pose drift at a fixed clock');
  assert.ok(ground.head.quaternion.angleTo(new THREE.Quaternion()) < 1e-7);
});

test('ground additive layer preserves leg IK and restores its cached native pose on reduced motion', () => {
  const cat = catFixture('black');
  const runtime = createCharacterInteractionRuntime();
  runtime.setGroundTrio({ cats: [cat] });
  runtime.dispatch({ type: 'request-action', actor: 'ground-black', actionId: 'cat.head_tilt' });
  for (let i = 0; i < 10; i++) runtime.step(.05);
  const leg = cat.rest.find(rest => rest.bone.name === 'black__LF_upper').bone;
  leg.rotation.z = .23; cat.head.rotation.y = .11;
  const nativeHead = cat.head.quaternion.clone(), nativeLeg = leg.quaternion.clone();
  runtime.applyGround();
  assert.ok(cat.head.quaternion.angleTo(nativeHead) > .1);
  assert.ok(leg.quaternion.angleTo(nativeLeg) < 1e-7);
  runtime.dispatch({ type: 'reduced-motion', enabled: true });
  assert.ok(cat.head.quaternion.angleTo(nativeHead) < 1e-7);
  assert.ok(leg.quaternion.angleTo(nativeLeg) < 1e-7);
});

test('hidden and dialog pauses stop the rig clock and updates; resume clamps a long background gap', () => {
  const updates = [];
  const runtime = createCharacterInteractionRuntime();
  runtime.setPrincessRig({ capabilities, update(clock, action, reduced) { updates.push([clock, action?.id, reduced]); } });
  runtime.step(.05); runtime.applyHeld();
  runtime.dispatch({ type: 'visibility', visible: false });
  for (let i = 0; i < 200; i++) { runtime.step(.05); runtime.applyHeld(); }
  assert.equal(updates.length, 1);
  runtime.dispatch({ type: 'visibility', visible: true });
  runtime.step(80); runtime.applyHeld();
  assert.equal(updates.length, 2);
  assert.ok(Math.abs(updates[1][0] - .1) < 1e-8);
  runtime.dispatch({ type: 'dialog-open' });
  assert.equal(runtime.tap('princess').handled, false);
  runtime.step(.05); runtime.applyHeld();
  assert.equal(updates.length, 2);
});

test('ground tap uses native IK action fields only when settled, and falls back during social play', () => {
  const runtime = createCharacterInteractionRuntime();
  const poses = [{ id: 'black', action: 'idle', actionTime: 0, actionDuration: 0, speed: 0, partnerId: null, attention: 0, position: [8, 4], yaw: .2 }];
  runtime.dispatch({ type: 'request-action', actor: 'ground-black', actionId: 'cat.one_paw_reach' });
  runtime.step(.05); runtime.composeGroundSnapshot(poses);
  assert.equal(poses[0].action, 'paw');
  assert.deepEqual(poses[0].position, [8, 4]);
  assert.equal(poses[0].yaw, .2);
  const blocked = createCharacterInteractionRuntime();
  blocked.dispatch({ type: 'request-action', actor: 'ground-black', actionId: 'cat.crouch_pounce' });
  const social = [{ ...poses[0], action: 'idle', partnerId: 'cream' }];
  blocked.step(.05); blocked.composeGroundSnapshot(social);
  assert.equal(social[0].action, 'idle');
  assert.equal(blocked.getSnapshot().actions['ground-black'].id, 'cat.head_tilt');
});

test('pose buffers are reused across frames without stale channels', () => {
  const held = createHeldKittenPose(), ground = createGroundCatPose();
  const heldHead = held.head, groundHead = ground.head;
  const action = { id: 'cat.head_tilt', elapsed: .5, duration: 1, seed: 2 };
  assert.equal(evaluateHeldKittenAdditivePose(2, action, false, held), held);
  assert.equal(evaluateGroundCatAdditivePose('black', 2, action, 0, false, ground), ground);
  evaluateHeldKittenAdditivePose(2, null, true, held);
  evaluateGroundCatAdditivePose('black', 2, null, 0, true, ground);
  assert.equal(held.head, heldHead); assert.equal(ground.head, groundHead);
  assert.deepEqual(held.head, [0, 0, 0]); assert.deepEqual(ground.head, [0, 0, 0]);
});

test('ground additive frames do not accumulate when the native rig resets its pose', () => {
  const cat = catFixture('black'), runtime = createCharacterInteractionRuntime({ seed: 9 });
  runtime.setGroundTrio({ cats: [cat] });
  runtime.dispatch({ type: 'request-action', actor: 'ground-black', actionId: 'cat.head_tilt' });
  for (let i = 0; i < 10; i++) runtime.step(.05);
  restoreNative(cat); runtime.applyGround();
  const expected = cat.head.quaternion.clone();
  for (let i = 0; i < 600; i++) { runtime.step(0); restoreNative(cat); runtime.applyGround(); }
  assert.ok(cat.head.quaternion.angleTo(expected) < 1e-7);
});

test('renderer-owned matrices produce the same skinned vertices and held anchor with zero extra runtime uploads', () => {
  function fixture(deferMatrices) {
    const scene = new THREE.Scene(), pivot = new THREE.Group(), anchor = new THREE.Group();
    const held = catFixture('cream'), ground = catFixture('black');
    pivot.position.set(4.6, -20.42, 9.35); pivot.rotation.y = -.24;
    anchor.position.set(0, 2.95, .77); anchor.scale.setScalar(.46);
    scene.add(pivot, ground.group); pivot.add(anchor); anchor.add(held.group);
    const runtime = createCharacterInteractionRuntime({ deferMatrices });
    runtime.setHeldCat(held); runtime.setGroundTrio({ cats: [ground] });
    runtime.setPrincessRig({ capabilities, update(clock, action) {
      anchor.position.y = 2.95 + (action?.id === 'princess.adjust_hold' ? Math.sin(Math.PI * action.elapsed / action.duration) ** 2 * .0295 : 0);
    } });
    runtime.dispatch({ type: 'request-action', actor: 'princess', actionId: 'princess.adjust_hold' });
    runtime.dispatch({ type: 'request-action', actor: 'ground-black', actionId: 'cat.head_tilt' });
    let uploads = 0, runtimeWalks = 0;
    for (const cat of [held, ground]) {
      const update = cat.meshes[0].skeleton.update;
      cat.meshes[0].skeleton.update = function () { uploads++; return update.call(this); };
      const walk = cat.group.updateMatrixWorld;
      cat.group.updateMatrixWorld = function (...args) { runtimeWalks++; return walk.apply(this, args); };
    }
    // The real renderer's WebGLObjects updates each skeleton once per render,
    // after WebGLRenderer has updated the scene's world matrices.
    const info = { render: { frame: 0 } };
    const objects = WebGLObjects({}, { get: (_, geometry) => geometry, update() {} }, { update() {} }, info);
    return { scene, held, ground, anchor, runtime, info, objects,
      counters: () => ({ uploads, runtimeWalks }), resetCounters: () => { uploads = 0; runtimeWalks = 0; } };
  }
  const synchronous = fixture(false), deferred = fixture(true);
  for (let frame = 0; frame < 40; frame++) {
    for (const entry of [synchronous, deferred]) {
      entry.runtime.step(.025);
      restoreNative(entry.ground);
      entry.ground.head.rotation.y = .11;
      const leg = entry.ground.rest.find(binding => binding.bone.name === 'black__LF_upper').bone;
      leg.rotation.z = .23;
      // Intermediate native IK matrices are intentionally retained.
      entry.ground.group.updateMatrixWorld(true);
      entry.resetCounters();
      entry.runtime.applyGround(); entry.runtime.applyHeld();
      assert.deepEqual(entry.counters(), entry === deferred ? { uploads: 0, runtimeWalks: 0 } : { uploads: 2, runtimeWalks: 2 });
      assert.ok(Math.abs(leg.rotation.z - .23) < 1e-12, 'Final matrix ownership must not change native foot/leg poses');
      entry.resetCounters();
      entry.scene.updateMatrixWorld();
      entry.info.render.frame++;
      for (const cat of [entry.held, entry.ground]) {
        for (const mesh of cat.meshes) { entry.objects.update(mesh); entry.objects.update(mesh); }
      }
      assert.equal(entry.counters().uploads, 2, 'The actual renderer code deduplicates each skeleton within a frame');
    }
    for (const actor of ['held', 'ground']) {
      assert.deepEqual(deferred[actor].meshes[0].skeleton.boneMatrices, synchronous[actor].meshes[0].skeleton.boneMatrices);
      const expected = synchronous[actor].meshes[0].applyBoneTransform(1, new THREE.Vector3(.1, 0, 0));
      const actual = deferred[actor].meshes[0].applyBoneTransform(1, new THREE.Vector3(.1, 0, 0));
      assert.ok(actual.distanceTo(expected) < 1e-9);
    }
    assert.deepEqual(deferred.anchor.getWorldPosition(new THREE.Vector3()), synchronous.anchor.getWorldPosition(new THREE.Vector3()));
  }
});

test('the deferred held path retains its baked leg pose while only moving expressive joints', () => {
  const held = catFixture('cream');
  const runtime = createCharacterInteractionRuntime({ deferMatrices: true });
  runtime.setHeldCat(held); runtime.tap('held-cat'); runtime.step(.05); runtime.applyHeld();
  const legs = held.rest.filter(binding => /__(LF|RF|LH|RH)_/.test(binding.bone.name));
  const initial = legs.map(binding => binding.bone.quaternion.clone());
  let writes = 0;
  for (const binding of legs) {
    const copy = binding.bone.quaternion.copy;
    binding.bone.quaternion.copy = function (...args) { writes++; return copy.apply(this, args); };
  }
  for (let frame = 0; frame < 200; frame++) { runtime.step(.025); runtime.applyHeld(); }
  assert.equal(writes, 0, 'Constant held legs need no per-frame pose rewrite');
  for (let index = 0; index < legs.length; index++) assert.ok(legs[index].bone.quaternion.angleTo(initial[index]) < 1e-7);
  runtime.dispatch({ type: 'reduced-motion', enabled: true });
  held.group.updateMatrixWorld(true); held.meshes[0].skeleton.update();
  assert.ok(held.meshes[0].skeleton.boneMatrices.every(Number.isFinite));
});
