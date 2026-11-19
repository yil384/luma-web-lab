#!/usr/bin/env python3
"""Deterministic upper-body/eyelid rig for Gemini's V76 GLB.
Preserves every original image, static vertex and face; adds skin attributes only
on CradleArmsV75 and adds fitted 3D eyelid surfaces over the existing eye meshes.
Requires Python 3, numpy and scipy (offline build, no network/model service).
"""
from pathlib import Path
import argparse, copy, hashlib, json, math, struct
import numpy as np
from scipy.interpolate import LinearNDInterpolator
from scipy.spatial import cKDTree
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'public/princess/luma-princess-hug-v76.glb'
OUT=ROOT/'public/princess/luma-princess-rigged-v77.glb'
DTYPES={5121:np.uint8,5123:np.uint16,5125:np.uint32,5126:np.float32}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def read_glb(path):
 b=Path(path).read_bytes(); assert b[:4]==b'glTF' and struct.unpack_from('<I',b,4)[0]==2
 n=struct.unpack_from('<I',b,12)[0]
 return json.loads(b[20:20+n]),bytearray(b[28+n:]),b

def arr(g,buf,i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']]
 assert 'byteStride' not in v
 return np.frombuffer(buf,dtype=DTYPES[a['componentType']],offset=v.get('byteOffset',0)+a.get('byteOffset',0),count=a['count']*WIDTH[a['type']]).reshape(a['count'],WIDTH[a['type']]).copy()

def pack(g,buf,path):
 g['buffers'][0]['byteLength']=len(buf)
 js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);buf+=b'\0'*((-len(buf))%4)
 total=12+8+len(js)+8+len(buf)
 Path(path).write_bytes(struct.pack('<4sII',b'glTF',2,total)+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(buf),b'BIN\0')+buf)

def quat(x=0,y=0,z=0):
 # XYZ Euler, same convention used by three.js Euler.
 c1,c2,c3=math.cos(x/2),math.cos(y/2),math.cos(z/2);s1,s2,s3=math.sin(x/2),math.sin(y/2),math.sin(z/2)
 return [s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3]

