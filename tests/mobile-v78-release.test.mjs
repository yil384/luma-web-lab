import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, copyFile, mkdtemp, readdir, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = fileURLToPath(new URL('..',import.meta.url));
const baseline = process.env.LUMA_PAGES_BASELINE;
const builder = path.join(repo,'scripts/build-mobile-v78-release.mjs');
const scene = 'assets/TreeScene-MobileGestures-V78.js';
const oldScene = 'assets/TreeScene-PrincessRig-V77.js';
const model = 'princess/luma-princess-rigged-v77.glb';
const pages = ['index.html','christmas/index.html'];
const modules = ['interaction-scheduler.mjs','held-kitten-rig.mjs','ground-cat-adapter.mjs','runtime.mjs','princess-rig.mjs','mobile-performance.mjs'];
const retained = [...pages,oldScene,model,model+'.gz','v77-release-status.json','assets/App-MobileSmooth-20261117-v2.js',
  'assets/PhotoGallery-FlipFaces-20261117-v10.js','assets/memory-album-flip-faces-v10.css',
  'generated/scene.json','generated/photo-manifest.json','journey/film/timeline.json','letter/index.html','CNAME'];
const allowed = [scene,'v78-release-status.json',...modules.map(name=>'assets/princess-kitten-v78/'+name)];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const importMap = html => JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
async function digest(dir,prefix='') {
  const result={};
  for(const entry of await readdir(path.join(dir,prefix),{withFileTypes:true})) {
    const name=prefix+entry.name;
    if(entry.isDirectory())Object.assign(result,await digest(dir,name+'/'));
    else result[name]=hash(await readFile(path.join(dir,name)));
  }
  return result;
}
async function fixture(t) {
  const dir=await mkdtemp(path.join(tmpdir(),'luma-v78-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  for(const name of retained) {
    await mkdir(path.dirname(path.join(dir,name)),{recursive:true});
    await copyFile(path.join(baseline,name),path.join(dir,name));
  }
  return dir;
}
function build(dir) {return spawnSync(process.execPath,[builder,dir],{cwd:repo,encoding:'utf8',timeout:60000});}
function success(result) {assert.ifError(result.error);assert.equal(result.status,0,result.stderr||result.stdout);}

test('V78 patches the real V77 entry and preserves existing content', {skip:!baseline&&'Requires LUMA_PAGES_BASELINE'}, async t=>{
  const dir=await fixture(t),before=await digest(dir);
  const htmlBefore=await readFile(path.join(dir,'index.html'),'utf8');
  success(build(dir));
  await t.test('only entry maps and new versioned files change',async()=>{
    const after=await digest(dir);
    for(const [name,sha] of Object.entries(before)) {
      assert.ok(Object.hasOwn(after,name),'Removed '+name);
      if(!pages.includes(name))assert.equal(after[name],sha,'Modified '+name);
    }
    assert.deepEqual(Object.keys(after).filter(name=>!Object.hasOwn(before,name)).sort(),allowed.sort());
    const previous=importMap(htmlBefore),current=importMap(await readFile(path.join(dir,'index.html'),'utf8'));
    assert.deepEqual(current,{...previous,imports:{...previous.imports,'/assets/TreeScene-MobileSmooth-20261117-v2.js':'/'+scene}});
  });
  await t.test('actual module graph links to V78, shared Three, and the current gallery',()=>{
    const result=spawnSync(process.execPath,['--experimental-vm-modules','--input-type=module','-e',moduleGraphCheck,dir,baseline],{cwd:repo,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024});
    success(result);
    const graph=JSON.parse(result.stdout);
    for(const name of modules)assert.ok(graph.modules.includes('/assets/princess-kitten-v78/'+name),name);
    for(const name of [scene,'assets/three.module-Bhl-iquR.js','assets/PhotoGallery-FlipFaces-20261117-v10.js'])assert.ok(graph.modules.includes('/'+name),name);
    assert.ok(!graph.modules.includes('/'+oldScene),'Old scene must not remain active.');
  });
  await t.test('release metadata proves the original rig and textures remain identical',async()=>{
    const release=JSON.parse(await readFile(path.join(dir,'v78-release-status.json'),'utf8'));
    assert.equal(release.version,'v78-mobile-gestures');
    assert.equal(release.model.unchanged,true);
    assert.equal(release.model.sha256,before[model]);
    assert.equal(release.scene.sha256,hash(await readFile(path.join(dir,scene))));
    for(const name of pages)assert.equal(release.previousEntrySha256[name],before[name]);
  });
  await t.test('rerun is idempotent, including rollback metadata',async()=>{
    const once=await digest(dir);success(build(dir));assert.deepEqual(await digest(dir),once);
  });
  for(const [name,change] of [
    ['different scene',async target=>{
      const file=path.join(target,'index.html');
      const html=await readFile(file,'utf8');
      await writeFile(file,html.replace(/<script type="importmap">([\s\S]*?)<\/script>/,(_,json)=>{
        const map=JSON.parse(json);map.imports['/assets/TreeScene-MobileSmooth-20261117-v2.js']='/assets/TreeScene-Unreviewed.js';
        return '<script type="importmap">'+JSON.stringify(map)+'</script>';
      }));
    }],
    ['changed V77 bundle',async target=>{const file=path.join(target,oldScene);await writeFile(file,(await readFile(file,'utf8'))+'\n// changed');}],
    ['changed active App',async target=>{const file=path.join(target,'assets/App-MobileSmooth-20261117-v2.js');await writeFile(file,(await readFile(file,'utf8'))+'\n// changed');}],
  ])await t.test('rejects '+name+' before writing',async()=>{
    const changed=await fixture(t);await change(changed);const original=await digest(changed);
    assert.notEqual(build(changed).status,0);assert.deepEqual(await digest(changed),original);
  });
});

// Reuse the exact production module-graph parser without executing the app.
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
