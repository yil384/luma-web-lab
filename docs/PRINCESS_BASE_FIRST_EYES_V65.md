# V65: Base-first princess face study — keep the good original GLB

**Status 2026-11-17: eye-only research prototype; NOT visually accepted or published.**

## Changed approach after user review

The user was right: the initial TRELLIS.2 base (`sample_2026-11-16T232200.115.glb`) already has a recognizable, pleasant nose, smile, cheeks, jaw silhouette, hair, crown and gown. Most V22–V52 replacements/repainted faces damaged that visual identity, especially at 45°.

Only the **two empty eye sockets** actually require added geometry. Mouth and nose should be preserved unless a specific local issue persists *after* the eyes are acceptable; then apply a restrained, individually previewed edit to the original UV material, **not** a whole-face projection or new mask shell.

## Most important technical discovery: re-export changed original shading

Exporting the original `Trimesh` scene back to GLB **without any intentional geometry change** altered the appearance of the original face. The earlier scripts reconstructed geometry, vertex normals and PBR export paths in ways that broke the originally convincing lighting. Consequently, even a supposedly tiny edit could make all cheeks and jaw facets look worse.

We implemented `append_to_original.py` instead. It parses the original GLB and appends only new **bufferViews/accessors/materials/images/meshes/nodes**. A binary invariant verifies:

- The **14,277,072 bytes of the original BIN buffer** are reproduced byte-for-byte as a prefix.
- The existing original mesh, index accessor, vertex positions, normals, UVs, material, textures, images, and source node definitions are preserved exactly.
- No original triangles deleted; **288,503 original triangles unchanged**.
- Two small, shallow *almond-shaped* orbital meshes added (3,040 triangles each), using the same original-character eye reference. Both are genuine 3D surfaces, not a full-face photo card.

This is a *technical* preservation guarantee; it is **not** a quality guarantee.

## A/B tests and what failed

- V54/V55: re-exported original mesh as part of a new scene. Even with source coordinates unchanged, the face became visibly more faceted. Reject.
- V56/V57/V58: raw-binary-preserving additive eye **round patches** solved the holes but caused goggle/bug-eye rings. Reject.
- V59/V60: narrowed painted eyes reduced the roundness but produced droopy eyes and patch borders. Reject as release.
- V61/V62/V63: added real eyeball globes with iris discs and eyelid strips, but unconvincingly protruded from the original sockets. Reject.
- V64/V65: no full circular skin plate; instead append two small almond-shaped textured 3D patches. The base nose/mouth/cheek lighting remains **identical**, but eyes are still visually imperfect, especially at 45°. **V65 is only a review prototype, not a shipping asset.**

## V65 structural facts

- **14,464,876 bytes** (13.79 MiB); SHA-256 `29e64d73cdf6650cf16c2dcd40ffbd9a9d03cccb3c00b5e22e16399c992302d8`
- 3 mesh primitives, 294,583 total triangles; original 288,503 untouched plus 6,080 added eye faces.
- 4 embedded WebP images; no external image references, no rig, no animations.
- Static CPU renders at 0°,30°,**45°**,60°,90°,180°; no real iPhone/WebGL acceptance.
- Rebuilt the V65 file from original source + reference and reproduced exactly the same SHA-256.

## Current actionable recommendation

Use the **original GLB as the master** and treat eyes, lip pigment and nasal highlight as three *separate small work orders*. Do not retopologize the whole face to fix small visual details. The critical remaining issue is to fit actual **eyelids/eye volume inside the original sockets**; V65's isolated eye planes are not yet artistically natural. Do not promote V65, V52 or V41 based on a prettier one-view screenshot.

Keep PR #2 in Draft; do not touch `main`, `gh-pages`, or the domain until user approves an actual front/45/side turntable and real-device QA.
