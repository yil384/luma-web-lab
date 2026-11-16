---
name: stylized-character-glb
description: End-to-end reusable workflow for original stylized character 2D reference design, single-image or multiview 3D generation, face and topology iteration, glTF/GLB inspection, turntable review, mobile optimization, and controlled website integration. Use when making cute high-detail 3D humanlike characters and when diagnosing uncanny faces or broken generated GLBs.
---

# Stylized Character → Production GLB

**Status:** v0.1 field notes, 2026-11-16. The current princess example has **not** passed face/multiview/rig acceptance. This is a repeatable process and a tested *structural diagnostic*, not a claim that an end-to-end film-quality asset has already been delivered.

## Read first

- `references/CHARACTER_BRIEF.md`: lock identity and design before generating.
- `references/REFERENCE_PROMPTS.md`: prompts for original, modeling-friendly reference images.
- `references/QUALITY_GATES.md`: visual and engineering pass/fail criteria.
- `references/CASE_STUDY_2026-11-16.md`: this project's real observations, failed approaches, and pending experiments.
- `scripts/inspect_glb.py`: dependency-free **structural** report, not aesthetic scoring.
- `scripts/check_reference.py`: Pillow-based input-image sanity check.
- `scripts/render_turntable_blender.py`: optional four-angle renderer, Blender runtime required; currently syntax-checked, not Blender-rendered in this release.

## Goal and non-goals

**Goal:** A coherent original character in the round, not just an attractive front render. Preserve a stable silhouette, pleasant face, volumetric hair, legible garment layering, appropriate materials, clean geometry, and loadability in a real web scene.

**Not guaranteed:** One reference image cannot uniquely determine 3D anatomy. AI image-to-3D is a candidate generator, not a face-sculptor, retopologist, or automatic rigging service. A nice 2D image and a valid `.glb` do **not** establish production readiness.

Create **original** animated-feature-inspired designs; do not reproduce a named studio's proprietary characters, licensed likenesses, or protected source assets. Confirm license and privacy before publishing any source image or generated media. Never upload a person's private photos without authorization.

## Operating procedure

### 0. Freeze the character brief and acceptance target

Record a `character-id`, date, seed/version, intended viewpoint, color palette, proportions, hair massing, accessories, dress construction, and export target. Select one target: **still viewer**, **interactive rotating prop**, or **rigged animated character**. These need different deliverables; GLB alone does not mean rigging.

Use `references/CHARACTER_BRIEF.md` as the template. Avoid silently changing the face, outfit, or hair across attempts. Store each revision with its prompt/model/version/seed, input hash, output hash, cost, screenshots, and QC verdict. Do not assert generator settings that were not recorded.

### 1. Design a modeling-friendly 2D reference

For first pass: one **full-body**, single character, orthographic-ish frontal reference; neutral relaxed **A-pose**, hands separated from clothing and torso; feet and shoes visible; crown, hair, fingers, and skirt fully inside frame. Camera near eye/chest height; no dramatic foreshortening. Studio or clean transparent background, contact shadow only if it can be cleanly removed. Stable even key light rather than extreme cinematic contrast.

For a stylized but anatomically convincing face: moderately sized eyes, perceptible upper/lower eyelids, readable nasal bridge and tip, soft lips, jaw and cheek volume, visible ears where possible. Treat numerical eye-size changes (e.g. -8% to -12%) as *experimental prompt adjustments* rather than a universal recipe.

Hair: large continuous locks that plausibly attach to the scalp. Prefer readable clumps over hundreds of isolated wisps. Skirts: clear structural layers and thickness rather than thin floating transparent veils. Make arms distinguishable from silhouette at shoulder, elbow, wrist and fingers. Favor a crown, earrings and bows that are big enough to survive meshing. No background characters, typography, watermark, platform UI, photobashing grid or multi-view collage in a **single-image** input slot.

**Reference consistency:** If the chosen 3D generator explicitly supports multiple views, use aligned front / three-quarter / profile / rear references with identical costume, hair, lighting, framing and anatomy. If it supports just one image, provide **one clean image**—not a contact sheet pretending to be one view.

### 2. Validate, crop, and document the reference

```bash
python3 -m pip install Pillow
python3 scripts/check_reference.py path/to/front.png
```

Review alpha on both a light and dark checkerboard. Missing crown edges, detached fingers, cropped shoe tips, halos and leftover shadow/background pixels contaminate reconstruction. Check that no meaningful foreground touches image boundaries. Do not rely solely on algorithmic segmentation; inspect the image at 100% and 200% zoom.

Keep both source and transparent variants with distinct filenames. If the foreground is within 8px of the edge, add transparent canvas padding (e.g., 6–10% per side) without rescaling pixels, then check again; this is not proof the mask is clean. Store SHA-256 of the image actually sent to the service.

### 3. Choose the reconstruction route deliberately

| Route | Use when | Major limitations |
| --- | --- | --- |
| Single-image AI image-to-3D (first **pilot**) | Fast concept and silhouette feasibility | Invented side/back, face flattening, fused arms/dress, texture artifacts |
| Multiview-constrained 3D | Distinct viewpoints available and the tool **actually supports** multiview input | Input consistency and model capability must be verified; not free of topology problems |
| Blender/manual sculpt + retopo + UV/PBR | Identity/face quality, clean animation deformation, and professional editability matter | Human time and 3D skills required |
| Procedural geometry | Blockout, composition, props, or backup/fallback render | Good topology count does not guarantee character-like appearance |

