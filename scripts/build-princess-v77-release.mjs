#!/usr/bin/env node
/** Apply this focused character release to a verified current GitHub Pages tree.
 * Usage: node scripts/build-princess-v77-release.mjs /absolute/pages/tree
 * Input is a complete copy/worktree of gh-pages; output updates only documented release paths.
 * It intentionally does not run the outdated full-site Vite build.
 */
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repo = fileURLToPath(new URL('..', import.meta.url));
const target = process.argv[2];
if (!target || !path.isAbsolute(target)) throw new Error('Provide an absolute existing gh-pages directory.');
const baseAsset = 'assets/TreeScene-MobileSmooth-20261117-v2.js';
const releaseAsset = 'assets/TreeScene-PrincessRig-V77.js';
const baseHash = '6ef16549971ed52999aacd08a753ba36c6da3f99443a4ebeed6205308717c12a';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const entryPaths = ['index.html','christmas/index.html'];
const entries = new Map();
const requiredImports = {
  '/assets/index-CJX_PAH8.js':'/assets/index-AlbumSwipe-20261117-v5.js',
  '/assets/App-AlbumSwipe-20261117-v5.js':'/assets/App-MobileSmooth-20261117-v2.js',
  '/assets/PhotoGallery-AlbumSwipe-20261117-v5.js':'/assets/PhotoGallery-FlipFaces-20261117-v10.js'
};
for (const page of entryPaths) {
  const html = await readFile(path.join(target,page),'utf8');
  const maps = [...html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)];
  if (maps.length !== 1) throw new Error('Expected one existing importmap: '+page);
  const {imports = {}} = JSON.parse(maps[0][1]);
  for (const [key,value] of Object.entries(requiredImports)) {
    if (imports[key] !== value) throw new Error('The active production entry changed: '+page+' '+key);
  }
  if (imports['/'+baseAsset] && imports['/'+baseAsset] !== '/'+releaseAsset) {
    throw new Error('A newer scene mapping is already active: '+page);
  }
  entries.set(page,html);
}
const app = await readFile(path.join(target,'assets/App-MobileSmooth-20261117-v2.js'),'utf8');
if (sha256(app) !== 'f391a954f192283e227e76831f09b249ba8d11504e47073ec9b636feb6f9f432' || !app.includes('TreeScene-MobileSmooth-20261117-v2.js')) {
  throw new Error('The current App no longer matches the reviewed scene integration.');
}
const original = await readFile(path.join(target, baseAsset), 'utf8');
if (sha256(original) !== baseHash) throw new Error('The production scene changed. Review the new baseline before adapting it.');
let scene = original;
function replaceOnce(from, to) {
  if (scene.split(from).length !== 2) throw new Error('Expected exactly one integration point: ' + from.slice(0, 100));
  scene = scene.replace(from, to);
}
const first = scene.indexOf('/* GEMINI V73: one reveal only');
const last = scene.indexOf('\nfunction cm(', first);
if (first < 0 || last < first) throw new Error('Could not identify the original character component.');
const component = await readFile(path.join(repo, 'src/scene/princess-kitten/production-component.inc.js'), 'utf8');
scene = scene.slice(0, first) + component + '\n' + scene.slice(last);

// The shared scheduler advances once, before any actor's skeletal evaluation.
replaceOnce('const _=$e(T=>T.size.width<700||mobile),x=c&&y;return', `
  const characterRuntime=U.useMemo(()=>createCharacterRuntimeV77({lowPower:mobile,reducedMotion:l}),[]);
  const diagnosticClock=U.useRef(0);
  const characterQa=U.useMemo(()=>new URLSearchParams(location.search).has('rigqa'),[]);
  U.useLayoutEffect(()=>{
    characterRuntime.dispatch({type:'pause',paused:s});
    characterRuntime.dispatch({type:'visibility',visible:c&&!document.hidden});
    characterRuntime.dispatch({type:'reduced-motion',enabled:l});
    document.documentElement.dataset.characterPaused=String(s||!c||document.hidden);
    document.documentElement.dataset.characterVisible=String(c&&!document.hidden);
    document.documentElement.dataset.characterReducedMotion=String(l);
  },[characterRuntime,s,c,l]);
  U.useEffect(()=>{
    const visibility=()=>{
      characterRuntime.dispatch({type:'visibility',visible:c&&!document.hidden});
      document.documentElement.dataset.characterVisible=String(c&&!document.hidden);
    };
    document.addEventListener('visibilitychange',visibility);
    return()=>document.removeEventListener('visibilitychange',visibility);
  },[characterRuntime,c]);
  zt((_,dt)=>{
    characterRuntime.step(dt);
    if(characterQa||(diagnosticClock.current++%20)===0){
      const state=characterRuntime.getSnapshot();
      document.documentElement.dataset.characterRuntime='v77';
      document.documentElement.dataset.characterClock=String(state.clock);
      document.documentElement.dataset.characterPaused=String(s||!c||document.hidden);
      document.documentElement.dataset.characterActions=JSON.stringify(state.actions);
    }
  },-2);
  const _=$e(T=>T.size.width<700||mobile),x=c&&y;return`);
replaceOnce('fe.jsx(GeminiPrincessV73,{active:c,paused:s,reducedMotion:l,onInteract:p})', 'fe.jsx(GeminiPrincessV77,{active:c,paused:s,reducedMotion:l,onInteract:p,characterRuntime})');
replaceOnce('companionContacts:C,handInput:h,onPress:v,onInteract:p}', 'companionContacts:C,handInput:h,onPress:v,onInteract:p,characterRuntime}');
replaceOnce('active:c,projection:f.projection}', 'active:c,projection:f.projection,characterRuntime}');

