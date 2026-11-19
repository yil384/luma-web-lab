#!/usr/bin/env node
/** Patch the reviewed live V77 tree without rebuilding the older source app.
 * Existing assets are immutable; only the two import maps select the new scene.
 */
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repo = fileURLToPath(new URL('..', import.meta.url));
const target = process.argv[2];
if (!target || !path.isAbsolute(target)) throw new Error('Provide an absolute current gh-pages directory.');
const baselineScene = 'assets/TreeScene-PrincessRig-V77.js';
const baselineHash = '24ed90b603768a274d0425ed04c4cca0bee422651ed1c6206a48c50f2e753c99';
const releaseScene = 'assets/TreeScene-MobileGestures-V78.js';
const sceneImport = '/assets/TreeScene-MobileSmooth-20261117-v2.js';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const entryPaths = ['index.html','christmas/index.html'];
const entries = new Map();
const requiredImports = {
  '/assets/index-CJX_PAH8.js':'/assets/index-AlbumSwipe-20261117-v5.js',
  '/assets/App-AlbumSwipe-20261117-v5.js':'/assets/App-MobileSmooth-20261117-v2.js',
  '/assets/PhotoGallery-AlbumSwipe-20261117-v5.js':'/assets/PhotoGallery-FlipFaces-20261117-v10.js',
};
for (const name of entryPaths) {
  const html = await readFile(path.join(target,name),'utf8');
  const maps = [...html.matchAll(/<script type="importmap">([\s\S]*?)<\/script>/g)];
  if (maps.length !== 1) throw new Error('Expected one production importmap: '+name);
  const {imports = {}} = JSON.parse(maps[0][1]);
  for (const [key,value] of Object.entries(requiredImports)) {
    if (imports[key] !== value) throw new Error('The live app/album entry changed: '+name+' '+key);
  }
  if (![ '/'+baselineScene, '/'+releaseScene ].includes(imports[sceneImport])) {
    throw new Error('The active production scene changed: '+name);
  }
  entries.set(name,html);
}
const app = await readFile(path.join(target,'assets/App-MobileSmooth-20261117-v2.js'));
if (sha256(app) !== 'f391a954f192283e227e76831f09b249ba8d11504e47073ec9b636feb6f9f432') throw new Error('The active App changed.');
const original = await readFile(path.join(target,baselineScene),'utf8');
if (sha256(original) !== baselineHash) throw new Error('The reviewed V77 scene changed.');
const modelPath = 'princess/luma-princess-rigged-v77.glb';
const model = await readFile(path.join(target,modelPath));
if (sha256(model) !== '9b1cd945157dc1dc8645758bcf33d41ce54e4993cb7e299e5e9fe3bf780994e0') throw new Error('The V77 skeletal asset changed.');
let scene = original;
function replaceOnce(from,to) {
  if (scene.split(from).length !== 2) throw new Error('Expected one reviewed integration point: '+from.slice(0,90));
  scene = scene.replace(from,to);
}
const componentStart = scene.indexOf('/* Inserted into the pinned production TreeScene');
const componentEnd = scene.indexOf('\nfunction cm(',componentStart);
if (componentStart < 0 || componentEnd < componentStart) throw new Error('Missing V77 character boundary.');
scene = scene.slice(0,componentStart) + await readFile(path.join(repo,'src/scene/princess-kitten/production-component.inc.js'),'utf8') + scene.slice(componentEnd);
const resolutionStart = scene.indexOf('function lm()');
const resolutionEnd = scene.indexOf('function um(',resolutionStart);
if (resolutionStart < 0 || resolutionEnd < resolutionStart) throw new Error('Missing resolution governor boundary.');
scene = scene.slice(0,resolutionStart) + await readFile(path.join(repo,'src/scene/princess-kitten/production-performance.inc.js'),'utf8') + '\n' + scene.slice(resolutionEnd);
replaceOnce('fe.jsx(lm,{})','fe.jsx(lm,{paused:s,active:c})');
replaceOnce('createCharacterRuntimeV77({lowPower:mobile,reducedMotion:l})','createCharacterRuntimeV77({lowPower:mobile,reducedMotion:l,deferMatrices:true})');
// Diagnostics are useful under explicit QA; normal visitors do not serialize
// actor snapshots or continually mutate DOM attributes on the render thread.
replaceOnce('const diagnosticClock=U.useRef(0);', '');
replaceOnce('if(characterQa||(diagnosticClock.current++%20)===0){','if(characterQa){');
replaceOnce("const characterQa=U.useMemo(()=>new URLSearchParams(location.search).has('rigqa'),[]);",
  "const characterQa=U.useMemo(()=>new URLSearchParams(location.search).has('rigqa'),[]);\n  U.useEffect(()=>{document.documentElement.dataset.characterRuntime='v77';},[]);");

