import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createCharacterInteractionRuntime} from '../src/scene/princess-kitten/runtime.mjs';

const root = new URL('../', import.meta.url);
let catsBytes;
if (process.env.LUMA_PAGES_BASELINE) {
  catsBytes = fs.readFileSync(path.join(process.env.LUMA_PAGES_BASELINE, 'assets/chonky-cat-trio-BEKpO2QH.glb'));
} else {
  try {
    catsBytes = execFileSync('git', ['show', 'd7fb0d3524841207d8620ac21e8f9510761d80ec:assets/chonky-cat-trio-BEKpO2QH.glb'], {cwd: root, maxBuffer: 5e6, stdio: ['ignore', 'pipe', 'ignore']});
  } catch {
    test.skip('real production character hit proxies require LUMA_PAGES_BASELINE or the pinned Pages revision');
  }
}
if (catsBytes) {
const loader = new GLTFLoader();
loader.register(() => ({name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(new THREE.Texture())}));
loader.register(() => ({name: 'test_texture_stub', loadTexture: () => Promise.resolve(new THREE.Texture())}));
const princessBytes = fs.readFileSync(new URL('public/princess/luma-princess-rigged-v77.glb', root));
const parse = bytes => loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const [princessAsset, catsAsset] = await Promise.all([parse(princessBytes), parse(catsBytes)]);
const princess = princessAsset.scene;
const cat = new THREE.Group();
cat.add(catsAsset.scene.getObjectByName('chonky_cream'));
cat.updateMatrixWorld(true);
const rest = [], meshes = [];
cat.traverse(node => {
  if (node.isBone) rest.push({bone: node, position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone()});
  if (node.isSkinnedMesh) meshes.push(node);
});
const runtime = createCharacterInteractionRuntime({seed: 78});
runtime.setHeldCat({id: 'cream', group: cat, rest, meshes, body: cat.getObjectByName('cream__body')});
runtime.step(0); runtime.applyHeld();

// Instantiate the production component's actual descriptors. The test does not
// maintain a second list of proxy bounds or transforms that could silently drift.
const Fragment = Symbol('Fragment');
const jsx = (type, props) => ({type, props});
let stateIndex = 0;
const context = {
  module: {exports: {}},
  fe: {jsx, jsxs: jsx, Fragment},
  U: {
    useState: () => [stateIndex++ === 0 ? {model: princess, cat} : false, () => {}],
    useRef: current => ({current}), useEffect: () => {}, useLayoutEffect: () => {},
  },
  J: THREE.Vector3, URLSearchParams, location: {search: ''},
  window: {matchMedia: () => ({matches: false})},
  $e: () => ({gl: {domElement: {style: {}}}, invalidate: () => {}}),
  zt: () => {},
};
vm.runInNewContext(fs.readFileSync(new URL('src/scene/princess-kitten/production-component.inc.js', root), 'utf8') +
  '\nmodule.exports = {GeminiPrincessV77, configureCharacterHitProxyV78};', context);
const component = context.module.exports;
component.configureCharacterHitProxyV78(princess);
component.configureCharacterHitProxyV78(cat);

function attach(parent, descriptor) {
  if (descriptor == null || descriptor === false) return;
  if (Array.isArray(descriptor)) { for (const item of descriptor) attach(parent, item); return; }
  if (typeof descriptor.type === 'function') { attach(parent, descriptor.type(descriptor.props)); return; }
  if (descriptor.type === Fragment) { attach(parent, descriptor.props.children); return; }
  const props = descriptor.props || {};
  let object;
  if (descriptor.type === 'group') object = new THREE.Group();
  else if (descriptor.type === 'primitive') object = props.object;
  else if (descriptor.type === 'mesh') object = new THREE.Mesh();
  else if (descriptor.type === 'boxGeometry') { parent.geometry = new THREE.BoxGeometry(...props.args); return; }
  else if (descriptor.type === 'meshBasicMaterial') { parent.material = new THREE.MeshBasicMaterial(); return; }
  else if (descriptor.type === 'pointLight') return;
  else throw new Error('Unhandled production descriptor: ' + String(descriptor.type));
  if (props.name) object.name = props.name;
  if (props.position) object.position.fromArray(props.position);
  if (props.rotation) object.rotation.fromArray(props.rotation);
  if (props.scale) object.scale.fromArray(props.scale);
  if (props.visible !== undefined) object.visible = props.visible;
  if (props.ref) props.ref.current = object;
  parent.add(object);
  attach(object, props.children);
}
const scene = new THREE.Scene();
attach(scene, component.GeminiPrincessV77({characterRuntime: runtime}));
scene.updateMatrixWorld(true);
const proxies = [];
scene.traverse(node => { if (/^(princess|held-kitten)-hit-/.test(node.name)) proxies.push(node); });
const point = (object, xyz) => new THREE.Vector3(...xyz).applyMatrix4(object.matrixWorld);
const princessPoint = point(princess, [0, .28, .055]);
const heldPoint = cat.getObjectByName('cream__body').getWorldPosition(new THREE.Vector3());

test('production proxies are invisible, pickable and leave visual geometry buffers untouched', () => {
  assert.equal(proxies.length, 5);
  assert.ok(proxies.every(proxy => proxy.visible === false));
  let visualVertices = 0;
  princess.traverse(node => {
    if (!node.isMesh) return;
    visualVertices += node.geometry.getAttribute('position').count;
    const result = [];
    node.raycast(new THREE.Raycaster(), result);
    assert.equal(result.length, 0);
  });
  assert.equal(visualVertices, 315834);
  const ray = new THREE.Raycaster(princessPoint.clone().add(new THREE.Vector3(0, 0, 10)), new THREE.Vector3(0, 0, -1));
  assert.ok(ray.intersectObjects(proxies, false).length > 0, 'Three must still pick invisible proxy meshes.');
  assert.ok(ray.intersectObject(scene, true).every(hit => proxies.includes(hit.object)), 'The high-poly meshes must not participate.');
});

test('princess and held kitten retain distinct click targets at home, close and oblique camera positions', () => {
  const center = princessPoint.clone().add(heldPoint).multiplyScalar(.5);
  const cameraOrigins = [
    new THREE.Vector3(0, -2, 50),
    center.clone().add(new THREE.Vector3(0, 1.2, 8)),
    center.clone().add(new THREE.Vector3(-6, 1.8, 13)),
    center.clone().add(new THREE.Vector3(6, 1.8, 13)),
  ];
  for (const origin of cameraOrigins) for (const [target, expected] of [[princessPoint, 'princess-hit-'], [heldPoint, 'held-kitten-hit-']]) {
    const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize());
    const hits = ray.intersectObject(scene, true);
    assert.ok(hits.length > 0, 'Expected a click target at ' + origin.toArray());
    assert.ok(hits[0].object.name.startsWith(expected), `${expected} from ${origin.toArray()} hit ${hits[0].object.name}`);
  }
});
}
