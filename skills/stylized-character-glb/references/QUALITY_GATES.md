# GLB quality checklist (review record)

**Scope:** Character ID ____ · Source image SHA ____ · GLB SHA ____ · Date ____ · Reviewer ____

For every item record `PASS`, `FAIL`, `N/A`, or `UNVERIFIED`. **UNVERIFIED is not PASS.** Use real renders; screenshots are evidence, not automatic validation.

## A. Reference intake

- [ ] License/permission and source provenance captured; no private photo unintentionally published.
- [ ] Head, crown, hands and feet entirely in frame; no clipping or fusion.
- [ ] Neutral A-pose, separated arms/fingers/garment layers, coherent light.
- [ ] Alpha mask visualized on light/dark; no halo, stray bits or missing geometry.
- [ ] Model/service/version/seed/options and actual reference hashes recorded.

## B. Orbital visual acceptance

- [ ] Front: recognizable pleasant face, correct eyes/nose/mouth and costume silhouette.
- [ ] 45°: eye sockets, cheeks and nose retain volume; hair stays attached to scalp.
- [ ] Side 90°/270°: nose, lips, chin, jaw, ears and skull depth coherent.
- [ ] Rear 180°: head/hair/back-of-dress form real volumes, no paper shell.
- [ ] Both hands/fingers detached from torso/skirt and not distorted.
- [ ] Fabric layers have thickness; no large inverted/inside-out folds.
- [ ] Crown and accessories follow head/garment rather than float.
- [ ] No severe clipping of face, shoulders, hair, waist or skirt in multiple poses.
- [ ] Facial landmarks remain coherent under flat, warm, cool and low lighting.
- [ ] Human review marks face/style appropriate from **all** required angles.

## C. Geometry, material and file

- [ ] `inspect_glb.py` succeeds; report and SHA archived.
- [ ] Khronos glTF-Validator run; errors resolved or explicitly justified.
- [ ] No unintentional external URLs/texture dependencies.
- [ ] Expected materials/texture resolution and color space verified.
- [ ] Normals, UV seams, double-sided/transparency policy checked.
- [ ] Triangles, draw calls and texture memory measured in destination engine.
- [ ] If animated: rigs/skin/morph channels, deformations and intended clips verified (do **not** infer from static mesh).

## D. Indicative first-pass mobile budgets — NOT requirements of glTF

These are *planning hypotheses* for a character within a **whole mobile scene**, not pass/fail guarantees. Adjust by device, shaders, scene, lighting and animation:

- Delivery file target often **<8–15 MiB**; measure compressed network response and decoded GPU memory separately.
- First LOD candidate roughly **60k–150k triangles**; compare actual render time and appearance before reducing further.
- Character material/draw-call target roughly **<30 draw calls**; batching depends on engine and materials.
- Profile cold load, memory, frame pacing, interactions and background/foreground recovery on real iPhone/Android devices.
- Compare high/medium/low LOD; keep face silhouette and key cloth shapes readable even at lower detail.

## E. Release decision

- [ ] All required angle reviews passed.
- [ ] Technical validator results and performance logs attached.
- [ ] All third-party licenses and required model attribution preserved.
- [ ] Fallback asset remains available.
- [ ] Preview-branch and preview-route tested; no broken app URLs/base paths.
- [ ] Reviewer explicitly approves promotion to production.

**Release status:** `REJECT / NEEDS_ITERATION / APPROVED / N/A`.