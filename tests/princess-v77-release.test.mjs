import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile, mkdtemp, readdir, rm, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const baseline = process.env.LUMA_PAGES_BASELINE && path.resolve(process.env.LUMA_PAGES_BASELINE);
const builder = path.join(repo, 'scripts/build-princess-v77-release.mjs');
const baseScene = 'assets/TreeScene-MobileSmooth-20261117-v2.js';
const activeApp = 'assets/App-MobileSmooth-20261117-v2.js';
const releaseScene = 'assets/TreeScene-PrincessRig-V77.js';
const modelPath = 'princess/luma-princess-rigged-v77.glb';
const pages = ['index.html', 'christmas/index.html'];
const runtimeFiles = ['interaction-scheduler.mjs', 'held-kitten-rig.mjs', 'ground-cat-adapter.mjs', 'runtime.mjs', 'princess-rig.mjs'];
const originalFiles = [
  ...pages, baseScene, activeApp, 'letter/index.html', 'CNAME',
  'assets/index-AlbumSwipe-20261117-v5.js',
  'assets/PhotoGallery-FlipFaces-20261117-v10.js',
  'assets/memory-album-flip-faces-v10.css',
  'generated/scene.json', 'generated/photo-manifest.json',
  'journey/film/timeline.json', 'live/data/room.json',
];
const permittedNewFiles = new Set([
  releaseScene, modelPath, modelPath + '.gz', 'v77-release-status.json',
  ...runtimeFiles.map(name => 'assets/princess-kitten-v77/' + name),
]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const importMap = html => JSON.parse(html.match(/<script\s+type="importmap">([\s\S]*?)<\/script>/)?.[1] ?? 'null');
const moduleScripts = html => [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(match => match[1]);

async function treeDigest(directory, prefix = '') {
  const result = {};
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) Object.assign(result, await treeDigest(directory, name + '/'));
    else result[name] = sha256(await readFile(path.join(directory, name)));
  }
  return result;
}

async function fixture(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'luma-v77-release-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // Small real production files suffice. The module-graph check reads unchanged
  // dependencies from the baseline instead of copying photos, films or old GLBs.
  for (const name of originalFiles) {
    await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
    await copyFile(path.join(baseline, name), path.join(directory, name));
  }
  return directory;
}

function build(directory) {
  return spawnSync(process.execPath, [builder, directory], {
    cwd: repo, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024,
  });
}

