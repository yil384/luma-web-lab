# Modeling-friendly 2D prompts

## Base reference
> Original high-detail storybook-inspired stylized 3D character, full-body neutral relaxed A-pose, single person centered, straight-on near-orthographic studio camera, shoes and hands fully visible and separated from garments. Warm approachable face, moderately sized eyes with clear lids, dimensional bridge and nose tip, defined lips/chin/jaw, soft rounded cheeks, coherent skull depth. Hair grouped into large sculptable locks with clean front and back silhouettes. Clothing built of clearly separate opaque material layers with thickness. Even neutral lighting, simple transparent or studio background. No foreshortening, text, watermark, character collage, other people, UI or props. Designed for 3D reconstruction rather than one-angle illustration.

## Original princess variant
> Rose-pink and ivory layered formal dress, small jewel tiara, warm chestnut-brown waves, pearl earrings. Keep shoulders, elbows, fingers, hair, and skirt layers physically separated. No copying named animated characters.

## Avoid
- Overly large glossy eyes and almost invisible nose/mouth.
- Excessive transparent fabric or hair flyaway geometry.
- Cropped crown, sleeves, hands or shoes.
- Beauty lighting that conceals cheek and nose structure.
- Multiview collage fed into a generator with only a single-view input.

If and only if the tool supports distinct multiview inputs, keep front, 45°, profile and back views consistent in face, body, hair, clothes, scale and camera. Check alpha on white/black/checkerboard before submission.