import { lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function exists(path) {
  try { await lstat(path); return true; }
  catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/** Finish Vite output without ever modifying source photos or generated WebP assets. */
export async function finalizeBuild({ root = projectRoot, includePrincessV72 = process.env.VITE_PRINCESS_V72_PREVIEW === 'true' } = {}) {
  const dist = join(root, 'dist');
  let directory;
  let index;
  try {
    directory = await lstat(dist);
    index = await lstat(join(dist, 'index.html'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('Build output dist/index.html is missing. Run the Vite build before finalizing.');
    }
    throw error;
  }
  if (!directory.isDirectory() || directory.isSymbolicLink() || !index.isFile() || index.isSymbolicLink()) {
    throw new Error('Expected a real dist directory containing a regular index.html file.');
  }

  // Keep these paths explicit: never accept an arbitrary directory to remove.
  const originals = join(dist, 'photos');
  const starterIcon = join(dist, 'vite.svg');
  const removedPhotos = await exists(originals);
  const removedStarterIcon = await exists(starterIcon);
  await rm(originals, { recursive: true, force: true });
  await rm(join(dist, 'backgrounds'), { recursive: true, force: true });
  await rm(join(dist, 'characters'), { recursive: true, force: true });
  await rm(join(dist, 'videos'), { recursive: true, force: true });
  // The former confession entry is no longer reachable. Keep its source
  // assets in public for history, but do not ship its obsolete films or
  // unattached image imports with the current ride and Christmas routes.
  // The old princess media are unreachable. When V72 is explicitly enabled,
  // retain exactly its verified static GLB; otherwise remove princess/ as before.
  // This must match PrincessAsset.tsx and the V72 staging workflow.
  const princess = join(dist, 'princess');
  if (includePrincessV72) {
    const princessDir = await lstat(princess).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!princessDir?.isDirectory() || princessDir.isSymbolicLink()) {
      throw new Error('V72 was enabled but dist/princess is not a real directory.');
    }
    const modelPath = join(princess, 'luma-princess-v72.glb');
    const model = await lstat(modelPath).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (!model?.isFile() || model.isSymbolicLink()) {
      throw new Error('V72 was enabled but dist/princess/luma-princess-v72.glb is missing or invalid.');
    }
    for (const entry of await readdir(princess)) {
      if (entry !== 'luma-princess-v72.glb') {
        await rm(join(princess, entry), { recursive: true, force: true });
      }
    }
  } else {
    await rm(princess, { recursive: true, force: true });
  }
  await rm(join(dist, 'hd-assets'), { recursive: true, force: true });
  await rm(join(dist, 'scene.json'), { force: true });
  await rm(starterIcon, { force: true });
  // An interrupted photo preparation can leave its private staging directory
  // under public/generated. Vite copies it, but it is never a published asset.
  const generated = join(dist, 'generated');
  if (await exists(generated)) {
    const generatedInfo = await lstat(generated);
    if (generatedInfo.isDirectory() && !generatedInfo.isSymbolicLink()) {
      for (const entry of await readdir(generated, { withFileTypes: true })) {
        if (/^\.photos-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(entry.name)) {
          await rm(join(generated, entry.name), { recursive: true, force: true });
        }
      }
    }
  }
  // These are real static entry files, so shared links and refreshes do not
  // depend on a hosting provider's SPA fallback. Vite emits root asset URLs.
  const entry = await readFile(join(dist, 'index.html'), 'utf8');
  for (const route of ['letter', 'christmas']) {
    await mkdir(join(dist, route), { recursive: true });
    const html = (route === 'letter' ? entry
      .replaceAll('送给集美小喵的圣诞魔法：童话城堡、雪中的小猫与一棵照片圣诞树。', '给谭陈思仪的城堡巡游，和一句我喜欢你。')
      .replaceAll('集美小喵的圣诞魔法', '月光秘境 · 思仪')
      .replace('https://tanchensiyi.com/film/starlight-return-poster.webp', 'https://tanchensiyi.com/journey/cover.webp')
      .replace('name="theme-color" content="#15203b"', 'name="theme-color" content="#080e25"')
      .replace('请启用 JavaScript 来打开照片圣诞树。', '请启用 JavaScript，进入城堡。')
      : entry)
      .replace('property="og:url" content="https://tanchensiyi.com/"', `property="og:url" content="https://tanchensiyi.com/${route}/"`);
    await writeFile(join(dist, route, 'index.html'), html);
  }
  // Browser-native project Pages do not run Jekyll; keep a real static file.
  await writeFile(join(dist, '.nojekyll'), '');
  // A stale custom domain must never be shipped to a GitHub project path.
  if (process.env.SITE_BASE_PATH && process.env.SITE_BASE_PATH !== '/') {
    await rm(join(dist, 'CNAME'), { force: true });
  }
  return { removedPhotos, removedStarterIcon };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  finalizeBuild().then(() => {
    console.log('Build finalized: source photos/backgrounds excluded; generated WebP images retained.');
  }).catch(error => {
    console.error(`Build finalization failed: ${error.message}`);
    process.exitCode = 1;
  });
}
