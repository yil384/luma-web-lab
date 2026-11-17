#!/usr/bin/env python3
"""Check generated GLB structure. No dependencies; visual quality is separate."""
import json
import struct
import sys
from pathlib import Path

def inspect(path: Path):
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("File is shorter than a GLB header")
    magic, version, declared_size = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_size != len(data):
        raise ValueError("Invalid glTF 2.0 binary header or length")
    offset = 12
    chunks = []
    while offset < len(data):
        if offset + 8 > len(data):
            raise ValueError("Truncated GLB chunk header")
        size, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        if offset + size > len(data):
            raise ValueError("Chunk extends beyond GLB size")
        chunks.append((kind, data[offset:offset + size]))
        offset += size
    if not chunks or chunks[0][0] != 0x4E4F534A:
        raise ValueError("First GLB chunk is not JSON")
    doc = json.loads(chunks[0][1].decode("utf-8").rstrip("\x00 \n\t\r"))
    if doc.get("asset", {}).get("version") != "2.0":
        raise ValueError("GLB is not glTF 2.0")
    meshes = doc.get("meshes", [])
    if not meshes:
        raise ValueError("No 3D mesh found")
    accessors = doc.get("accessors", [])
    triangles = 0
    vertices = 0
    for mesh in meshes:
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4:
                continue
            index = primitive.get("indices")
            position = primitive.get("attributes", {}).get("POSITION")
            if position is not None and position < len(accessors):
                vertices += accessors[position].get("count", 0)
            if index is not None and index < len(accessors):
                triangles += accessors[index].get("count", 0) // 3
            elif position is not None and position < len(accessors):
                triangles += accessors[position].get("count", 0) // 3
    warnings = []
    if triangles > 300000:
        warnings.append("High triangle count: prepare mobile LOD")
    if len(data) > 15 * 1024 * 1024:
        warnings.append("Large GLB: consider mesh and texture compression")
    if not doc.get("skins"):
        warnings.append("No skeleton; a natural blink/wave requires rigging")
    if not doc.get("textures"):
        warnings.append("No textures: inspect fabric and facial detail")
    return {
        "file": path.name, "bytes": len(data), "meshes": len(meshes),
        "triangles_estimate": triangles, "vertices_estimate": vertices,
        "materials": len(doc.get("materials", [])), "textures": len(doc.get("textures", [])),
        "skins": len(doc.get("skins", [])), "animations": len(doc.get("animations", [])),
        "warnings": warnings,
        "status": "structure_pass; NOT a cinematic visual acceptance",
    }

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/validate_generated_princess_glb.py model.glb", file=sys.stderr)
        sys.exit(2)
    try:
        print(json.dumps(inspect(Path(sys.argv[1])), indent=2))
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Invalid GLB: {error}", file=sys.stderr)
        sys.exit(1)
