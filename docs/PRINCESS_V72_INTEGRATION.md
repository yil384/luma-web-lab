# Christmas companion · Gemini V72 provisional integration

**Status:** user selected V72 as the current 3D princess on 2026-11-17. This is a **feature-branch preview**, NOT a film-grade character approval, rigged animation or public deployment.

## V72 asset
- User-provided file: `princess-eyes-candidate-v72.glb`
- SHA-256: `9bbf7c0ed5da9b7372906a30b665f0e118a3a66c3122e1499ea8dc4ecd454cbf`
- Size: 15,329,160 bytes; glTF 2.0; 3 meshes (base princess + left/right eye inserts); 333,247 triangles; 4 embedded WebP textures; no skeletons or animation tracks.
- Do not re-export the original PBR materials, UVs and vertex normals during scene integration: this can alter the artwork significantly.
- The exact GLB binary is in the conversation's downloadable integration kit. **The GitHub connector accepted the loader/source changes but not the 15 MB binary attachment, so the repo branch does NOT yet contain that binary.** CI testing of the branch alone cannot prove V72 actually renders in-browser.

## Stage the model on the preview branch

```bash
git checkout feat/princess-kitten-art-direction-20261116
npm ci
npm run princess:install -- /absolute/path/princess-eyes-candidate-v72.glb
VITE_PRINCESS_V72_PREVIEW=true npm run dev
```

The installer verifies the **exact hash** and GLB structure and copies the candidate to `public/princess/luma-princess-v72.glb`. This leaves `gh-pages`, `main`, and the public domain unchanged. With the environment flag missing (the default), the earlier procedural 3D companion remains visible; if GLB loading fails, the loader also safely falls back.

`VITE_PRINCESS_GLB_APPROVED` was the older experimental switch and does **not** enable V72.

## Scene behavior implemented

- 3D model is requested only after the user enters the active tree scene, not during the greeting/video intro.
- Original V72 mesh / material / texture data remain unchanged; the loader only applies an outer display transform.
- Scale to 5.12 scene units, place near the cat at X 6.25 / Z 7.15 with Y sampled from the snow ground.
- Small idle sway and a restrained whole-body acknowledgment on click. **No claims of natural waving, blinking or lip-sync:** V72 has no skin/skeleton/morph animations.
- Reduced-motion handling, pause handling, safe asynchronous unmount and material/texture cleanup.
- Procedural princess visible while the 15MB GLB is loading; missing/invalid GLB falls back.

## Validation and remaining steps

**Completed locally:** exact SHA-256 match, GLB structure inspection, texture declaration and independent CPU multiview renders (0°, 30°, 45°, 60°, 90°, 180°); installer / GLB contract regression tests. **Not yet completed:** real Three.js/WebGL browser and physical-device performance tests with model in the full Christmas scene.

Before any public release:
1. Stage the attached V72 binary and check network HTTP 200, decode, floor contact, lighting, screen framing and kitten proximity in actual Chrome/Safari WebGL.
2. Verify tap versus camera drag, pause and reduced-motion, re-entry without texture leaks, 15MB loading on a physical iPhone.
3. Check existing photo album, ornaments, films, `/letter/` and `/christmas/` have not regressed.
4. Confirm visual acceptance and explicit publishing permission. **Do not merge PR #2 or deploy from an out-of-date `main` source snapshot without reconciling the newer Sites source / `gh-pages` deployment.**

## Next experience milestone

With the character frozen, improve the *site experience*: restrained princess–kitten interaction, gaze/attention cue, accessible tap affordance, and graceful loading on mobile. No more face/sculpt iterations unless the user explicitly asks.
