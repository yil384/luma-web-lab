import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { PRINCESS_V72, inspectPrincessGlb, validatePrincessV72 } from '../scripts/princess-v72-contract.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function fakeGlb(doc) {
  const json = Buffer.from(JSON.stringify(doc));
  const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const bin = Buffer.alloc(4);
  const out = Buffer.alloc(12 + 8 + padded.length + 8 + bin.length);
  out.write('glTF', 0, 'ascii'); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(padded.length, 12); out.write('JSON', 16, 'ascii');
  padded.copy(out, 20);
  const off = 20 + padded.length;
  out.writeUInt32LE(bin.length, off); out.write('BIN\0', off + 4, 'ascii'); bin.copy(out, off + 8);
  return out;
}
const doc = {asset:{version:'2.0'},meshes:[{primitives:[{attributes:{POSITION:0},mode:4}]}],
  accessors:[{count:3}],buffers:[{byteLength:4}]};

test('GLB parser accepts an embedded triangle', () => {
  const report = inspectPrincessGlb(fakeGlb(doc));
  assert.equal(report.meshes,1); assert.equal(report.triangles,1);
});
test('GLB parser rejects corrupt header and external texture URLs', () => {
  const broken = fakeGlb(doc);
  broken.writeUInt32LE(123, 8);
  assert.throws(() => inspectPrincessGlb(broken), /declared length/);
  assert.throws(() => inspectPrincessGlb(fakeGlb({...doc,images:[{uri:'https://example.invalid/img.png'}]})), /external resource/);
});
test('V72 loader is preview-gated and has a procedural fallback', async () => {
  assert.equal(PRINCESS_V72.assetPath,'public/princess/luma-princess-v72.glb');
  assert.match(PRINCESS_V72.sha256,/^[0-9a-f]{64}$/);
  const loader = await readFile(join(root,'src/scene/PrincessAsset.tsx'),'utf8');
  assert.match(loader,/VITE_PRINCESS_V72_PREVIEW === 'true'/);
  assert.match(loader,/FairytalePrincess/);
  assert.match(loader,/luma-princess-v72\.glb/);
});
test('when the GLB is installed, it is exactly Gemini V72', async t => {
  const local = join(root, PRINCESS_V72.assetPath);
  try { await access(local); } catch {
    t.skip('Large GLB is staged separately, not bundled in the text-only branch CI');
    return;
  }
  const report = validatePrincessV72(await readFile(local));
  assert.equal(report.triangles,333247);
});
