# Case study: rose-dress princess GLB exploration (2026-11-16)

## Provenance and scope

An original stylized princess with a rose-pink/ivory dress, chestnut-brown wavy hair, small tiara, and pearl earrings was being prototyped for a WebGL scene. This file records *technical observations and aesthetic rejection*, not a production-ready character recipe. Personal names, unrelated website media, and private photographs are intentionally excluded from the Skill.

### Experiments already performed

1. **Procedural 3D studies:** Multiple GLBs were generated with geometry scripts and examined from several angles. A sample technical prototype was approximately 13.58 MB with 16 material/mesh groups, ~258,172 vertices, ~510,453 triangles, true volumetric geometry and baked face texture, but **failed multiview/face approval**. It had **no facial rig**. This proves the export/preview workflow, not high-fidelity reconstruction.
2. **First image-to-3D reference tests:** A previously supplied generated `.glb` exported as a valid glTF 2.0 binary but had poor facial geometry when viewed from the side and oblique angles. Statistics did not predict aesthetic quality.
3. **Most recent rejected downloaded candidate:** `.glb` size **11,808,948 bytes (~11.26 MiB)**, **1 mesh**, **1 material**, **2 textures**, **219,256 estimated vertices**, **289,514 triangles**, **0 skins**, **0 animations**. These counts were read from the GLB's JSON accessors and header. This is a **static mesh**, not a rigged performance-ready character. Assessment: **rejected for facial/multiview quality**.
4. **Reworked image source:** A newer full-body pink-and-ivory character reference was prepared. The 1086×1448 original had only 2px top and 3px bottom foreground margin; padding the transparent canvas to 1260×1680 provided 118px/119px top/bottom margin and passed automated crop checks. This verifies framing only, NOT 3D quality. **No generated GLB for the latest padded image has yet passed any 3D QA**.

## Defect → likely mechanism → smallest next test

| Defect | Diagnosis | Experiment |
| --- | --- | --- |
| Front cute, 45° face uncanny | 2D face detail does not impose 3D cheek/eye structure | Compare 45° and side reference; multiview-conditioned tool or manual head sculpt |
| Painted-on mouth/nose | Surface texture substituted for sculptural volume | Inspect side silhouette and actual normals; rebuild face if geometry insufficient |
| Huge eyes or flat face | Reference stylization ambiguous in depth | Moderately scale eye features; define eyelids, nose bridge, lips and jaw before generation |
| Curled hair passes through face | Numerous thin strands and ambiguous boundaries | Consolidate hair into large locks; separate from cheek/neck silhouette |
| Fabric shells tear or intersect | Transparent layered material unsuitable for single-view inference | Use opaque structural garment layers and simpler massing |
| GLB exports but cannot blink/wave | Zero skins/animations (possibly no morph targets) | Rig and animate; do not assume more polygons will fix motion |
| High polygon count, poor likeness | Detail density added before anatomy | Reject high-detail run, fix reference/multiview/shape first |

## Next evidence needed

- Reconstruct using **the latest reference**, recording model/version/price/seed. Do not claim this has happened merely because the image was generated.
- Capture front, left/right 45°, both 90° profiles, rear 180°, head/hand detail under neutral light.
- Run `inspect_glb.py`, Khronos validator, and real phone/browser performance checks.
- Record which hypothesis worked, and only then update the Skill from **experimental v0.1** to **verified end-to-end**.

## Anti-overclaiming

- “GLB opens” = container/parser works, **not** a good face or mesh.
- “Full volumetric 3D” ≠ good anatomy, riggable topology or likeness.
- “No skeleton” ≠ absolutely no possible animation; transforms can still animate parts. It **does** rule out built-in skin-based deformation until rigging is added.
- “Saved a more attractive PNG” ≠ regenerated a good GLB.
- “Character is original” ≠ permission to republish private reference photographs or third-party resources.