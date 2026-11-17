import { createHash } from 'node:crypto';

/** Pinned to the user-supplied Gemini V72 candidate, not earlier models. */
export const PRINCESS_V72 = Object.freeze({
  assetPath: 'public/princess/luma-princess-v72.glb',
  sourceFilename: 'princess-eyes-candidate-v72.glb',
  sha256: '9bbf7c0ed5da9b7372906a30b665f0e118a3a66c3122e1499ea8dc4ecd454cbf',
  bytes: 15329160,
  meshes: 3,
  triangles: 333247,
  textures: 4,
  skins: 0,
  animations: 0,
});

/** Validates an embedded-texture glTF 2.0 binary; file errors fail closed. */
export function inspectPrincessGlb(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 20) throw new Error('Not a valid GLB file');
  if (buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2) {
    throw new Error('Expected glTF 2.0 binary');
  }
  if (buffer.readUInt32LE(8) !== buffer.length) throw new Error('Incorrect GLB declared length');
  let offset = 12;
  let doc;
  let binChunks = 0;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) throw new Error('Truncated GLB chunk header');
    const length = buffer.readUInt32LE(offset);
    const kind = buffer.toString('ascii', offset + 4, offset + 8);
    offset += 8;
    if (offset + length > buffer.length || length % 4 !== 0) throw new Error('Malformed GLB chunk');
    if (kind === 'JSON') {
      if (doc) throw new Error('Multiple JSON chunks');
      doc = JSON.parse(buffer.toString('utf8', offset, offset + length).replace(/\0+$/, '').trim());
    } else if (kind === 'BIN\0') binChunks++;
    offset += length;
  }
  if (!doc || binChunks !== 1 || doc.asset?.version !== '2.0') throw new Error('Missing glTF 2.0 JSON or binary content');
  if (!doc.meshes?.length) throw new Error('GLB has no mesh');
  for (const item of [...(doc.buffers || []), ...(doc.images || [])]) {
    if (item.uri && !item.uri.startsWith('data:')) throw new Error('GLB has an external resource URL');
  }
  const accessors = doc.accessors || [];
  let triangles = 0;
  for (const mesh of doc.meshes) for (const primitive of mesh.primitives || []) {
    if ((primitive.mode ?? 4) !== 4) continue;
    const accessorIndex = primitive.indices ?? primitive.attributes?.POSITION;
    const count = accessors[accessorIndex]?.count;
    if (!Number.isInteger(count) || count < 0 || count % 3 !== 0) throw new Error('Invalid triangle index accessor');
    triangles += count / 3;
  }
  return {
    sha256: createHash('sha256').update(buffer).digest('hex'),
    bytes: buffer.length,
    meshes: doc.meshes.length,
    triangles,
    textures: (doc.textures || []).length,
    skins: (doc.skins || []).length,
    animations: (doc.animations || []).length,
    textureExtension: doc.extensionsRequired?.includes('EXT_texture_webp') ?? false,
  };
}

export function validatePrincessV72(buffer) {
  const actual = inspectPrincessGlb(buffer);
  for (const key of ['sha256', 'bytes', 'meshes', 'triangles', 'textures', 'skins', 'animations']) {
    if (actual[key] !== PRINCESS_V72[key]) {
      throw new Error('Wrong princess GLB: ' + key + ' expected ' + PRINCESS_V72[key] + ', found ' + actual[key]);
    }
  }
  if (!actual.textureExtension) throw new Error('Expected the V72 WebP texture extension');
  return actual;
}
