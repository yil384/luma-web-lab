# Manual Face Repair — 2026-11-16

**Status:** physically edited GLB candidate built and offscreen-reviewed; **not merged or deployed**.

The user exhausted TRELLIS.2's generation quota and selected their best current candidate (`sample_2026-11-16T232200.115.glb`, 14,278,916 bytes). It has a coherent dress and hair silhouette but its eyes are actual holes: a front ray through the eye centers hits the rear head, not an eyeball.

## Repair actually performed (without another generation)

- Reused the user's existing mesh as-is; its **287,940 original vertices and 288,503 original faces were verified bitwise unchanged**.
- Added two actual spheroid eye surfaces, curved amber/brown iris geometry, eye contours, and colored upper eyelid skins.
- Projected the already approved original character facial reference to existing UV triangles in a limited facial mask, with feathered borders; corrected forehead/cheek shading with localized normal adjustments. This is not a camera-facing 2D billboard.
- Rejected an experimental added face shell because it introduced visible mask-like seams.
- Republished the accepted local candidate as a GLB with embedded WebP textures via `EXT_texture_webp`, reducing the experimental output from 23.16 MB to **14,918,192 bytes** (about 14.23 MiB).

## Structural QA

| Property | Value |
| --- | --- |
| Mesh primitives | 11 (original complete princess + 10 eye components) |
| Triangle count | 304,243 |
| Embedded textures | 3 (WebP) |
| Skeleton | 0 |
| Animation clips | 0 |
| Original mesh coordinates/topology | Unchanged |
| GLB binary header/length/buffer views | Passed |
| Embedded texture decoding | Passed |
| Offline camera angles | 0°, 30°, 60°, 90°; full model also 180° |

**Remaining limitations:** Face still has faint UV seams; quality is improved over eye holes but not movie-grade. Not physically tested in iPhone/Safari. No natural blink/wave rig. Do not publish unreviewed, or call it cinematic/rigged.

## File handoff

The repaired asset is delivered in the conversation as `luma_princess_face_sculpt_v1_web.glb` and in a 12-file self-contained source + review archive named `luma_princess_face_manual_refinement.zip`.

For isolated preview, put the GLB at `public/princess/luma-princess-hd-study-v2.glb` and run `VITE_PRINCESS_GLB_APPROVED=true npm run dev`. Its filename matches the existing loader in `src/scene/PrincessAsset.tsx`.

**Important:** This document does not imply that a binary has been uploaded into the GitHub repository. The production branch and `gh-pages` site are unchanged. Keep PR #2 as Draft until 3D browser QA and user acceptance.
