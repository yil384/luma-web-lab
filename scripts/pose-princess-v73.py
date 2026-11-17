#!/usr/bin/env python3
"""Art-directed forearm cradling pose for exactly Gemini V72, without touching face,
eyes, dress, hair, textures, UVs or the original glTF schema.
Original: 9bbf7c0ed5da...; output is a NEW preview asset. Requires numpy/Pillow/scipy.
"""
import argparse, hashlib, io, json, struct
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation

BASE_SHA = "9bbf7c0ed5da9b7372906a30b665f0e118a3a66c3122e1499ea8dc4ecd454cbf"

def main(source:Path, target:Path):
    original = source.read_bytes()
    if hashlib.sha256(original).hexdigest()!=BASE_SHA:
        raise ValueError("Only the exact, pinned Gemini V72 binary is supported")
    data=bytearray(original)
    jlen=struct.unpack_from("<I", data, 12)[0]
    doc=json.loads(bytes(data[20:20+jlen]))
    boff=20+jlen+8
    primitive=doc["meshes"][0]["primitives"][0]
    def array(name, count_components):
        acc=doc["accessors"][primitive["attributes"][name]]
        view=doc["bufferViews"][acc["bufferView"]]
        assert acc["componentType"]==5126 and acc["count"]==287940
        off=boff+view.get("byteOffset",0)+acc.get("byteOffset",0)
        count=acc["count"]
        return np.frombuffer(data,dtype="<f4",count=count*count_components,offset=off).copy().reshape(-1,count_components).astype("float64"),off
    pos,poff=array("POSITION",3)
    normals,noff=array("NORMAL",3)
    uv,_=array("TEXCOORD_0",2)
    assert len(pos)==len(normals)==len(uv)==287940
    texno=doc["materials"][primitive["material"]]["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    imgno=doc["textures"][texno]["extensions"]["EXT_texture_webp"]["source"]
    ibv=doc["bufferViews"][doc["images"][imgno]["bufferView"]]
    tex=np.asarray(Image.open(io.BytesIO(original[boff+ibv["byteOffset"]:boff+ibv["byteOffset"]+ibv["byteLength"]])).convert("RGB"))
    h,w=tex.shape[:2]
    colors=tex[np.clip(((1-uv[:,1])*h).astype(int),0,h-1), np.clip((uv[:,0]*w).astype(int),0,w-1)]
    r,g,b=colors.T.astype(float)
    skin=(r>135)&(r>g*1.14)&(g>82)&(g>b*.92)&(r>b*1.12)
    changed=np.zeros(len(pos),dtype=bool)
    for sign in (-1,1):
        px=pos[:,0]*sign;yy=pos[:,1];zz=pos[:,2]
        # Restrict changes to the skin-coloured forearm tube; never skirt/face.
        cx=.244-.70*yy
        distance=np.sqrt(((px-cx)/.054)**2+((zz-(.002+.005*(.1-yy)))/.066)**2)
        radial=np.clip((1.25-distance)/.6,0,1)
        radial=radial*radial*(3-2*radial)
        elbow=np.clip((.176-yy)/(.176-.10),0,1)
        elbow=elbow*elbow*(3-2*elbow)
        weight=skin.astype(float)*radial*elbow*(px>.10)*(yy>-.03)*(yy<.18)
        pivot=np.array([sign*.135,.137,.003])
        start=np.array([sign*.245,.019,.014])-pivot
        desired=np.array([sign*.064,.090,.150])-pivot
        rotation,_=Rotation.align_vectors([desired/np.linalg.norm(desired)],[start/np.linalg.norm(start)])
        transformed=rotation.apply(pos-pivot)+pivot
        transformed_normals=rotation.apply(normals)
        pos=pos*(1-weight[:,None])+transformed*weight[:,None]
        normals=normals*(1-weight[:,None])+transformed_normals*weight[:,None]
        normals/=np.maximum(1e-8,np.linalg.norm(normals,axis=1,keepdims=True))
        changed|=weight>.08
    change_count=int(changed.sum())
    if not 2000<change_count<5000:
        raise ValueError("Unsafe sculpt mask: changed count "+str(change_count))
    nbytes=287940*12
    data[poff:poff+nbytes]=pos.astype("<f4").tobytes()
    data[noff:noff+nbytes]=normals.astype("<f4").tobytes()
    if len(data)!=len(original) or struct.unpack_from("<I",data,8)[0]!=len(data):
        raise ValueError("Binary GLB structure changed")
    # Only existing original POSITION and NORMAL raw bytes may differ.
    regions=[(poff,poff+nbytes),(noff,noff+nbytes)]
    for start,end in [(0,regions[0][0]),(regions[0][1],regions[1][0]),(regions[1][1],len(original))]:
        if data[start:end]!=original[start:end]:
            raise ValueError("Unexpected modifications outside arm vertex and normal buffers")
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(data)
    print(json.dumps({"source":str(source),"target":str(target),"bytes":len(data),
         "sha256":hashlib.sha256(data).hexdigest(),"armVerticesEdited":change_count,
         "eyeAndFacialMeshes":"byte-identical","materialsAndImages":"byte-identical"},indent=2))

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("source",type=Path)
    parser.add_argument("target",type=Path)
    args=parser.parse_args()
    main(args.source,args.target)
