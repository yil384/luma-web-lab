# Cute Princess Modeling Input — v2

**Status:** approved modeling direction, source-image preparation complete; a new 3D reconstruction has **not** been generated or accepted yet.

## Why the previous asset was rejected

The previously tested single-image GLB produced an uncanny face, implausible side profile, spiky/disconnected back features, stiff hair and broken skirt geometry. The issue was inaccurate inferred geometry, **not simply low triangle count or lighting**. Do not use that GLB as the public princess.

## Simplified authoring target

We created a new original **adult storybook princess**, presented as a single front-facing, full-body figure on a neutral studio background. Its production target reduces the ambiguity that caused the failure:

- Gentle rounded cheeks, natural warm expression, moderately enlarged brown eyes, small nose and smile.
- **One continuous crown of large chestnut curls** rather than hundreds of isolated strand ribbons.
- A simple ivory satin bodice, blush-pink skirt panels and a waist ribbon; retain the silhouette before adding optional lace.
- Arms separated from the skirt; hands and shoes visibly uncropped.
- One character, one pose, no scenery, no companion cat, no title, no multiple viewpoints in the same generation input.
- **Transparent-background full-body PNG** is the preferred input for image-to-3D. If the Space handles alpha incorrectly, retry with the matching studio-background PNG.

The generated reference images are retained in the conversation's download bundle, not committed to the source repository by this text-only update. Do not mistake this document for a model upload.

## Free generation and review

Use the [official Microsoft TRELLIS.2 Space](https://huggingface.co/spaces/microsoft/TRELLIS.2) with the alpha-masked **front-only** input. Start with 512 resolution and default diffusion parameters; inspect the output before using higher quota. Export an actual GLB only if the preview is not clearly damaged. The Space's documented controls are *Generate → Extract GLB → Download GLB*.

Do not mix an expression sheet, multiple-view collage or reference poster into the single-image model input. Multi-view concept art may guide human review but does not guarantee 3D identity consistency.

When GLB is available, run `python3 scripts/validate_generated_princess_glb.py path/to/generated.glb` and inspect the actual geometry at 0°/45°/90°/180° with textured and clay shading. Reject if the face, hair, sleeves or back silhouette fail. A successful GLB validation or CI run alone is insufficient.

Do not merge this branch or override `gh-pages` until the 3D model passes visual review and a real-phone test. Preserve the existing cat, photo gallery, cinematic page and static routes.

## Known limitations

One RGB image cannot directly establish unseen geometry, especially behind hair and multi-layer skirts. Free hosted GPU capacity may queue or be unavailable. The reference artwork is a **design input**, not a claim of a cinema-quality model. Do not spend money automatically or suggest that a generated lookdev PNG is already a skinned character asset.
