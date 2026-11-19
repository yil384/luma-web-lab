import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Group, Raycaster, Texture, Vector3 } from 'three';
import { WebGLObjects } from 'three/src/renderers/webgl/WebGLObjects.js';
import { bindPrincessRig } from '../src/scene/princess-kitten/princess-rig.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function readGLB(name) {
  const bytes = fs.readFileSync(path.join(repository, 'public/princess', name));
  const length = bytes.readUInt32LE(12);
  return { bytes, json: JSON.parse(bytes.subarray(20, 20 + length).toString()), binary: bytes.subarray(28 + length) };
}
const original = readGLB('luma-princess-hug-v76.glb');
const generated = readGLB('luma-princess-rigged-v77.glb');
// Node has no browser image decoder. Only texture decoding is substituted;
// GLTFLoader, skin binding, bone matrices and vertex deformation are real Three.
const loader = new GLTFLoader();
loader.register(() => ({ name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(new Texture()) }));
const gltf = await loader.parseAsync(generated.bytes.buffer.slice(generated.bytes.byteOffset, generated.bytes.byteOffset + generated.bytes.byteLength), '');
const rig = bindPrincessRig(gltf.scene);
const skins = [];
gltf.scene.traverse(object => { if (object.isSkinnedMesh) skins.push(object); });
const arms = skins.find(mesh => mesh.name === 'CradleArmsV75');
const lids = skins.filter(mesh => mesh.name.includes('eyelid_'));
const bones = new Map(arms.skeleton.bones.map(bone => [bone.name, bone]));
const anchor = new Group();
anchor.position.set(0, 2.95, 0.77);
rig.setHoldAnchor(anchor);

function positions(mesh) {
  const attribute = mesh.geometry.getAttribute('position');
  const result = new Float32Array(attribute.count * 3);
  const vertex = new Vector3();
  for (let i = 0; i < attribute.count; i++) {
    vertex.fromBufferAttribute(attribute, i);
    mesh.applyBoneTransform(i, vertex).toArray(result, i * 3);
  }
  return result;
}
function maxDelta(a, b, select = () => true) {
  let maximum = 0;
  for (let i = 0; i < a.length / 3; i++) {
    if (select(i)) maximum = Math.max(maximum, Math.hypot(a[i * 3] - b[i * 3], a[i * 3 + 1] - b[i * 3 + 1], a[i * 3 + 2] - b[i * 3 + 2]));
  }
  return maximum;
}
function updateMatrices() {
  gltf.scene.updateWorldMatrix(true, true);
  for (const skeleton of new Set(skins.map(mesh => mesh.skeleton))) skeleton.update();
}
beforeEach(() => rig.update(0, null, true));
after(() => {
  rig.dispose();
  for (const skeleton of new Set(skins.map(mesh => mesh.skeleton))) skeleton.dispose();
});

test('V77 preserves every original geometry, texture and static face byte', () => {
  assert.deepEqual(generated.binary.subarray(0, original.binary.length), original.binary);
  assert.deepEqual(generated.json.meshes.slice(0, 3), original.json.meshes.slice(0, 3));
  assert.deepEqual(generated.json.images, original.json.images);
  const main = gltf.scene.getObjectByName('geometry_0');
  assert(main.isMesh && !main.isSkinnedMesh);
  assert.equal(main.geometry.getAttribute('position').count, 287940);
  assert.deepEqual(generated.json.scenes[0].nodes.slice(0, 3), original.json.scenes[0].nodes);
});

test('capabilities require actual weighted skins and decline unsupported head motions', () => {
  assert.equal(skins.length, 7);
  assert.equal(arms.geometry.getAttribute('position').count, 2798);
  assert.equal(lids.length, 4);
  assert.equal(rig.capabilities.bones.length, 12);
  assert(rig.capabilities.skinned && rig.capabilities.canUseArmPose && rig.capabilities.canBlink);
  assert.equal(rig.capabilities.canUseHeadPose, false);
  assert(!rig.capabilities.supportedActions.includes('pair.mutual_gaze'));
  assert.deepEqual(gltf.animations.map(clip => clip.name), ['hold_idle', 'pet_cat', 'adjust_hold', 'blink']);
  const unrigged = bindPrincessRig(new Group());
  assert.equal(unrigged.capabilities.skinned, false);
  assert.deepEqual(unrigged.capabilities.supportedActions, []);
  unrigged.dispose();
});

