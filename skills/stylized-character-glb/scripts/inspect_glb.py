#!/usr/bin/env python3
"""Dependency-free GLB 2.0 structural audit. NOT a visual/rig/conformance pass."""
from __future__ import annotations
import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
HEADER = struct.Struct("<4sII")
CHUNK = struct.Struct("<II")

def inspect(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("GLB is too short")
    magic, version, declared = HEADER.unpack_from(data)
    if magic != b"glTF" or version != 2 or declared != len(data):
        raise ValueError(f"Bad GLB header: magic={magic!r} version={version} header_size={declared} actual={len(data)}")
    pos = HEADER.size
    chunks = []
    while pos < len(data):
        if pos + CHUNK.size > len(data):
            raise ValueError("Truncated chunk header")
        n, kind = CHUNK.unpack_from(data, pos)
        pos += CHUNK.size
        if n % 4 or pos + n > len(data):
            raise ValueError("Invalid chunk size or 4-byte alignment")
        chunks.append((kind, data[pos:pos+n]))
        pos += n
    if not chunks or chunks[0][0] != JSON_CHUNK:
        raise ValueError("First GLB chunk must be JSON")
    if len(chunks) > 2 or (len(chunks) == 2 and chunks[1][0] != BIN_CHUNK):
        raise ValueError("Unexpected GLB chunk sequence")
    try:
        doc = json.loads(chunks[0][1].decode("utf-8").rstrip(" \n\t\r\0"))
    except (UnicodeDecodeError, ValueError) as error:
        raise ValueError(f"Invalid embedded JSON: {error}") from error
    if not isinstance(doc, dict) or doc.get("asset", {}).get("version") != "2.0":
        raise ValueError("Missing glTF 2.0 asset metadata")
    meshes = doc.get("meshes", [])
    if not meshes:
        raise ValueError("No meshes present")
    acc = doc.get("accessors", [])
    verts = tris = prim_count = morph = 0
    other_modes = {}
    for mesh in meshes:
        for p in mesh.get("primitives", []):
            prim_count += 1
            morph += bool(p.get("targets"))
            idx = p.get("attributes", {}).get("POSITION")
            if not isinstance(idx, int) or not 0 <= idx < len(acc):
                raise ValueError("Missing/invalid POSITION accessor")
            nverts = int(acc[idx].get("count", 0))
            verts += nverts
            ii = p.get("indices")
            if ii is None:
                count = nverts
            elif isinstance(ii, int) and 0 <= ii < len(acc):
                count = int(acc[ii].get("count", 0))
            else:
                raise ValueError("Invalid index accessor")
            mode = int(p.get("mode", 4))
            if mode == 4:
                tris += count // 3
            elif mode in (5, 6):
                tris += max(0, count - 2)
            else:
                other_modes[str(mode)] = other_modes.get(str(mode), 0) + 1
    external = []
    for collection in ("buffers", "images"):
        for item in doc.get(collection, []):
            uri = item.get("uri")
            if uri and not uri.startswith("data:"):
                external.append({"type": collection, "uri": uri})
    skins = len(doc.get("skins", []))
    animations = len(doc.get("animations", []))
    materials = len(doc.get("materials", []))
    textures = len(doc.get("textures", []))
    warnings = []
    if tris > 300000:
        warnings.append("Over 300k triangles; test actual mobile cost and LOD")
    if len(data) > 15 * 1024 * 1024:
        warnings.append("Over 15 MiB; examine geometry and texture compression")
    if not skins and not animations and not morph:
        warnings.append("Static asset: no skins, embedded animations or morph targets")
    if skins == 0 and animations:
        warnings.append("Animations without skins; inspect channel targets")
    if not textures:
        warnings.append("No textures; check whether this is intentional")
    if not materials:
        warnings.append("No materials; check appearance")
    if external:
        warnings.append("External resource URLs present; GLB may not be self-contained")
    if other_modes:
        warnings.append("Contains non-triangle primitives")
    return {
        "file": str(path),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "glb_version": 2,
        "chunks": ["JSON" if kind == JSON_CHUNK else "BIN" for kind, _ in chunks],
        "mesh_count": len(meshes),
        "primitive_count": prim_count,
        "vertices_estimate": verts,
        "triangles_estimate": tris,
        "other_modes": other_modes,
        "materials": materials,
        "textures": textures,
        "images": len(doc.get("images", [])),
        "skins": skins,
        "animations": animations,
        "morph_target_primitives": morph,
        "external_references": external,
        "extensions_used": doc.get("extensionsUsed", []),
        "warnings": warnings,
        "status": "STRUCTURE ONLY; requires Khronos validator, visual, rig and runtime QA"
    }

def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("glb", type=Path)
    p.add_argument("--output", type=Path, help="Optional JSON report output")
    args = p.parse_args()
    try:
        result = inspect(args.glb)
    except (OSError, ValueError) as error:
        print(f"GLB AUDIT ERROR: {error}", file=sys.stderr)
        return 1
    report = json.dumps(result, indent=2, ensure_ascii=False)
    print(report)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(report + "\n", encoding="utf-8")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
