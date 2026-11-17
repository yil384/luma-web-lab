# Princess Character — Cute Cinematic Art Direction (v2)

**Status: approved art direction target; high-fidelity 3D reconstruction is not yet complete.**

The earlier procedural mesh was technically three-dimensional but visually read as a mannequin: small/flat eyes, overly angular features, hair built from visible cylinders, spherical sleeve caps, and a repetitive conical skirt. Increasing its polygon count alone does not fix these shortcomings.

## Silhouette and personality

- **Original adult fantasy character**, not a recreation of an actor or an existing animated-film IP.
- Soft, approachable, quietly joyful; mischievous energy comes through eye direction and very small expression changes, not exaggerated head-bobbing.
- Approximately five to five-and-a-half heads tall in the final stylized design. A soft oval cheek shape, slightly rounded jaw, smaller nose and subtle smiling lips.
- Hair: glossy chestnut curls framing, not hiding, the face; distributed strand cards/clumps with meaningful broad shapes and consistent silhouette at 0°, 45°, 90° and 180°.
- Crown: slim champagne-gold setting, pearls and one pink jewel; deliberately subordinate to the eyes.
- Clothing: layered champagne-ivory and pastel-blush ball gown, realistic puff sleeves, delicate satin ribbons, distinct translucent lace overlays and embroidered hem details. Volume must come from actual cloth geometry and baked normals rather than repeated spheres.

## Modeling approach

1. Lock **one front orthographic**, a side and back design with matching expression and proportions.
2. Build a sculpted head mesh with properly positioned eye sockets, eyelids, brows, lips and nose. Sculpt side profile and jaw; a projected frontal photograph is insufficient.
3. Model large hair masses, then hero curls and fine cards. Bake detailed strand normals and highlights into maps.
4. Create fabric geometry from controlled skirt folds and layered panels; use PBR maps (base color, roughness, normal, selective alpha), not painted vertical stripes.
5. Retopologize face/shoulder/elbow/hand deformation loops, assign a skinned skeleton, and author idle, blink, gaze, delighted smile, head-turn and wave clips.
6. Export GLB with embedded or reliable local textures. Prepare a separate reduced-triangle mobile LOD and test on a real phone.

## Acceptance requirements

- **Front:** face is charming at 250px display height; symmetrical eyes, natural small nose, smile without a visible “sticker” texture seam; original visual character matches the approved concept.
- **Oblique and side:** chin/nose/cheek have true volumetric contours; hair and earrings do not intersect head and shoulders; no floating face shell.
- **Back:** realistic curl volume and gown rear layers, no mirrored front-image patches.
- **Interaction:** tap gives an expressive but restrained wave; eyes blink naturally; reduced-motion and background/paused states remain functional.
- **Integration:** Christmas tree, cat companion, gallery, film and separate narrative routes remain unchanged.
- **Performance:** provide a phone-tested LOD, compressed geometry/textures, predictable draw calls, bounded VRAM usage and a runtime fallback.

## Prototype review (2026-11-16)

A fully 3D GLB prototype with a curved baked portrait texture was generated and rendered at five azimuths (front/45/90/135/back). The portrait improves the frontal expression relative to the earlier rod-and-sphere facial mesh, **but the model still fails cinematic acceptance**: visible forehead/jaw texture seams, chunky hair, simplified sleeves, unconvincing dress detail and no true facial rig. It is a technical fallback, not an approved character.

The local prototype is preserved in the delivery archive rather than silently replacing the website's live character.

## Publishing gate

Do **not** merge, copy a model to `gh-pages`, or claim 1:1 cinematic parity on the strength of CI, a single static concept image or a front-only textured 3D shell. Film-grade appearance must be verified in actual 3D turntable renders and on the target phone before a production swap.