// Touch screens have no useful hover. R3F's pointermove filter then omits the
// whole photo instanced mesh, rather than raycasting it before a no-op handler.
replaceOnce('onPointerDown:V,onPointerOver:H=>{H.stopPropagation(),C.domElement.style.cursor="pointer"},onPointerOut:()=>{C.domElement.style.cursor=""}',
  'onPointerDown:V,onPointerOver:window.matchMedia("(hover: hover) and (pointer: fine)").matches?H=>{H.stopPropagation(),C.domElement.style.cursor="pointer"}:undefined,onPointerOut:window.matchMedia("(hover: hover) and (pointer: fine)").matches?()=>{C.domElement.style.cursor=""}:undefined');
replaceOnce('function np({state:i,photos:n,count:s,reducedMotion:l=!1,onPhotoPress:c,handInput:d,handActive:f=!1,onHandPhotoSelect:m}){',
  'function np({state:i,photos:n,count:s,reducedMotion:l=!1,onPhotoPress:c,handInput:d,handActive:f=!1,onHandPhotoSelect:m}){const photoQa=U.useMemo(()=>new URLSearchParams(location.search).has("rigqa"),[]);');
replaceOnce('const E=d==null?void 0:d.current;if(!y||!E)return;', `
  if(photoQa)window.__lumaPhotoTargetsQA=()=>{
    if(!B.current)return[];
    const targets=[],point=new J(),matrix=new bs(),occluders=[];
    const rect=C.domElement.getBoundingClientRect();
    if(i==='FORMED'&&!h.current)for(const name of ['evergreen-solid-boughs','evergreen-trunk-and-branches']){
      const object=q.parent?.getObjectByName(name);if(object)occluders.push(object);
    }
    for(let index=0;index<g&&targets.length<3;index++){
      q.getMatrixAt(index,matrix);
      point.set(0,0,0).applyMatrix4(matrix).applyMatrix4(q.matrixWorld).project(H);
      const cursor={x:(point.x+1)/2,y:(1-point.y)/2};
      if(point.z<-1||point.z>1||cursor.x<.08||cursor.x>.92||cursor.y<.12||cursor.y>.86)continue;
      const selected=S(q,H,cursor,G,occluders);
      if(selected!==null)targets.push({x:rect.left+cursor.x*rect.width,y:rect.top+cursor.y*rect.height,index:selected});
    }
    return targets;
  };
  const E=d==null?void 0:d.current;if(!y||!E)return;`);

// Keep the existing native OrbitControls path and all camera limits. Only
// remove diagnostic allocation from high-frequency production input events.
replaceOnce('const initialized=U.useRef(false),userInteracted=U.useRef(false),gesture=U.useRef(null),prevPaused=U.useRef(l),debugTick=U.useRef(0);',
  "const initialized=U.useRef(false),userInteracted=U.useRef(false),gesture=U.useRef(null),prevPaused=U.useRef(l),debugTick=U.useRef(0);\n  const cameraQa=U.useMemo(()=>new URLSearchParams(location.search).has('rigqa'),[]);");
replaceOnce('document.documentElement.dataset.cameraDistance=String(Math.round(m.position.distanceTo(controls.target)*100)/100);',
  'if(cameraQa){document.documentElement.dataset.cameraDistance=String(Math.round(m.position.distanceTo(controls.target)*100)/100);');