def build(out=OUT):
 g,buf,source=read_glb(SRC); original=copy.deepcopy(g)
 def add(data,typ,component=5126,target=None,bounds=False):
  a=np.asarray(data,dtype=DTYPES[component]).reshape(-1,WIDTH[typ]);pad=(-len(buf))%4;buf.extend(b'\0'*pad);offset=len(buf);buf.extend(a.tobytes())
  view={'buffer':0,'byteOffset':offset,'byteLength':a.nbytes}
  if target:view['target']=target
  vi=len(g['bufferViews']);g['bufferViews'].append(view)
  acc={'bufferView':vi,'componentType':component,'count':len(a),'type':typ}
  if bounds:acc.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  ai=len(g['accessors']);g['accessors'].append(acc);return ai
 joints=[];positions=[];byname={};parents={}
 def bone(name,pos,parent=None,initial_offset=None):
  node={'name':name,'translation':(np.array(pos)-(np.array(positions[byname[parent]]) if parent else 0)).tolist(),'extras':{'lumaRig':'v77','bindPosition':list(pos)}}
  idx=len(g['nodes']);g['nodes'].append(node);slot=len(joints);joints.append(idx);positions.append(pos);byname[name]=slot;parents[name]=parent
  if parent:g['nodes'][joints[byname[parent]]].setdefault('children',[]).append(idx)
  if initial_offset:node['translation']=(np.array(node['translation'])+initial_offset).tolist();node['extras']['openOffset']=initial_offset
  return slot
 bone('root',(0,0,0));bone('chest',(0,.17,0),'root')
 for side,sgn in [('L',1),('R',-1)]:
  bone('upperArm_'+side,(sgn*.121,.162,-.002),'chest')
  bone('forearm_'+side,(sgn*.128,.081,.068),'upperArm_'+side)
  bone('hand_'+side,(sgn*.043,.084,.145),'forearm_'+side)
 for side,sgn in [('L',1),('R',-1)]:
  bone('eyelid_upper_'+side,(sgn*.02396,.385,.046),'root',[0,.015,-.008])
  bone('eyelid_lower_'+side,(sgn*.02396,.365,.046),'root',[0,-.015,-.008])
 ibm=np.tile(np.eye(4,dtype=np.float32),(len(joints),1,1))
 for i,pos in enumerate(positions):ibm[i,:3,3]=-np.array(pos)
 ibmi=add(ibm.transpose(0,2,1).reshape(-1,16),'MAT4')
 g['skins']=[{'name':'LumaV77UpperBodyAndEyelids','inverseBindMatrices':ibmi,'skeleton':joints[0],'joints':joints}]
 g['scenes'][g.get('scene',0)]['nodes'].append(joints[0])
 # Rest-preserving skin weights along the shoulder-elbow-wrist polyline.
 arm=g['meshes'][3]['primitives'][0];p=arr(g,buf,arm['attributes']['POSITION']);aw=np.zeros((len(p),4),np.float32);aj=np.zeros((len(p),4),np.uint16)
 for side,sgn in [('L',1),('R',-1)]:
  pick=np.where(p[:,0]*sgn>=0)[0];q=p[pick];pts=np.array([positions[byname['upperArm_'+side]],positions[byname['forearm_'+side]],positions[byname['hand_'+side]],(sgn*.018,.087,.159)])
  lengths=np.linalg.norm(np.diff(pts,axis=0),axis=1);ss=np.r_[0,np.cumsum(lengths)];dist=[];projections=[]
  for a,b,L,start in zip(pts[:-1],pts[1:],lengths,ss[:-1]):
   t=np.clip((q-a)@(b-a)/(L*L),0,1);dist.append(np.linalg.norm(q-(a+t[:,None]*(b-a)),axis=1));projections.append(start+t*L)
  which=np.argmin(np.array(dist),axis=0);s=np.array(projections)[which,np.arange(len(q))]
  # A smooth 2 cm blend on each side of the elbow and wrist.
  w_fore=np.clip((s-(ss[1]-.018))/.036,0,1);w_fore=w_fore*w_fore*(3-2*w_fore)
  w_hand=np.clip((s-(ss[2]-.013))/.026,0,1);w_hand=w_hand*w_hand*(3-2*w_hand)
  aw[pick,:3]=np.c_[1-w_fore,w_fore*(1-w_hand),w_fore*w_hand]
  aj[pick,:3]=[byname['upperArm_'+side],byname['forearm_'+side],byname['hand_'+side]]
 arm['attributes']['JOINTS_0']=add(aj,'VEC4',5123,34962);arm['attributes']['WEIGHTS_0']=add(aw,'VEC4',5126,34962)
 g['nodes'][4]['skin']=0;g['nodes'][4]['extras']={'lumaRig':'v77','role':'independent-skinned-arms'}
 # Fitted low-poly eyelid sheets. Both lids are true weighted surfaces. They
 # retract behind the existing eye rim in the open pose, then cover the intact
 # eyeball. No iris squash, flat black mask, visibility swap or face texture edit.
 lash_mat=len(g['materials']);g['materials'].append({'name':'V77 natural eyelash edge','pbrMetallicRoughness':{'baseColorFactor':[.085,.037,.024,1],'metallicFactor':0,'roughnessFactor':.8},'doubleSided':True})
 lid_stats=[]
 def surface_mesh(name,v,idx,uv,weights,jindices,material,normal_override=None):
  v=np.asarray(v,np.float32);tri=np.asarray(idx,np.uint16).reshape(-1,3)
  normals=np.zeros_like(v);fn=np.cross(v[tri[:,1]]-v[tri[:,0]],v[tri[:,2]]-v[tri[:,0]])
  for j in range(3):np.add.at(normals,tri[:,j],fn)
  if normal_override is not None:normals=np.asarray(normal_override,np.float32)
  norms=np.linalg.norm(normals,axis=1);normals/=np.maximum(norms[:,None],1e-12)
  mesh={'name':name,'primitives':[{'attributes':{'POSITION':add(v,'VEC3',5126,34962,True),'NORMAL':add(normals,'VEC3',5126,34962),'TEXCOORD_0':add(uv,'VEC2',5126,34962),'JOINTS_0':add(jindices,'VEC4',5123,34962),'WEIGHTS_0':add(weights,'VEC4',5126,34962)},'indices':add(tri,'SCALAR',5123,34963),'material':material}]}
  mi=len(g['meshes']);g['meshes'].append(mesh);ni=len(g['nodes']);g['nodes'].append({'name':name,'mesh':mi,'skin':0,'extras':{'lumaRig':'v77','role':'eyelid-surface'}});g['nodes'][0]['children'].append(ni)
  return v,tri
 for side,eyeindex in [('L',2),('R',1)]:
  ep=arr(g,buf,g['meshes'][eyeindex]['primitives'][0]['attributes']['POSITION']);sgn=1 if side=='L' else -1
  # Deduplicate XY at the maximum front Z, retaining the outermost eye shell.
  rounded=np.round(ep[:,:2],7);u,inv=np.unique(rounded,axis=0,return_inverse=True);zmax=np.full(len(u),-1e9);np.maximum.at(zmax,inv,ep[:,2]);interp=LinearNDInterpolator(u,zmax);tree=cKDTree(u)
  def front(x,y):
   val=float(interp(x,y))
   return float(zmax[tree.query([x,y])[1]]) if not np.isfinite(val) else val
  cx=float((ep[:,0].min()+ep[:,0].max())*.5);cy=.37515;rx=.01125;ry=.0103
  for upper in [True,False]:
   name='eyelid_'+('upper' if upper else 'lower')+'_'+side;joint=byname[name];v=[];uv=[];weights=[];ji=[];idx=[];vn=[]
   cols=40;rows=12
   for c in range(cols+1):
    xx=-1+2*c/cols;arc=math.sqrt(max(0,1-xx*xx));x=cx+rx*xx
    outer=cy+(ry*arc if upper else -ry*arc);seam=cy-.0027*arc
    for r in range(rows+1):
     t=r/rows;y=outer+(seam-outer)*t
     # Bury the outermost rows under the original skin rim. A constant front
     # offset left a visible circular cutout even in the fully open pose.
     rim=max(0,1-min(t/.28,arc/.25));z=front(x,y)+.00048-.0015*rim*rim
     # Eyelid skin samples the existing skin-only edge of this eye's atlas.
     v.append([x,y,z]);uv.append([.025+.020*t,.23+.12*c/cols]);w=abs(outer-y)/.015
     # Match the original eye-shell curvature across the buried perimeter;
     # recomputing normals from that hidden skirt creates a dark circular seam.
     step=.00012;vn.append([-(front(x+step,y)-front(x-step,y))/(2*step),-(front(x,y+step)-front(x,y-step))/(2*step),1])
     weights.append([1-w,w,0,0]);ji.append([0,joint,0,0])
   for c in range(cols):
    for r in range(rows):
     a=c*(rows+1)+r;b=a+rows+1
     idx.extend([[a,a+1,b],[a+1,b+1,b]] if upper else [[a,b,a+1],[a+1,b,b+1]])
   material=g['meshes'][eyeindex]['primitives'][0]['material']
   vv,tt=surface_mesh('V77 '+name,v,idx,uv,weights,ji,material,vn);lid_stats.append({'name':name,'vertices':len(v),'triangles':len(tt)})
   if upper:
    lv=[];lu=[];lw=[];lj=[];li=[]
    for c in range(cols+1):
     xx=-1+2*c/cols;arc=math.sqrt(max(0,1-xx*xx));x=cx+rx*xx;top=cy+ry*arc;seam=cy-.0027*arc;half=.00018*arc
     for dy in [-half,half]:
      y=seam+dy;corner=max(0,1-arc/.45);lv.append([x,y,front(x,y)+.00062-.0015*corner*corner]);lu.append([.03,.3]);w=(top-y)/.015;lw.append([1-w,w,0,0]);lj.append([0,joint,0,0])
     if c<cols:
      a=2*c;li.extend([[a,a+2,a+1],[a+1,a+2,a+3]])
    surface_mesh('V77 lash_'+side,lv,li,lu,lw,lj,lash_mat)
 # Authored clips use the same small local bone motions as the runtime adapter.
 # Runtime evaluates these curves analytically to avoid per-frame allocation.
 animations=[]
 def add_clip(name,duration,tracks):
  times=np.linspace(0,duration,round(duration*24)+1,dtype=np.float32);ti=add(times,'SCALAR',bounds=True);samplers=[];channels=[]
  for bonename,path,fn in tracks:
   vals=[fn(float(t)) for t in times];vi=add(vals,'VEC4' if path=='rotation' else 'VEC3');samplers.append({'input':ti,'output':vi,'interpolation':'LINEAR'});channels.append({'sampler':len(samplers)-1,'target':{'node':joints[byname[bonename]],'path':path}})
  animations.append({'name':name,'samplers':samplers,'channels':channels})
 def env(t,d):return math.sin(math.pi*min(1,max(0,t/d)))**2
 add_clip('hold_idle',4.0,[('forearm_L','rotation',lambda t:quat()),('forearm_R','rotation',lambda t:quat())])
 add_clip('pet_cat',2.4,[('forearm_L','rotation',lambda t:quat(x=-.08*env(t,2.4),z=-.32*env(t,2.4))),('hand_L','rotation',lambda t:quat(x=(.10+.06*math.sin(t/2.4*math.pi*4))*env(t,2.4),y=-.08*env(t,2.4)))])
 add_clip('adjust_hold',2.2,[('forearm_L','rotation',lambda t:quat(z=-.05*env(t,2.2))),('forearm_R','rotation',lambda t:quat(z=.05*env(t,2.2)))])
 blink_tracks=[]
 for side in ['L','R']:
  for upper in [True,False]:
   bn='eyelid_'+('upper' if upper else 'lower')+'_'+side;bind=np.array(positions[byname[bn]]);sg=1 if upper else -1
   def motion(t,bind=bind,sg=sg):
    phase=t/.26
    def smooth(v):
     v=max(0,min(1,v));return v*v*(3-2*v)
    b=smooth(phase/.35) if phase<.35 else (1 if phase<.48 else 1-smooth((phase-.48)/.52))
    return (bind+np.array([0,sg*.015*(1-b),-.008*(1-b)**6])).tolist()
   blink_tracks.append((bn,'translation',motion))
 add_clip('blink',.26,blink_tracks);g['animations']=animations
 g['asset']['generator']='Luma V77 deterministic arm + fitted eyelid rig (original Gemini V76 geometry preserved)'
 g.setdefault('extras',{})['lumaRig']={'version':77,'sourceSha256':hashlib.sha256(source).hexdigest(),'boneNames':list(byname),'staticMainMeshUnchanged':True,'armVertices':len(p),'eyelidSurfaceVertices':sum(x['vertices'] for x in lid_stats),'clips':[a['name'] for a in animations],'supports':['pet_cat','adjust_hold','blink'],'openEyeOffsets':{'upper':[0,.015,-.008],'lower':[0,-.015,-.008]},'notes':'Main face, skirt, hair and eye insert bytes preserved. Only arms and fitted eyelid surfaces are skinned.'}
 pack(g,buf,out)
 report={'file':str(out.relative_to(ROOT)),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size,'sourceSha256':hashlib.sha256(source).hexdigest(),'bones':list(byname),'skins':len(g['skins']),'animations':[a['name'] for a in animations],'armVertices':len(p),'eyelids':lid_stats,'staticMainMeshAttributesUnchanged':original['meshes'][0]==g['meshes'][0],'originalEyeAttributesUnchanged':original['meshes'][1:3]==g['meshes'][1:3]}
 (ROOT/'docs/princess-kitten-p0-p1/evidence/reports/princess_v77_rig.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2));return g,buf

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,default=OUT);args=ap.parse_args();build(args.output)
