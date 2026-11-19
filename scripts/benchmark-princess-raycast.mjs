#!/usr/bin/env node
/**
 * Repeatable CPU raycast benchmark against the real V77 geometry/skins.
 * This is a body-intersecting ray, not a browser or physical-phone FPS test.
 * Texture maps are omitted only to let Node parse the original geometry without
 * an image decoder. All vertex/index buffers, bones and weights are preserved.
 *
 * node scripts/benchmark-princess-raycast.mjs --revision d7fb0d3 --iterations 40
 * Add --output /absolute/report.json to retain the machine-readable evidence.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const repository = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const options = { revision: 'origin/gh-pages', iterations: 40, output: null };
for (let index = 0; index < args.length; index += 2) {
  const key = args[index].replace(/^--/, '');
  if (!Object.hasOwn(options, key) || args[index + 1] === undefined) throw new Error('Unknown or incomplete option: ' + args[index]);
  options[key] = key === 'iterations' ? Number(args[index + 1]) : args[index + 1];
}
if (!Number.isInteger(options.iterations) || options.iterations < 10 || options.iterations > 1000) throw new Error('iterations must be between 10 and 1000.');
const assetPath = 'princess/luma-princess-rigged-v77.glb';
const revision = execFileSync('git', ['rev-parse', options.revision], { cwd: repository, encoding: 'utf8' }).trim();
const original = execFileSync('git', ['show', revision + ':' + assetPath], { cwd: repository, maxBuffer: 64 * 1024 * 1024 });
const jsonLength = original.readUInt32LE(12);
const gltf = JSON.parse(original.subarray(20, 20 + jsonLength));
function omitTextureMaps(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (/texture$/i.test(key)) delete value[key];
    else omitTextureMaps(value[key]);
  }
}
for (const material of gltf.materials ?? []) omitTextureMaps(material);
const json = Buffer.from(JSON.stringify(gltf));
const paddedLength = Math.ceil(json.length / 4) * 4;
const binaryChunk = original.subarray(20 + jsonLength);
const bytes = Buffer.alloc(20 + paddedLength + binaryChunk.length, 32);
bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
bytes.writeUInt32LE(paddedLength, 12); bytes.writeUInt32LE(0x4e4f534a, 16);
json.copy(bytes, 20); binaryChunk.copy(bytes, 20 + paddedLength);
const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const root = asset.scene;
root.updateMatrixWorld(true);
const skeletons = new Set();
const meshes = [];
root.traverse(object => { if (object.isMesh) meshes.push(object); if (object.isSkinnedMesh) skeletons.add(object.skeleton); });
for (const skeleton of skeletons) skeleton.update();
const bounds = new THREE.Box3().setFromObject(root);
const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
const raycaster = new THREE.Raycaster(center.clone().add(new THREE.Vector3(0, 0, size.z + size.y)), new THREE.Vector3(0, 0, -1));

function measure() {
  const samples = [];
  for (let index = 0; index < 6; index++) raycaster.intersectObject(root, true);
  let hitCount = 0;
  for (let index = 0; index < options.iterations; index++) {
    const started = performance.now();
    hitCount = raycaster.intersectObject(root, true).length;
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const at = fraction => Number(samples[Math.min(samples.length - 1, Math.floor(samples.length * fraction))].toFixed(4));
  return { samples: samples.length, hitCount, medianMs: at(0.5), p95Ms: at(0.95), minMs: at(0) };
}
const baseline = measure();
const noRaycast = () => {};
for (const mesh of meshes) mesh.raycast = noRaycast;
// Head, torso and skirt envelopes from the actual V77 source vertices. These
// approximate the intended pointer target; the rendered model is unchanged.
const proxyRegions = [
  { center: [-0.0002, 0.39015, -0.04219], size: [0.27746, 0.22030, 0.23801] },
  { center: [0.00111, 0.16000, -0.01842], size: [0.47298, 0.24000, 0.36844] },
  { center: [0.00048, -0.22978, -0.00067], size: [0.68798, 0.53953, 0.75610] },
];
for (const region of proxyRegions) {
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(...region.size), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.fromArray(region.center);
  root.add(proxy);
}
root.updateMatrixWorld(true);
const candidate = measure();
const triangles = mesh => (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
const report = {
  revision, assetPath, assetSha256: createHash('sha256').update(original).digest('hex'), threeRevision: THREE.REVISION,
  input: { meshes: meshes.length, triangles: meshes.reduce((sum, mesh) => sum + triangles(mesh), 0),
    skinnedTriangles: meshes.filter(mesh => mesh.isSkinnedMesh).reduce((sum, mesh) => sum + triangles(mesh), 0) },
  scenario: 'Body-intersecting ray, recursive group hit-test, same real geometry and bone transforms',
  baseline, candidate: { ...candidate, proxyRegions: 3, proxyTriangles: 36 },
  medianCpuReductionPercent: Number(((1 - candidate.medianMs / baseline.medianMs) * 100).toFixed(2)),
  limitation: 'Node CPU benchmark only. Texture maps omitted for decoding; no GPU render or physical-phone FPS measured.',
};
const serialized = JSON.stringify(report, null, 2) + '\n';
if (options.output) await writeFile(path.resolve(options.output), serialized);
process.stdout.write(serialized);
