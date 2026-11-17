import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { finalizeBuild } from '../scripts/finalize-build.mjs';

async function temporaryProject(t) {
  const root = await mkdtemp(join(tmpdir(), 'christmas-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('finalizing excludes deployed originals while preserving source photos, generated images and CNAME', async t => {
  const root = await temporaryProject(t);
  const fixtures = {
    'dist/index.html': '<html>gift</html>',
    'dist/photos/original.jpg': 'large-original',
    'dist/vite.svg': 'starter',
    'dist/backgrounds/night.jpg': 'large-night-original',
    'dist/scene.json': 'source-config',
    'dist/generated/background/night.webp': 'small-night-image',
    'dist/generated/scene.json': 'prepared-scene',
    'public/backgrounds/night.jpg': 'source-night-original',
    'public/scene.json': 'source-scene',
    'dist/generated/photos/compressed.webp': 'small-display-image',
    'dist/generated/photo-manifest.json': '{"version":1,"photos":[]}',
    'dist/CNAME': 'www.weiyirao.com',
    'public/photos/original.jpg': 'source-original',
    'public/vite.svg': 'source-starter',
  };
  for (const [path, content] of Object.entries(fixtures)) {
    const absolute = join(root, path);
    await mkdir(join(absolute, '..'), { recursive: true });
    await writeFile(absolute, content);
  }
  assert.deepEqual(await finalizeBuild({ root }), { removedPhotos: true, removedStarterIcon: true });
  for (const path of ['dist/photos/original.jpg', 'dist/vite.svg', 'dist/backgrounds/night.jpg', 'dist/scene.json']) {
    await assert.rejects(readFile(join(root, path)), { code: 'ENOENT' });
  }
  for (const path of Object.keys(fixtures).filter(path => !['dist/photos/original.jpg', 'dist/vite.svg', 'dist/backgrounds/night.jpg', 'dist/scene.json'].includes(path))) {
    assert.equal(await readFile(join(root, path), 'utf8'), fixtures[path]);
  }
  assert.deepEqual(await finalizeBuild({ root }), { removedPhotos: false, removedStarterIcon: false });
});

test('missing build output fails before deleting anything', async t => {
  const root = await temporaryProject(t);
  await assert.rejects(finalizeBuild({ root }), /dist\/index\.html is missing/);
  await mkdir(join(root, 'dist', 'photos'), { recursive: true });
  await writeFile(join(root, 'dist', 'photos', 'keep.jpg'), 'keep');
  await assert.rejects(finalizeBuild({ root }), /dist\/index\.html is missing/);
  assert.equal(await readFile(join(root, 'dist', 'photos', 'keep.jpg'), 'utf8'), 'keep');
});

test('interrupted photo staging is excluded while source staging and published media survive', async t => {
  const root = await temporaryProject(t);
  const staging = '.photos-69e61d96-6886-4b15-8dea-3fb0301da10e/unfinished.webp';
  const paths = ['dist/index.html', `dist/generated/${staging}`, `public/generated/${staging}`,
    'dist/generated/photos/final.webp', 'dist/generated/videos/final.mp4', 'dist/video-posters/christmas-film.webp'];
  for (const path of paths) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), path);
  }
  await finalizeBuild({ root });
  await assert.rejects(readFile(join(root, 'dist/generated', staging)), { code: 'ENOENT' });
  for (const path of paths.filter(path => path !== `dist/generated/${staging}`)) {
    assert.equal(await readFile(join(root, path), 'utf8'), path);
  }
});

test('a symlinked dist directory is rejected without touching its target', async t => {
  const root = await temporaryProject(t);
  await mkdir(join(root, 'unrelated', 'photos'), { recursive: true });
  await writeFile(join(root, 'unrelated', 'index.html'), 'other site');
  await writeFile(join(root, 'unrelated', 'photos', 'keep.jpg'), 'keep');
  await symlink(join(root, 'unrelated'), join(root, 'dist'), 'dir');
  await assert.rejects(finalizeBuild({ root }), /Expected a real dist directory/);
  assert.equal(await readFile(join(root, 'unrelated', 'photos', 'keep.jpg'), 'utf8'), 'keep');
});

