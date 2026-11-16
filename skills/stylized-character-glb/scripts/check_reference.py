#!/usr/bin/env python3
"""Sanity-check a modeling reference PNG/JPEG (requires Pillow; no edits)."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

def inspect(path: Path) -> dict:
    with Image.open(path) as img:
        fmt = img.format
        w, h = img.size
        alpha = img.convert("RGBA").getchannel("A")
        bbox = alpha.point(lambda p: 255 if p > 16 else 0).getbbox()
        extrema = alpha.getextrema()
    warnings = []
    margin = None
    if bbox:
        l, t, r, b = bbox
        margin = {"left": l, "top": t, "right": w-r, "bottom": h-b}
        if min(margin.values()) < 8:
            warnings.append("Foreground within 8px of border; check crown, hands and shoes")
    else:
        warnings.append("No visible foreground according to alpha mask")
    if extrema == (255, 255):
        warnings.append("Fully opaque image; check background for segmentation artifacts")
    if min(w,h) < 512:
        warnings.append("Small reference image (<512px on at least one axis)")
    if w/max(1,h) > 1.2:
        warnings.append("Wide image; verify it is not a collage in a single-view input")
    return {
        "path": str(path),
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "format": fmt, "width": w, "height": h,
        "alpha_range": extrema, "foreground_bbox": bbox,
        "clear_margin_px": margin, "warnings": warnings,
        "status": "AUTOMATIC CHECK ONLY; inspect alpha against light and dark backgrounds"
    }

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("image", type=Path)
    p.add_argument("--output", type=Path)
    a = p.parse_args()
    report = json.dumps(inspect(a.image), indent=2, ensure_ascii=False)
    print(report)
    if a.output:
        a.output.write_text(report + "\n", encoding="utf-8")

if __name__ == "__main__":
    main()
