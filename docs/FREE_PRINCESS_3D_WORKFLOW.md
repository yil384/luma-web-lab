# Free 3D Princess Model Pipeline (ZeroGPU → GLB → QA → Three.js)

**Status:** workflow prepared; official ZeroGPU GPU generation must still be run. Do not claim a new movie-quality model has been generated or deployed.

The goal is a genuinely attractive original adult fantasy princess that holds up in front, three-quarter, profile, and back views, with usable PBR material. The existing geometric placeholder is not the visual bar. Replacing it with a 2D plane, camera-facing portrait, or a front-only sticker does not pass.

## Recommended free model

- [Microsoft TRELLIS.2 official Hugging Face Space](https://huggingface.co/spaces/microsoft/TRELLIS.2): currently offers ZeroGPU interactive image → 3D and **Extract GLB**. The public model repository is MIT licensed.
- [Hunyuan3D-2.1 official Space](https://huggingface.co/spaces/tencent/Hunyuan3D-2.1): secondary option; its Tencent community license is more restrictive, so review permitted uses before using the output.
- Both shared-GPU services may have sign-in, queues, changing quotas or temporary downtime. This workflow must never assume a successful GLB merely because a browser form rendered.

**Do not run TRELLIS.2 on a 16GB M1 Mac as though it were the NVIDIA GPU model host.** Its local inference path requires a Linux CUDA machine with a large GPU; the free hosted Space does the heavy compute.

## Input preparation

Use a front-facing **full-body** original character design with arms separated slightly from the skirt, both feet visible, no other characters or props, and ideally a transparent background. Keep a high-resolution copy of the original art direction to compare with the 3D output later. Never upload a private human reference photo to an external generation service without authorisation.

## Free, browser-based steps

1. Visit the official TRELLIS.2 Space. A free Hugging Face account may be needed.
2. Upload the **transparent PNG** from the local character lookdev kit.
3. Start at resolution **512** to test silhouette and queue behavior; when the available free quota allows, rerun at **1024** for improved geometry and PBR materials. Leave advanced diffusion sliders at their current defaults first.
4. Click **Generate**. Inspect the generated preview at the available angles.
5. Click **Extract GLB**, then **Download GLB**. A preview image is *not* a GLB.
6. Run the dependency-free validator:

   ```bash
   python3 scripts/validate_generated_princess_glb.py ~/Downloads/generated-princess.glb
   ```

7. Open the downloaded GLB in a real 360° viewer; inspect face, hair thickness, sleeves, hands, dress folds, backside, and whether the foreground is a true volume.
8. Only if it passes visual quality review, copy the asset to `public/princess/luma-princess-hd-study-v2.glb` on this feature branch. The `PrincessAsset.tsx` loader now normalizes imported models to the tree scene's floor and scale and retains a controlled non-rigged tap response. It cannot invent natural facial animation or a functional arm skeleton.
9. Build and test the source branch. Publish an isolated preview first. Do **not** replace `gh-pages` or overwrite the currently deployed site or domain without separate acceptance of the generated result.

## Acceptance gate

- **No uncanny face:** clearly modeled jaw/nose/eyelids, both cheeks consistent at 45°/90°, no photographic patch boundary.
- **No hair tubes:** coherent primary hair volume and secondary strands when rotated.
- **Real skirt depth:** layers are separated physically; seams, hem, sleeves and rear silhouette must survive a 180° check.
- **No silently broken routes:** Christmas home and `/christmas/` and `/letter/` still load, as do the photo album and HLS video.
- **Phone rendering:** check GLB network size, PBR textures, triangle count, loading and interaction on an actual phone.
- **Rig honesty:** if a GLB has no skeleton/morph targets, do not label a whole-body tilt as a full waving/blinking animation. Keep it a placeholder gesture until rigged.
- **Asset rights:** model-code license does not automatically grant rights to all third-party source images or textures.

## Fallback

If ZeroGPU quota blocks generation, do not spend money automatically or silently switch to a paid provider. The source branch can keep its existing technical model and the accepted 2D design reference. Resume from the actual GLB asset when free capacity is available.

The existing PR remains a **Draft** until a 3D model passes this QA. Passing TypeScript, Vite and unit tests is necessary but not sufficient.
