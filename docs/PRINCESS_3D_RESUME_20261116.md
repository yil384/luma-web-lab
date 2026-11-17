# Princess 3D continuation — 2026-11-16

**Branch:** `feat/princess-kitten-art-direction-20261116` · **PR:** [#2](https://github.com/yil384/luma-web-lab/pull/2) (Draft).  
**Production:** unchanged. No new character asset has been accepted, merged or deployed.

## What we recovered

The goal is a **real, rotatable, original adult fantasy princess** beside the Christmas tree and kitten — *not* a 2D photo card and not the low-detail fallback. The approved styling is warm chestnut waves, expressive brown eyes, a delicate gold/pink jewel tiara, puff sleeves, and an ivory-and-blush pink ball gown. The face must remain attractive at 0°, 45° and 90° and the back hair/skirt must be actually modeled.

The **most recent lookdev image** in ChatGPT Library is `Elegant Pink Ballgown Princess Render.png` (1024 × 1536, RGBA, created on Nov 16). It has a cleaner, visibly complete full-body A-pose and less fussy costume geometry than the earlier ornate example. It was **created after** the two inspected GLBs. Do not claim the earlier GLBs were reconstructed from this newest reference. Keep the original image attached to the local generation/QA handoff, not in the public site without review.

The earlier technical study archive `luma-princess-3d-technical-study-v2.zip` and design/modeling kits remain in Library. The GLB is deliberately absent from the repository.

## Actual candidate comparison (rendered front / 45° / profile / rear)

| Previous Library GLB | Bytes | Triangle faces | Meshes | Materials / textures | Skeleton / animations | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `sample_2026-11-16T192608.631.glb` | 13,717,388 | 279,846 | 1 | 1 / 2 | 0 / 0 | **Reject** — large floating chunks behind hair, broken back silhouette, textured dress does not survive a turn |
| `sample_2026-11-16T195210.635.glb` | 11,808,948 | 289,514 | 1 | 1 / 2 | 0 / 0 | **Reject for production** — rear volume is more coherent, but face/eyelids look uncanny and material detail is far short of the reference |

Both are structurally valid GLB meshes with `EXT_texture_webp` resources. A passing validator **does not** imply attractive face, production-grade materials, correct skin weights, expression morph targets or phone-ready rendering.

## New review studio

The source branch now includes **`public/princess/model-review.html`**, a locally operated quality-assurance page (after a branch preview build, open `<base>/princess/model-review.html`).

- Drag or select an actual GLB **from the user's device**. It loads via a local Blob URL; the model is never uploaded to this repository or an app server.
- Choose the original PNG separately for side-by-side visual comparison.
- Inspect actual 0°/45°/90°/180° views, then manually orbit and zoom. Report mesh count, approximate triangle faces, textures, skin and animation count.
- Five manual checkboxes cover face, side profile, back topology, fabrics/intersections, and real-phone performance.
- Export a local JSON review with `approvedForProduction: false` intentionally fixed; human checks are **not** an auto-merge or deployment authorization.

This optional review page uses the pinned, externally hosted Google `model-viewer` web component. Its CDN and rendering have **not** yet been verified on a physical phone or Chinese mainland network. Existing Christmas routes do not depend on it.

## Release safety in the main 3D scene

`src/scene/PrincessAsset.tsx` now uses `VITE_PRINCESS_GLB_APPROVED=true` as an explicit build-time **preview gate** for loading `public/princess/luma-princess-hd-study-v2.glb`. With no gate set, the existing procedural companion renders and the site does not issue an inevitable GLB 404 on every visit.

The gate is **not** proof of quality and must not be enabled in production merely because a file exists. The preview build is safe to inspect without affecting `gh-pages`.

## Next actual asset iteration

1. Use the most recent clean full-body **original-character PNG**, with its real transparent background. Never upload the project's private human identity reference to an outside service without authorization.
2. Try the [official Microsoft TRELLIS.2 ZeroGPU Space](https://huggingface.co/spaces/microsoft/TRELLIS.2) at no monetary charge if quota allows; export an **actual GLB**, not a video/still. This is a hosted GPU process, not local M1 inference.
3. Validate the output with `python3 scripts/validate_generated_princess_glb.py path/to/model.glb` and inspect in the new review studio. Reject if it repeats the eyelid, side-face, hair occlusion, skirt or back errors.
4. If a model passes multi-angle visual inspection, optimize PBR textures/geometry and, separately, rig blink/wave. A no-skeleton source may only curtsy/tilt; do not call it a natural wave.
5. Commit approved GLB **only to this branch**, verify the isolated preview and a real iPhone, preserve the existing photo album, film and `/letter/` and `/christmas/`. Merge/publish only after acceptance.

**Cost boundary:** the prior workflow explicitly chose a $0 / free ZeroGPU path. A paid fal image-to-3D job was *not* submitted and cannot be silently substituted. A better result may require a deliberate change in budget or human 3D art direction, not an unreviewed upgrade.

**QA status:** two historical GLB candidates have been rendered and compared offline; the current optional browser viewer and updated PR still require live browser/CI inspection. No film-quality or 1:1 identity claim is justified.