test('home and fixed routes retain their own share metadata after homepage restoration', async t => {
  const root = await temporaryProject(t);
  await mkdir(join(root, 'dist'), { recursive: true });
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  await writeFile(join(root, 'dist/index.html'), source);
  await finalizeBuild({ root });
  const home = await readFile(join(root, 'dist/index.html'), 'utf8');
  const christmas = await readFile(join(root, 'dist/christmas/index.html'), 'utf8');
  const letter = await readFile(join(root, 'dist/letter/index.html'), 'utf8');
  for (const html of [home, christmas]) {
    assert.match(html, /<title>集美小喵的圣诞魔法<\/title>/);
    assert.match(html, /property="og:image" content="https:\/\/tanchensiyi\.com\/film\/starlight-return-poster\.webp"/);
    assert.doesNotMatch(html, /给谭陈思仪的城堡巡游/);
  }
  assert.match(home, /property="og:url" content="https:\/\/tanchensiyi\.com\/"/);
  assert.match(christmas, /property="og:url" content="https:\/\/tanchensiyi\.com\/christmas\/"/);
  assert.match(letter, /<title>月光秘境 · 思仪<\/title>/);
  assert.match(letter, /name="description" content="给谭陈思仪的城堡巡游，和一句我喜欢你。"/);
  assert.match(letter, /property="og:description" content="给谭陈思仪的城堡巡游，和一句我喜欢你。"/);
  assert.doesNotMatch(letter, /照片圣诞树/);
  assert.match(letter, /property="og:image" content="https:\/\/tanchensiyi\.com\/journey\/cover\.webp"/);
  assert.match(letter, /property="og:url" content="https:\/\/tanchensiyi\.com\/letter\/"/);
  assert.match(letter, /请启用 JavaScript，进入城堡。/);
});


test('V72 opt-in build retains only the selected real GLB and drops old princess media', async t => {
  const root = await temporaryProject(t);
  const fixtures = {
    'dist/index.html': '<html>christmas</html>',
    'dist/princess/luma-princess-v72.glb': 'v72-binary-fixture',
    'dist/princess/arrival.mp4': 'legacy-film',
    'dist/princess/other-old.glb': 'legacy-asset',
    'dist/generated/photos/final.webp': 'generated-photo',
  };
  for (const [path, content] of Object.entries(fixtures)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), content);
  }
  await finalizeBuild({ root, includePrincessV72: true });
  assert.equal(await readFile(join(root, 'dist/princess/luma-princess-v72.glb'), 'utf8'), 'v72-binary-fixture');
  assert.equal(await readFile(join(root, 'dist/generated/photos/final.webp'), 'utf8'), 'generated-photo');
  for (const legacy of ['dist/princess/arrival.mp4', 'dist/princess/other-old.glb']) {
    await assert.rejects(readFile(join(root, legacy)), { code: 'ENOENT' });
  }
  // Re-running cleanup with V72 enabled is idempotent.
  await finalizeBuild({ root, includePrincessV72: true });
  assert.equal(await readFile(join(root, 'dist/princess/luma-princess-v72.glb'), 'utf8'), 'v72-binary-fixture');
});

test('V72 build fails closed if requested model is absent', async t => {
  const root = await temporaryProject(t);
  await mkdir(join(root, 'dist', 'princess'), { recursive: true });
  await writeFile(join(root, 'dist', 'index.html'), '<html>test</html>');
  await writeFile(join(root, 'dist', 'princess', 'old-portrait.webp'), 'old');
  await assert.rejects(finalizeBuild({ root, includePrincessV72: true }), /luma-princess-v72\.glb is missing/);
});

test('V72 not enabled continues to strip princess assets from output', async t => {
  const root = await temporaryProject(t);
  await mkdir(join(root, 'dist', 'princess'), { recursive: true });
  await writeFile(join(root, 'dist', 'index.html'), '<html>test</html>');
  await writeFile(join(root, 'dist', 'princess', 'luma-princess-v72.glb'), 'v72');
  await finalizeBuild({ root, includePrincessV72: false });
  await assert.rejects(readFile(join(root, 'dist', 'princess', 'luma-princess-v72.glb')), { code: 'ENOENT' });
});
