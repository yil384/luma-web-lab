# Princess face repair V52 — preserve original sculpt, paint locally

**2026-11-17 · Branch-only technical experiment, not accepted or published.**

This iteration follows the user's revised direction: **keep the selected TRELLIS.2 princess's original head, nose, lips, hair, tiara, gown and body; repair only the empty eye sockets and paint on existing facial geometry**. The previous V22–V41 replacement-head attempts are rejected for unacceptable 45° appearance.

## Real implementation and evidence

- Source: `sample_2026-11-16T232200.115.glb` (287,940 vertices, 288,503 triangles), plus the project's generated original-character facial artwork (not a real-person identity photo).
- Removed **281** defective orbital triangles only.
- Re-UVed and painted **2,123 triangles from the actual original facial surface**, preserving their positions and the source nose/lip/jaw shape. This is **not** a second full-head mesh or a camera-facing face billboard.
- Corrected the winding of **1,060** original facial triangles. The original source has many inconsistent face normals; unguarded recomputation produced severe black shading and was rejected.
- Added two shallow curved eye-opening surface patches (~7,168 triangles each). V50 tried separately hand-drawn simplified eyes; **V52** paints eye/eyelash/iris details from the **same original-character concept** onto the two small curved patches in matching UV coordinates.
- Repacked five embedded images to WebP in a standalone GLB. De-duplicated unused vertices using **explicit normal/UV reindexing** rather than `trimesh.remove_unreferenced_vertices()` (that function caused visible changes in earlier trials).

## Validated V52 binary

| Fact | Result |
| --- | --- |
| Size | 15,116,140 bytes (14.42 MiB) |
| SHA-256 | `547716a62ecdd8b4ab8492da82f107ea33302bc42ee87b791886b603f0736f21` |
| Meshes / triangle primitives | 4 / 4 |
| Total triangles | 302,558 |
| Indexed vertices estimate | 295,605 |
| Textures | 5 embedded WebP, no external resource URI |
| Skins / morph targets / animations | 0 / 0 / 0 |
| Offline rendered views | 0°, 30°, **45°**, 60°, 90°, 180° |
| WebP/compression difference | Mean RGB difference under 0.52 per channel for all checked views; no pixel delta greater than 32 |
| Reproducibility | Reran the portable full pipeline from original GLB and original-character crop; **SHA-256 identical** |
| Browser / physical phone | **Not tested** |
| Final artistic acceptance | **NOT PASSED** |

Rejects in this experiment: V42 patch z-fighting and reversed winding; V43 wide googly eyes; V45 dark face after re-UV because of flipped original source normals; V49 raw face-depth normals generated severe ridges; V51 blending the entire face atlas into the eye holes made ghost-like eyes. V52 is the **least problematic candidate from the local-face-only family**, not proof of fully natural facial anatomy.

## Reproducible handoff

The user-facing `luma_princess_v52_local_face_paint_reproducible.zip` contains the actual input/output GLBs, reference image, same-camera 45° and 0°/45°/90° comparisons, six scripts, structural JSON report, and `review-model.html` local-file 360° viewer.

Source scripts require `numpy scipy opencv-python Pillow trimesh`; optional VTK for offline turntable.

```bash
python3 scripts/repair_princess_local_face.py source/source-trellis2-best.glb reference/approved-original-character-face.png build/model-raw.glb
python3 scripts/compact_preserve_normals.py build/model-raw.glb build/model-compact.glb
python3 scripts/optimize_glb_webp.py build/model-compact.glb build/model-v52-web.glb
python3 scripts/inspect_glb.py build/model-v52-web.glb
```

These scripts are **specific to this one source topology**, not general 3D tools; review the validation guard before reusing them.

## Open issues and release gate

The expression/eye geometry is still mostly texture-painted, not separate rigged eyeballs or real eyelid deformation. Ear, cheek-to-ear and jaw-to-neck transitions are still visible at some angles; hair/dress retain the original coarse shapes. The source GLB is not globally manifold and the shallow eye inserts are not retopologized into an animation-ready face. No independent blink, wave or speech animation exists. **Do not claim this model has zero uncanny appearance or cinematic production quality.**

The V52 **binary has not been committed** to the repository, merged or deployed. Keep PR #2 Draft; its `VITE_PRINCESS_GLB_APPROVED` gate is a **technical preview toggle only**, not visual signoff. Before a live release, run the actual browser WebGL and real iPhone test, review the album/film/cat and `/letter/` and `/christmas/` routes, and obtain explicit user visual acceptance. The live Pages branch, custom domain and original media are unchanged.

**Core lesson:** preserve good original sculpt geometry; paint the face on actual existing triangles and patch true holes locally. Never treat successful GLB export, additional detail, or pretty front-only images as proof of acceptable 45° geometry.