test('the loaded skin preserves the arm rest pose and each shoulder, elbow and wrist controls only its own side', () => {
  const rest = positions(arms);
  assert(maxDelta(rest, arms.geometry.getAttribute('position').array) < 2e-7);
  const rootPose = gltf.scene.matrix.clone();
  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? 1 : -1;
    for (const segment of ['upperArm', 'forearm', 'hand']) {
      rig.update(0, null, true);
      bones.get(`${segment}_${side}`).rotateZ(0.04);
      updateMatrices();
      const moved = positions(arms);
      assert(maxDelta(moved, rest, i => rest[i * 3] * sign > 0) > 0.0003, `${segment}_${side} must deform actual vertices`);
      assert(maxDelta(moved, rest, i => rest[i * 3] * sign < 0) < 2e-7, `${segment}_${side} must leave the other arm stationary`);
    }
  }
  assert(gltf.scene.matrix.equals(rootPose));
});

test('each eyelid joint moves its own weighted surface without moving another lid or an arm', () => {
  for (const lid of lids) {
    rig.update(0, null, true);
    const armRest = positions(arms);
    const rest = new Map(lids.map(mesh => [mesh, positions(mesh)]));
    const name = lid.name.replace(/^V77_?\s*/, '');
    const bone = [...bones.values()].find(candidate => lid.name.includes(candidate.name) && candidate.name.startsWith('eyelid_'));
    assert(bone, name);
    bone.position.y += 0.002;
    updateMatrices();
    assert(maxDelta(positions(lid), rest.get(lid)) > 0.0005);
    for (const other of lids) if (other !== lid) assert(maxDelta(positions(other), rest.get(other)) < 2e-7);
    assert(maxDelta(positions(arms), armRest) < 2e-7);
  }
});

test('the closed blink puts fitted skin in front of both eyeballs across their central visible area', () => {
  rig.update(0, { id: 'princess.blink', elapsed: 0.108, duration: 0.26 }, false);
  for (const lid of lids) lid.computeBoundingSphere();
  const eyes = gltf.scene.children.filter(child => child.name.includes('Eye_insert'));
  assert.equal(eyes.length, 2, 'both original eye insert scene roots must be present');
  const ray = new Raycaster();
  const direction = new Vector3(0, 0, -1);
  for (const center of [-0.023963925, 0.023963925]) {
    for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) {
      if (x * x + y * y > 9) continue;
      ray.set(new Vector3(center + x * 0.0024, 0.37515 + y * 0.0018, 0.2), direction);
      const hits = ray.intersectObjects(lids, false);
      assert(hits.length > 0, `closed lid missing at eye ${center}, sample ${x},${y}`);
      const eyeHits = ray.intersectObjects(eyes, true);
      assert(eyeHits.length > 0, 'coverage sample must hit the original eye surface');
      assert(hits[0].distance < eyeHits[0].distance, 'closed lid must be in front of the original eyeball');
    }
  }
});

test('petting holds the supporting arm fixed; adjusting the hold moves kitten and palms together', () => {
  const rest = positions(arms);
  rig.update(0, { id: 'princess.pet_cat', elapsed: 1.2, duration: 2.4 }, false);
  const pet = positions(arms);
  assert(maxDelta(pet, rest, i => rest[i * 3] > 0) > 0.015);
  assert(maxDelta(pet, rest, i => rest[i * 3] < 0) < 2e-7);
  assert.equal(anchor.position.y, 2.95);
  rig.update(0, { id: 'princess.adjust_hold', elapsed: 1.1, duration: 2.2 }, false);
  const adjusted = positions(arms);
  const rises = [];
  for (let i = 0; i < rest.length / 3; i++) if (Math.abs(rest[i * 3]) < 0.036 && rest[i * 3 + 2] > 0.14) rises.push((adjusted[i * 3 + 1] - rest[i * 3 + 1]) * 5.120758);
  const meanRise = rises.reduce((a, b) => a + b, 0) / rises.length;
  assert(Math.abs(meanRise - (anchor.position.y - 2.95)) < 0.0001);
});