function expectBuildSuccess(result) {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

async function alterMap(directory, mutate) {
  const name = path.join(directory, 'index.html');
  const original = await readFile(name, 'utf8');
  const map = importMap(original);
  mutate(map);
  await writeFile(name, original.replace(/(<script\s+type="importmap">)[\s\S]*?(<\/script>)/,
    (_, open, close) => open + JSON.stringify(map) + close));
}

// Parse and link the exact production dependency graph without evaluating any
// browser code. This checks real export names across modules as well as syntax.
// Dynamic literal imports are also traversed; importmaps use the page's actual
// final mappings, so the test follows the same shared React/Three modules.
const moduleGraphCheck = String.raw`
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const [target, baseline] = process.argv.slice(1);
const origin = 'https://v77-release.test';
const html = await readFile(path.join(target, 'index.html'), 'utf8');
const imports = JSON.parse(html.match(/<script\s+type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
const modules = new Map();
async function sourceFor(url) {
  const name = new URL(url).pathname.slice(1);
  let root = target;
  try { await access(path.join(root, name)); } catch { root = baseline; }
  return readFile(path.join(root, name), 'utf8');
}
function resolve(specifier, parent) {
  if (!/^(\.\.?\/|\/|https?:)/.test(specifier)) throw new Error('Unexpected bare browser import: ' + specifier);
  let url = new URL(specifier, parent);
  const mapped = imports[url.pathname];
  if (mapped) url = new URL(mapped, origin);
  if (url.origin !== origin) throw new Error('Unexpected external browser module: ' + url.href);
  return url.href;
}
function dynamicImports(source) {
  const found = [...source.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1/g)].map(match => match[2]);
  // The current bootstrap selects the App using pathname ternaries. Resolve
  // that small grammar for both release routes without executing the module.
  for (const match of source.matchAll(/\bimport\s*\((location\.pathname\.includes\([\s\S]*?)\)\.then/g)) {
    for (const pathname of ['/', '/christmas/']) {
      let expression = match[1], selected;
      while (true) {
        const branch = expression.match(/^location\.pathname\.includes\((['"])([^'"]+)\1\)\?(['"])([^'"]+)\3:/);
        if (!branch) break;
        if (selected === undefined && pathname.includes(branch[2])) selected = branch[4];
        expression = expression.slice(branch[0].length);
      }
      const fallback = expression.match(/^(['"])([^'"]+)\1$/);
      if (!fallback) throw new Error('Unsupported App route expression: ' + expression);
      found.push(selected ?? fallback[2]);
    }
  }
  return found;
}
const entryScripts = [...html.matchAll(/<script\b(?=[^>]*\btype="module")[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(match => resolve(match[1], origin + '/'));
if (!entryScripts.length) throw new Error('No production module entrypoint.');
const pending = [...entryScripts];
while (pending.length) {
  const url = pending.pop();
  if (modules.has(url)) continue;
  const source = await sourceFor(url);
  const module = new vm.SourceTextModule(source, { identifier: url });
  modules.set(url, module);
  const children = [...new Set([...module.dependencySpecifiers, ...dynamicImports(source)].map(specifier => resolve(specifier, url)))];
  pending.push(...children);
}
for (const module of modules.values()) {
  if (module.status === 'unlinked') await module.link((specifier, parent) => {
    const url = resolve(specifier, parent.identifier);
    const dependency = modules.get(url);
    if (!dependency) throw new Error('Unresolved browser module: ' + url);
    return dependency;
  });
}
console.log(JSON.stringify({ modules: [...modules.keys()].map(url => new URL(url).pathname), count: modules.size }));
`;

test('V77 production release against a real Pages baseline', {
  skip: !baseline && 'Set LUMA_PAGES_BASELINE to a checkout of the current gh-pages tree.',
}, async t => {
  await access(path.join(repo, 'public', modelPath));
  await access(path.join(repo, 'src/scene/princess-kitten/princess-rig.mjs'));
  const target = await fixture(t);
  const before = await treeDigest(target);
  const originalHtml = Object.fromEntries(await Promise.all(pages.map(async page => [page, await readFile(path.join(target, page), 'utf8')])));
  expectBuildSuccess(build(target));

  await t.test('changes only the two entrypoints and the declared V77 files', async () => {
    const after = await treeDigest(target);
    for (const [name, hash] of Object.entries(before)) {
      assert.ok(Object.hasOwn(after, name), 'Existing production file removed: ' + name);
      if (!pages.includes(name)) assert.equal(after[name], hash, 'Existing production file modified: ' + name);
    }
    const added = Object.keys(after).filter(name => !Object.hasOwn(before, name));
    assert.deepEqual(added.sort(), [...permittedNewFiles].sort());
  });

  await t.test('preserves active album/app mappings and entry scripts while removing old model preload', async () => {
    for (const page of pages) {
      const html = await readFile(path.join(target, page), 'utf8');
      const prior = importMap(originalHtml[page]);
      const current = importMap(html);
      assert.ok(prior?.imports && current?.imports, 'Both pages need valid existing importmaps.');
      assert.deepEqual(current, { ...prior, imports: { ...prior.imports, ['/' + baseScene]: '/' + releaseScene } });
      assert.deepEqual(moduleScripts(html), moduleScripts(originalHtml[page]), 'Entry scripts must stay unchanged.');
      assert.doesNotMatch(html, /__v73GetModelBytes|data-princess-prefetch="v73-fast"/);
      assert.equal((html.match(/<script\s+type="importmap">/g) ?? []).length, 1);
    }
  });

  await t.test('publishes the exact skinned GLB and a lossless gzip with accurate release metadata', async () => {
    const source = await readFile(path.join(repo, 'public', modelPath));
    const published = await readFile(path.join(target, modelPath));
    assert.deepEqual(published, source);
    assert.deepEqual(gunzipSync(await readFile(path.join(target, modelPath + '.gz'))), source);
    assert.equal(published.readUInt32LE(0), 0x46546c67, 'GLB magic');
    assert.equal(published.readUInt32LE(4), 2, 'GLB version');
    assert.equal(published.readUInt32LE(8), published.length, 'GLB declared file length');
    const jsonLength = published.readUInt32LE(12);
    assert.equal(published.readUInt32LE(16), 0x4e4f534a, 'First GLB chunk is JSON.');
    const gltf = JSON.parse(published.subarray(20, 20 + jsonLength).toString());
    assert.ok(gltf.skins?.length > 0, 'Published asset must contain real skins.');
    const reachable = new Set();
    const pending = [...gltf.scenes[gltf.scene ?? 0].nodes];
    while (pending.length) {
      const index = pending.pop();
      if (reachable.has(index)) continue;
      assert.ok(gltf.nodes[index], 'Scene must reference existing nodes.');
      reachable.add(index);
      pending.push(...(gltf.nodes[index].children ?? []));
    }
    const visibleSkins = [...reachable].filter(index => gltf.nodes[index].skin !== undefined);
    assert.ok(visibleSkins.length > 0, 'Skins must be attached to rendered scene nodes.');
    for (const index of visibleSkins) {
      const node = gltf.nodes[index], skin = gltf.skins[node.skin];
      assert.ok(skin?.joints?.length > 0 && gltf.meshes[node.mesh], 'Visible skin must reference real joints and geometry.');
      for (const joint of skin.joints) assert.ok(reachable.has(joint), 'Joint must be in the rendered scene hierarchy.');
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        assert.ok(gltf.accessors[primitive.attributes.JOINTS_0]);
        assert.ok(gltf.accessors[primitive.attributes.WEIGHTS_0]);
      }
    }
    const release = JSON.parse(await readFile(path.join(target, 'v77-release-status.json'), 'utf8'));
    assert.equal(release.model.bytes, source.length);
    assert.equal(release.model.sha256, sha256(source));
    assert.equal(release.scene.sha256, sha256(await readFile(path.join(target, releaseScene))));
    for (const page of pages) assert.equal(release.previousEntrySha256[page], sha256(originalHtml[page]));
  });

  await t.test('new scene and all actual module imports parse and link against the existing production graph', () => {
    const result = spawnSync(process.execPath, ['--experimental-vm-modules', '--input-type=module', '-e', moduleGraphCheck, target, baseline], {
      cwd: repo, encoding: 'utf8', timeout: 60000, maxBuffer: 2 * 1024 * 1024,
    });
    expectBuildSuccess(result);
    const graph = JSON.parse(result.stdout);
    assert.ok(graph.count > runtimeFiles.length);
    assert.ok(graph.modules.includes('/' + releaseScene), 'The active application must reach the new scene.');
    for (const name of runtimeFiles) assert.ok(graph.modules.includes('/assets/princess-kitten-v77/' + name), name);
    assert.ok(graph.modules.includes('/assets/three.module-Bhl-iquR.js'), 'Use the existing Three module.');
    assert.ok(graph.modules.includes('/assets/PhotoGallery-FlipFaces-20261117-v10.js'), 'Keep the current photo-gallery mapping.');
  });

  await t.test('rerunning an accepted V77 release leaves existing assets and entry markup stable', async () => {
    const once = await treeDigest(target);
    expectBuildSuccess(build(target));
    const twice = await treeDigest(target);
    assert.deepEqual(twice, once, 'A repeated accepted release must preserve its original baseline metadata too.');
  });

  await t.test('refuses an altered production Scene before touching existing files', async () => {
    const changed = await fixture(t);
    await writeFile(path.join(changed, baseScene), (await readFile(path.join(changed, baseScene), 'utf8')) + '\n// New production revision\n');
    const snapshot = await treeDigest(changed);
    const result = build(changed);
    assert.notEqual(result.status, 0, 'A changed baseline must require a new review.');
    assert.deepEqual(await treeDigest(changed), snapshot);
  });

  await t.test('refuses an entrypoint that already selects a different Scene without overwriting it', async () => {
    const changed = await fixture(t);
    await alterMap(changed, map => { map.imports['/' + baseScene] = '/assets/TreeScene-NewerProduction.js'; });
    const snapshot = await treeDigest(changed);
    const result = build(changed);
    assert.notEqual(result.status, 0, 'A different active Scene must never be silently replaced.');
    assert.deepEqual(await treeDigest(changed), snapshot, 'Input must remain intact after refusing a mismatched entry.');
  });

  await t.test('refuses an altered active App rather than assuming an old Scene is still in use', async () => {
    const changed = await fixture(t);
    await writeFile(path.join(changed, activeApp), (await readFile(path.join(changed, activeApp), 'utf8')) + '\n// New application revision\n');
    const snapshot = await treeDigest(changed);
    const result = build(changed);
    assert.notEqual(result.status, 0, 'The immutable old Scene alone cannot identify the currently active application.');
    assert.deepEqual(await treeDigest(changed), snapshot);
  });
});