**Budget control:** Use the user's chosen free tier where possible; verify current quotas, terms and commercial use **at the time of generation**. Do not launch a paid image-to-3D job without authorization if a free-only constraint is in effect. An example trial path used in this project was the official `microsoft/TRELLIS.2` Hugging Face Space with an initial moderate-resolution setting; this is *not* evidence of stable free access or of quality success. Settings and services change; inspect the current UI/schema instead of assuming the historic interface.

Record exact tool name, version/endpoint, input hash, seed (if offered), generation resolution, geometry/texture options, output link/license, execution date, and cost. If the service emits only a mesh without texture, a textured/rigged result is **not** implied.

### 4. First-pass 3D: maximize information, not polygon count

Run *one* economical baseline generation. Before investing in higher resolution or texture refinement, orbit 360° and check at least `front / 45° / 90° / 135° / back`. Zoom to face and hands. At this point geometry fidelity dominates texture sharpness.

**Immediate reject:** eyes become sockets or stuck-on balls in profile; nose/chin disappear sideways; back of head is a paper shell; hairstyle slices through cheeks/neck; hands fuse into skirt; major skirt panels tear or invert. Do not improve texture resolution to hide structural failure. Rework 2D references or choose manual/multiview reconstruction instead.

Always save an actual GLB and original generation output; screenshots alone are insufficient.

### 5. Technical audit and reproducible turntable

```bash
python3 scripts/inspect_glb.py path/to/character.glb
# Optional, requires Blender 4.x installed:
blender -b -P scripts/render_turntable_blender.py -- path/to/character.glb out/turntable
```

The inspector reports GLB header integrity, inventory, primitive types, estimated vertex/triangle counts, texture references, material count, skins, animations, morph targets, and likely web risks. Its `triangles_estimate` is based on draw primitives and is **not** a full Khronos spec validator nor a shape/identity quality score. For conformance, run [Khronos glTF-Validator](https://github.com/KhronosGroup/glTF-Validator) as a separate gate.

For camera-aligned renders, first confirm which horizontal direction the character faces; `render_turntable_blender.py` uses a default axis convention and allows changing the starting yaw. Label screenshots with actual view angles, not guessed anatomy direction. Inspect on dark and light lighting setups to reveal material defects.

### 6. Repair according to defect class

- **Face shape wrong from side:** fundamental geometry issue → generate stronger side reference or sculpt head manually, not just a prettier face texture.
- **Painted-on eyes and mouth:** inspect UV/geometry separation; sculpt proper eyelids, nose and lips, then repaint textures.
- **Hair merges into body:** simplify lock design, separate and retopologize major hair volumes, check 360° intersections.
- **Shredded cape/skirt:** remove ambiguous translucent edges in source, use explicitly layered fabric volume; repair normals/thickness if mesh is already sound.
- **Facial uncanny valley:** reduce oversized eyes, clarify nose/chin, avoid over-smoothed symmetry, tune highlights only after geometry is correct.
- **GLB valid but immobile:** lack of `skins`, morph targets, and/or animations is a **rigging/animation** issue; cannot be solved by a file rename. Rigid node transforms are a different, limited animation strategy.
- **Large/slow model:** perform retopology/decimation carefully, texture atlasing, PBR texture size tuning, scene-level LOD and profiling. Don't assume reducing bytes guarantees fewer draw calls.

Version the work: `refs/v03/`, `models/v03/`, `qa/v03/` with a concise comparison. Keep rejected models for analysis outside the published site, unless the user explicitly wants them shipped.

### 7. Quality gates: all must pass before promotion

Use `references/QUALITY_GATES.md`. Required categories:

1. **2D→3D fidelity:** identifiable silhouette and proportion from front, 45°, both sides, back.
2. **Face:** eye socket/lid volume, nasal projection, lip/chin/jaw, expression style stable around head.
3. **Parts:** no fused fingers, arms, hair, dress or detached floating crowns.
4. **Textures/PBR:** correct colors, skin/hair/fabric separation, no inverted normals or obvious seams.
5. **Technical:** valid glTF v2, connected assets, no unexpected external texture URLs, reasonable mesh counts.
6. **Animation (if requested):** actual skinning/morph/node channels present and deformation reviewed under intended poses.
7. **Runtime:** test iPhone Safari, Android Chrome, desktop browsers under real lighting/camera and network conditions.
8. **Licensing and privacy:** rights and attributions recorded; no private media or sensitive paths accidentally committed.

**Ship gate:** a human reviewer must mark visual criteria PASS with front / 45° / side / back renders and real-device screenshots where applicable. Tool-reported geometry statistics are not a substitute.

### 8. Integrate conservatively

Put model in a feature branch and preview-only route first. Use the application's base-path-aware asset loader. Do not replace a working public asset or alter GitHub Pages paths until review succeeds. Preserve current model as fallback. Avoid loading the entire character when the user cannot see it; implement explicit lazy loading and loading/error states. Measure actual model download, decode, draw calls and frame time on target devices.

**Review before merge:** document GLB SHA-256, input PNG SHA-256, source/model license, face multiview contact sheet, Khronos validator report, mobile/performance QA, and rollback commit. If a requested likeness fails a viewing angle, leave the existing website unchanged.

## When a new attempt fails

Return a diagnostic table with: defect, angle where observed, likely source (reference / geometry / texture / rig), smallest next experiment, and what the new run must prove. Propose at most one or two changes per iteration so the cause is interpretable. Never claim a future model is guaranteed better.

## Evidence discipline

The observed case in `references/CASE_STUDY_2026-11-16.md` is a **failed/not-approved 3D quality run**. Numbers are measured facts; improvement hypotheses are hypotheses. Mark steps **verified**, **performed but rejected**, **proposed**, or **blocked**. The workflow becomes production-proven only after a real candidate passes its full quality checklist.