replaceOnce('document.documentElement.dataset.cameraTarget=[controls.target.x,controls.target.y,controls.target.z].map(x=>x.toFixed(2)).join(",");',
  'document.documentElement.dataset.cameraTarget=[controls.target.x,controls.target.y,controls.target.z].map(x=>x.toFixed(2)).join(",");}');
replaceOnce('if((debugTick.current++%18)===0){','if(cameraQa&&(debugTick.current++%18)===0){');
replaceOnce('},[m,controls,g,i,p,characterRuntime]);','},[m,controls,g,i,p,characterRuntime,cameraQa]);');
replaceOnce('controls.update(Math.min(dt,.05));', 'if(auto||(input&&hands&&input.enabled))controls.update(Math.min(dt,.05));');
replaceOnce('const arc=U.useMemo(()=>Dp(),[]),hands=U.useMemo(()=>n&&s?Wh():null,[n,s]);',
  'const arc=U.useMemo(()=>Dp(),[]),hands=U.useMemo(()=>n&&s?Wh():null,[n,s]);\n  U.useEffect(()=>{controls.enabled=d&&!l;},[controls,d,l]);');
replaceOnce('frameloop:i.active?i.reducedMotion&&!n?"demand":"always":"never"',
  'frameloop:i.active&&!i.paused?i.reducedMotion&&!n?"demand":"always":"never"');
replaceOnce('dpr:mobile?[1,1.65]:[1,3]','dpr:mobile?[1,1.5]:[1,3]');
replaceOnce('gl:{antialias:!0,alpha:!1,powerPreference:"high-performance",stencil:!1}',
  'gl:{antialias:!mobile,alpha:!1,powerPreference:"high-performance",stencil:!1}');
scene = scene.replaceAll("'./princess-kitten-v77/", "'./princess-kitten-v78/");
scene = "import {createMobilePerformance as createMobilePerformanceV78} from './princess-kitten-v78/mobile-performance.mjs';\n" + scene;
const moduleNames = ['interaction-scheduler.mjs','held-kitten-rig.mjs','ground-cat-adapter.mjs','runtime.mjs','princess-rig.mjs','mobile-performance.mjs'];
const destination = path.join(target,'assets/princess-kitten-v78');
await mkdir(destination,{recursive:true});
for (const name of moduleNames) await copyFile(path.join(repo,'src/scene/princess-kitten',name),path.join(destination,name));
await writeFile(path.join(target,releaseScene),scene);
let previous = null;
try { previous = JSON.parse(await readFile(path.join(target,'v78-release-status.json'),'utf8')); } catch {}
const previousEntrySha256 = {};
for (const [name,originalHtml] of entries) {
  previousEntrySha256[name] = originalHtml.includes('/'+releaseScene) && previous?.version === 'v78-mobile-gestures'
    ? previous.previousEntrySha256[name] : sha256(originalHtml);
  const html = originalHtml.replace(/<script type="importmap">([\s\S]*?)<\/script>/,(_,json)=>{
    const map = JSON.parse(json); map.imports[sceneImport] = '/'+releaseScene;
    return '<script type="importmap">'+JSON.stringify(map)+'</script>';
  });
  await writeFile(path.join(target,name),html);
}
const release = {
  version:'v78-mobile-gestures',
  baselineScene:{path:baselineScene,sha256:baselineHash},
  scene:{path:releaseScene,sha256:sha256(scene)},
  model:{path:modelPath,bytes:model.length,sha256:sha256(model),unchanged:true},
  previousEntrySha256,
  changes:['Invisible 12-triangle boxes replace high-poly character picking','No mobile hover raycasts; existing photo gesture recognition preserved',
    'Adaptive render pixel budget with immediate gesture quality and delayed idle recovery','No mobile MSAA; same original models and textures',
    'Renderer-owned final matrix updates; normal visitors do not serialize QA snapshots'],
  verificationLimit:'CI compares the same software Chromium runner. Physical iPhone/Safari performance has not been measured.',
};
await writeFile(path.join(target,'v78-release-status.json'),JSON.stringify(release,null,2)+'\n');
console.log(JSON.stringify(release,null,2));
