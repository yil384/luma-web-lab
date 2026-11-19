import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Texture, Vector3, Matrix4, Group } from 'three';
import { bindPrincessRig } from '../../src/scene/princess-kitten/princess-rig.mjs';
const rootDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=fs.readFileSync(path.join(rootDir,'public/princess/luma-princess-rigged-v77.glb'));
const jsonLength=source.readUInt32LE(12);const original=JSON.parse(source.subarray(20,20+jsonLength).toString());const binary=source.subarray(28+jsonLength);
const loader=new GLTFLoader();loader.register(()=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new Texture())}));
const gltf=await loader.parseAsync(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength),'');
const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
const rig=bindPrincessRig(gltf.scene);assert(rig.capabilities.canUseArmPose);assert(rig.capabilities.canBlink);assert.equal(meshes.length,7);assert.equal(gltf.animations.length,4);
const anchor=new Group();anchor.position.set(0,2.95,.77);rig.setHoldAnchor(anchor);
function positions(mesh){const a=mesh.geometry.getAttribute('position');const out=new Float32Array(a.count*3);const p=new Vector3();for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i);mesh.applyBoneTransform(i,p);p.toArray(out,i*3);}return out;}
const arm=meshes.find(m=>m.name==='CradleArmsV75');const staticMesh=gltf.scene.getObjectByName('geometry_0');const origStatic=new Float32Array(staticMesh.geometry.getAttribute('position').array);
rig.update(0,null,true);const rest=positions(arm);const posAttr=arm.geometry.getAttribute('position');let maxError=0;for(let i=0;i<rest.length;i++)maxError=Math.max(maxError,Math.abs(rest[i]-posAttr.array[i]));assert(maxError<2e-7,'rest skin must match original geometry');
rig.update(0,{id:'princess.pet_cat',elapsed:1.2,duration:2.4,intensity:1},false);const pet=positions(arm);let left=0,right=0;for(let i=0;i<rest.length/3;i++){const d=Math.hypot(...[0,1,2].map(j=>pet[i*3+j]-rest[i*3+j]));if(posAttr.array[i*3]>0)left=Math.max(left,d);else right=Math.max(right,d);}assert(left>.015);assert(right<2e-7,'supporting right hand must remain still');
assert.deepEqual(staticMesh.geometry.getAttribute('position').array,origStatic);
rig.update(0,{id:'princess.adjust_hold',elapsed:1.1,duration:2.2,intensity:1},false);assert(Math.abs(anchor.position.y-2.9795)<1e-9);const adjust=positions(arm);const support=[];for(let i=0;i<rest.length/3;i++)if(Math.abs(rest[i*3])<.036&&rest[i*3+2]>.14)support.push((adjust[i*3+1]-rest[i*3+1])*5.120758);const supportMean=support.reduce((a,b)=>a+b,0)/support.length;assert(Math.abs(supportMean-.0295)<.0001);
rig.update(0,null,true);assert(Math.abs(anchor.position.y-2.95)<1e-9);assert.deepEqual(positions(arm),rest);
const qa=path.resolve(process.argv[2]||path.join(rootDir,'../../rig-qa'));fs.mkdirSync(qa,{recursive:true});
function writePose(name,action,clock=0){
 rig.update(clock,action,false);const g=structuredClone(original);const chunks=[binary];let len=binary.length;
 function addArray(array){const pad=(-len)&3;if(pad){chunks.push(Buffer.alloc(pad));len+=pad;}const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength);const index=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:len,byteLength:bytes.length,target:34962});chunks.push(bytes);len+=bytes.length;const ai=g.accessors.length;g.accessors.push({bufferView:index,componentType:5126,count:array.length/3,type:'VEC3',min:[0,1,2].map(j=>{let m=Infinity;for(let i=j;i<array.length;i+=3)m=Math.min(m,array[i]);return m;}),max:[0,1,2].map(j=>{let m=-Infinity;for(let i=j;i<array.length;i+=3)m=Math.max(m,array[i]);return m;})});return ai;}
 for(const mesh of meshes){const association=gltf.parser.associations.get(mesh);const mi=association.meshes;const primitive=g.meshes[mi].primitives[association.primitives??0];primitive.attributes.POSITION=addArray(positions(mesh));const norms=mesh.geometry.getAttribute('normal');const indexes=mesh.geometry.getAttribute('skinIndex');const weights=mesh.geometry.getAttribute('skinWeight');const out=new Float32Array(norms.count*3);const v=new Vector3(),acc=new Vector3(),m=new Matrix4();for(let i=0;i<norms.count;i++){acc.set(0,0,0);for(let k=0;k<4;k++){const w=weights.array[i*4+k];if(!w)continue;m.fromArray(mesh.skeleton.boneMatrices,indexes.array[i*4+k]*16);v.fromBufferAttribute(norms,i).transformDirection(m);acc.addScaledVector(v,w);}acc.normalize().toArray(out,i*3);}primitive.attributes.NORMAL=addArray(out);delete primitive.attributes.JOINTS_0;delete primitive.attributes.WEIGHTS_0;}
 for(const node of g.nodes)delete node.skin;delete g.skins;delete g.animations;g.buffers[0].byteLength=len;let js=Buffer.from(JSON.stringify(g));js=Buffer.concat([js,Buffer.alloc((-js.length)&3,32)]);let bin=Buffer.concat(chunks);bin=Buffer.concat([bin,Buffer.alloc((-bin.length)&3)]);const h=Buffer.alloc(20);h.write('glTF');h.writeUInt32LE(2,4);h.writeUInt32LE(28+js.length+bin.length,8);h.writeUInt32LE(js.length,12);h.write('JSON',16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.write('BIN\0',4);fs.writeFileSync(path.join(qa,name+'.glb'),Buffer.concat([h,js,bh,bin]));
}
writePose('open',null);writePose('half',{id:'princess.blink',elapsed:.0455,duration:.26});writePose('closed',{id:'princess.blink',elapsed:.108,duration:.26});writePose('pet',{id:'princess.pet_cat',elapsed:1.2,duration:2.4});
const report={canUseArmPose:rig.capabilities.canUseArmPose,canBlink:rig.capabilities.canBlink,bones:rig.capabilities.bones,skinnedMeshes:meshes.map(m=>m.name),clips:gltf.animations.map(a=>a.name),armRestMaxError:maxError,petLeftMaxDisplacement:left,petRightMaxDisplacement:right,adjustPalmMeanRisePivot:supportMean,anchorRisePivot:.0295,staticMainMeshUnchanged:true};fs.writeFileSync(path.join(qa,'rig-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
rig.dispose();