test('cuddle produces a real wrist response; reduced motion and repeated updates return to rest without drift', () => {
  const rest = positions(arms);
  const lidRest = positions(lids[0]);
  rig.update(0, { id: 'pair.cuddle_response', elapsed: 0.458, duration: 1.2 }, false);
  assert(maxDelta(positions(arms), rest) > 0.0001);
  assert(maxDelta(positions(lids[0]), lidRest) > 0.002);
  const action = { id: 'princess.adjust_hold', elapsed: 1.1, duration: 2.2 };
  rig.update(0, action, false);
  const once = positions(arms);
  for (let frame = 0; frame < 20; frame++) rig.update(0, action, false);
  assert.deepEqual(positions(arms), once);
  assert(Math.abs(anchor.position.y - 2.9795) < 1e-9);
  rig.update(4.4, action, true);
  assert.deepEqual(positions(arms), rest);
  assert.deepEqual(positions(lids[0]), lidRest);
  assert.equal(anchor.position.y, 2.95);
});

test('deferred arm and eyelid poses equal the synchronous skin after the actual renderer update stage', () => {
  const renderOptions = { deferMatrices: true };
  const info = { render: { frame: 0 } };
  const objects = WebGLObjects({}, { get: (_, geometry) => geometry, update() {} }, { update() {} }, info);
  const skeleton = arms.skeleton, originalUpdate = skeleton.update;
  let uploads = 0;
  skeleton.update = function () { uploads++; return originalUpdate.call(this); };
  try {
    for (const action of [
      { id: 'princess.pet_cat', elapsed: 1.2, duration: 2.4 },
      { id: 'princess.adjust_hold', elapsed: 1.1, duration: 2.2 },
      { id: 'pair.cuddle_response', elapsed: .458, duration: 1.2 },
      { id: 'princess.blink', elapsed: .108, duration: .26 },
    ]) {
      rig.update(2, action, false);
      const expected = skins.map(mesh => positions(mesh));
      const anchorY = anchor.position.y;
      rig.update(0, null, true);
      uploads = 0;
      rig.update(2, action, false, renderOptions);
      assert.equal(uploads, 0, 'The rig must leave skin updates to the renderer');
      assert.equal(anchor.position.y, anchorY, 'The hold anchor must move in the same frame as the wrists');
      gltf.scene.updateMatrixWorld();
      info.render.frame++;
      for (const mesh of skins) objects.update(mesh);
      assert.equal(uploads, 1, 'Seven meshes sharing one skin only require one renderer upload');
      for (let index = 0; index < skins.length; index++) assert(maxDelta(positions(skins[index]), expected[index]) < 2e-7);
    }
  } finally { skeleton.update = originalUpdate; }
});

test('the deferred idle rig skips unchanged bone writes while retaining a full natural blink', () => {
  const renderOptions = { deferMatrices: true };
  let evaluations = 0, closed = false;
  const lid = bones.get('eyelid_upper_L'), openY = lid.position.y;
  for (let frame = 0; frame < 300; frame++) {
    if (rig.update(frame / 60, null, false, renderOptions)) evaluations++;
    if (Math.abs(lid.position.y - openY) > .01) closed = true;
  }
  assert(evaluations > 10 && evaluations < 25, 'A five-second idle period should only write the changing blink frames');
  assert(closed, 'Skipping idle work must retain actual eyelid closure');
  assert(Math.abs(lid.position.y - openY) < 1e-12, 'The eyes reopen after their blink');
});
