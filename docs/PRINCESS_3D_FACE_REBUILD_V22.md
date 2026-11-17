# Princess GLB — V22 volumetric face reconstruction and verified production notes

**Date:** 2026-11-16  | **PR:** [#2](https://github.com/yil384/luma-web-lab/pull/2)  | **Status:** offscreen-reviewed candidate, **not deployed**.

## 1. Why V1–V8 were rejected

The user chose the strongest existing Microsoft TRELLIS.2 image-to-3D result after exhausting the free generation quota. The real input was `sample_2026-11-16T232200.115.glb` (14,278,916 B; 287,940 original vertices, 288,503 original triangles). It had coherent chestnut hair, tiara and dress, but its two eye-front surfaces were missing: a frontal ray through an eye socket hit the inside/rear of the head.

We tried painting the eye region, then adding real little eyeballs and eyelid strips, and smoothing existing face normals. These steps reduced the hollow-eye look but created unnatural protruding eyes, broken eyebrows and visible UV seams. Directly projecting a high-resolution closeup photo onto the broken source UV made the lips too large. The first hand-built frontal face sheet looked plausible head-on but caused a detachable *mask* in profile; linear depth segments also produced dark horizontal shading bands. None of those prototypes passed the all-angle gate.

## 2. The actual V22 reconstruction — performed without another paid generation

- Kept the original gown, crown and hair; excluded **3,503** damaged front face and neck triangles by guarded position and sampled skin-color conditions. The remaining original body retained **285,000** triangles.
- Created a **new, closed, volumetric 3D head + jaw + neck** with height-dependent PCHIP cross sections, nose projection, cheek and lip volume and shallow eye relief. It is **not a camera-facing image plane**.
- Added fully modeled side/back head surface under the original hair; forehead/cheeks blend to a narrower neck, with top and bottom capped. The new head alone passes `mesh.is_watertight`.
- Applied the project's newly authored original **fantasy princess portrait** as curved-surface albedo detail. The visible eyes/eyelashes are primarily painted plus shallow sculpted relief: **this is not a rigged face with independent eyeballs, lids, or facial blendshapes.**
- Fixed an early *upside-down UV* export; checked color in unlit renders first, then designed smooth face normals to remove overly dark horizontal bands under lights. A smooth visual result is not evidence of correct physical skin simulation.
- Harmonized the side/back scalp and neck colors rather than leaving a hard skin-color boundary or overlay face mask.

## 3. Structural metrics (verified)

| Property | Original GLB | Reconstructed V22 WebP GLB |
| --- | ---: | ---: |
| File bytes | 14,278,916 | **13,043,624** |
| Triangles | 288,503 | **348,712** |
| Meshes | 1 | **2** |
| Embedded images | 2 | **3**, all decodable WebP |
| Materials | 1 | **2** |
| Skins / animations | 0 / 0 | **0 / 0** |
| GLB structure | valid | valid, one JSON + one BIN chunk |
| External texture resources | none | none |
| GLB SHA-256 | preserve original | `3b8a44ea95e751a9b9caf58894724a2c22d1910235eb1ecd1850dbf44ede5c73` |

Raw intermediate V22 GLB (embedded PNG images): **21,684,152 B**. Repacked WebP GLB: **13,043,624 B**. The `EXT_texture_webp` extension is declared as required, so older unsupported viewers need a separate compatible output.

Offline VTK renders successfully inspected **0°, 30°, 60°, 90°, 180°** plus full-body front/45°/side/back. The improved face is markedly less uncanny than the original, but this is a **subjective art review**, not an automated score or proof of film quality.

## 4. Reproducible source and updated skill

A matching versioned delivery archive was created in the ChatGPT conversation, including the actual original/updated GLB binaries, reference PNG, original fantasy face reference, render comparisons, quality report, a calibrated head reconstruction script and a PNG→WebP GLB optimizer.

The `stylized-character-glb-skill` reusable archive was also updated to **v0.2** with a new actual case study, troubleshooting guide, a CLI `rebuild_princess_head_case.py`, WebP repacking script, and existing GLB validation/test scripts. The reconstruction script verifies **this precise input mesh topology** and must not be applied blindly to arbitrary GLBs.

Reproduce with the versioned delivery files:

```bash
python3 -m pip install numpy scipy opencv-python trimesh pillow
python3 scripts/rebuild_princess_head_case.py source.glb fantasy-face-portrait.png rebuilt.glb
python3 scripts/optimize_glb_webp.py rebuilt.glb rebuilt-web.glb
python3 scripts/inspect_glb.py rebuilt-web.glb
```

The exported WebP GLB was regenerated a second time from these scripts and its SHA-256 matched **byte for byte**.

## 5. Never silently promote to the live gift site

- V22 binary **is not committed** to this feature branch; the GitHub project cannot be considered deployed merely because this file exists.
- Before preview, copy the reviewed binary to `public/princess/luma-princess-hd-study-v2.glb` **on this feature branch only**. The loader is opt-in through `VITE_PRINCESS_GLB_APPROVED=true` and otherwise renders the existing procedural fallback.
- Run production JS lint/tests/build, **real browser Three.js/WebGL load**, at least one physical iPhone Safari and an Android Chrome device where feasible; inspect texture extension support, memory/VRAM, first-load time, interactive orbit and reduced-motion mode.
- Verify the original tree, photo ornaments/gallery, movie and `/letter/` and `/christmas/` routes remain intact. Preserve rollback. The live `gh-pages`, the domain, and currently published assets are unchanged.
- **Animation:** the GLB still has no bones, morphs or animation clips. A natural blink, speaking mouth or wave requires later retopology/rigging. No claims of such behavior should be made.

**Gate:** keep [PR #2](https://github.com/yil384/luma-web-lab/pull/2) in Draft until visual acceptance, real-device validation and an explicit release decision. Prior examples of local procedural curtsy behavior are *not* natural rig animation.