// Keep native locomotion/IK intact; compose a compatible action before sync and head/ear/tail after.
replaceOnce('companionContacts:l,handInput:c,onPress:d,onInteract:f})', 'companionContacts:l,handInput:c,onPress:d,onInteract:f,characterRuntime})');
replaceOnce('const N=Jp();T=$p()', 'const N=Jp();characterRuntime.setGroundTrio(x,N);document.documentElement.dataset.groundCatCount=String(x.cats.length);T=$p()');
replaceOnce('C=()=>{var A;w.remove(...x.cats', 'C=()=>{var A;characterRuntime.setGroundTrio(null,null);w.remove(...x.cats');
replaceOnce('},[m,c,l]),zt(({camera:w},R)=>', '},[m,c,l,characterRuntime]),zt(({camera:w},R)=>');
replaceOnce('if(i){C.stars.visible=!1;return}', 'if(i){C.stars.visible=!1;C.sync(C.trio,C.behavior.snapshot(),0,{reducedMotion:true});characterRuntime.applyGround();return}');
replaceOnce('G=N.update(B);L(T,G,B,{viewer:w.position}),p.current=', 'G=characterRuntime.composeGroundSnapshot(N.update(B));L(T,G,B,{viewer:w.position}),characterRuntime.applyGround(),p.current=');
replaceOnce('gc.includes(R)&&(y.current=R,p.current=0,', "gc.includes(R)&&(characterRuntime.tap('ground-'+R),document.documentElement.dataset.characterLastTap='ground-'+R,y.current=R,p.current=0,");

// Camera controls already own pointer capture and cleanup. Report real drag start/end here.
replaceOnce('active:d,projection:f}){', 'active:d,projection:f,characterRuntime}){');
replaceOnce('const onStart=()=>{\n      gesture.current=', "const onStart=()=>{\n      characterRuntime.dispatch({type:'camera-drag-start'});\n      gesture.current=");
replaceOnce('const onEnd=()=>{\n      gesture.current=', "const onEnd=()=>{\n      characterRuntime.dispatch({type:'camera-drag-end'});\n      gesture.current=");
replaceOnce('const onResume=()=>{\n      userInteracted.current=', "const onResume=()=>{\n      characterRuntime.dispatch({type:'camera-drag-end'});\n      userInteracted.current=");
replaceOnce('return ()=>{\n      controls.removeEventListener("start",onStart);', "return ()=>{\n      characterRuntime.dispatch({type:'camera-drag-end'});\n      controls.removeEventListener(\"start\",onStart);");
replaceOnce('},[m,controls,g,i,p]);', '},[m,controls,g,i,p,characterRuntime]);');

scene = `import {createCharacterInteractionRuntime as createCharacterRuntimeV77} from './princess-kitten-v77/runtime.mjs';\nimport {bindPrincessRig as bindPrincessRigV77} from './princess-kitten-v77/princess-rig.mjs';\n` + scene;
const moduleNames = ['interaction-scheduler.mjs','held-kitten-rig.mjs','ground-cat-adapter.mjs','runtime.mjs','princess-rig.mjs'];
const source = path.join(repo, 'src/scene/princess-kitten');
const destination = path.join(target, 'assets/princess-kitten-v77');
await mkdir(destination, {recursive:true});
await mkdir(path.join(target,'princess'), {recursive:true});
for (const name of moduleNames) await copyFile(path.join(source,name),path.join(destination,name));
await writeFile(path.join(target, releaseAsset), scene);
const modelPath = 'princess/luma-princess-rigged-v77.glb';
const model = await readFile(path.join(repo, 'public', modelPath));
await writeFile(path.join(target,modelPath), model);
await writeFile(path.join(target,modelPath+'.gz'), gzipSync(model,{level:9,mtime:0}));

const before = {};
let previousRelease = null;
try { previousRelease = JSON.parse(await readFile(path.join(target,'v77-release-status.json'),'utf8')); } catch {}
for (const page of entryPaths) {
  let html = entries.get(page);
  before[page] = sha256(html);
  if (html.includes('/'+releaseAsset) && previousRelease?.version === 'v77-skeletal') {
    before[page] = previousRelease.previousEntrySha256?.[page] || before[page];
  }
  html = html.replace(/<script type="importmap">(.*?)<\/script>/s, (_,json)=>{
    const map = JSON.parse(json);
    map.imports['/'+baseAsset] = '/'+releaseAsset;
    return '<script type="importmap">'+JSON.stringify(map)+'</script>';
  });
  // Model loader owns a single promise and abort signal. Avoid the old automatic V73 download.
  html = html.replace(/\s*<script data-princess-prefetch="v73-fast">[\s\S]*?<\/script>/, '');
  if (!html.includes('/'+releaseAsset) || html.includes('__v73GetModelBytes')) throw new Error('Entry integration failed: '+page);
  await writeFile(path.join(target,page),html);
}
const release = {
  version:'v77-skeletal',
  baselineScene:{path:baseAsset,sha256:baseHash},
  scene:{path:releaseAsset,sha256:sha256(scene)},
  model:{path:modelPath,bytes:model.length,sha256:sha256(model)},
  previousEntrySha256:before,
  changes:['Independent shoulder/elbow/wrist skinning','Independent upper/lower eyelid joints','Shared runtime for princess, held kitten and three ground cats'],
  verificationLimit:'Desktop/mobile viewport checks are not a physical iPhone/Safari performance test.'
};
await writeFile(path.join(target,'v77-release-status.json'),JSON.stringify(release,null,2)+'\n');
console.log(JSON.stringify(release,null,2));
