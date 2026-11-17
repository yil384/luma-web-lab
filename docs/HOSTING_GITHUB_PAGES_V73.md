# V73 Princess + Cradled Kitten — GitHub Pages production record

**2026-11-17.** Actual live hosting for `tanchensiyi.com` is GitHub Pages from `gh-pages`, **not ChatGPT Sites**.

## User-requested changes
- No old-princess-to-new-princess flashing at initial GLB load.
- New Gemini V72 character visually cradles a small kitten.
- Princess bright enough to match tree and existing companions.
- Do not break original film, photo album, Christmas homepage, three ground cats, or fixed `/letter/` route.

## Implemented / what is not implemented
1. **V73 asset:** immutable V72 eye/face/texture/UV buffers retained. Only original skin-colored forearm POSITION and NORMAL vertices were moved toward an inward supporting pose in `scripts/pose-princess-v73.py`. Exact V72 is left untouched for rollback. No new character face generated.
2. **Actually modeled held kitten:** added a second instance of the existing scene's rigged **cream chonky cat** to the V73 character at the waist/lap, with an embroidered pink fabric cradle. The three original cats remain on the ground; there are now four cat instances (three ground, one held).
3. **Atomic reveal:** Promise-all-settled of V73 GLB and kitten rig; renders **no old/procedural princess while loading**, so there is no model-morph flash. The old procedural princess remains as error fallback only when GLB load fails.
4. **Character-local fill lights:** three local point lights (warm key, cool fill and warm rim) around princess. They do not globally raise the whole tree's exposure.
5. **Cache-safe production entry:** added `assets/index-GeminiV73-live.js` and used an import map in `index.html` and `christmas/index.html` to route bundled imports of `assets/index-CJX_PAH8.js` to the same immutable V73 runtime module. This prevents stale root module caching and avoids double-executing React. `/letter/` uses the old, unchanged entrypoint.

## Exact model/release
- V72 source model SHA-256 `9bbf7c0ed5da9b7372906a30b665f0e118a3a66c3122e1499ea8dc4ecd454cbf`
- V73 pose GLB SHA-256 `82850162e6363cf41fdcf660d7cf317d276bc99d4c6872824f51f939af5dc297`
- V73 binary file size: 15,329,160 bytes; Git blob SHA `8cd7438f18deb4ae3237df21cd4684bbfd80cfc0`
- V73 model: `gh-pages/princess/luma-princess-hug-v73.glb`
- New Pages runtime `assets/App-GeminiV73.js` + `assets/TreeScene-GeminiV73.js`
- Production `gh-pages` commit: `8e32f6acada49143f7647fa75904298547a26a7c`
- Previous working `gh-pages` commit: `400e7474479437498bd05e30f3aac27a78169beb`
- Rollback home HTML blob SHA: `577ebefccf6dd77b47780d1919c39075617aadc3`
- Rollback Christmas HTML blob SHA: `5ea93dd939bb408f28e50569b5de3f0ba7ba5722`
- New release marker: https://tanchensiyi.com/v73-release-status.json

## QA
- V73 arm-pose GLB: actual VTK front/45°/90°/rear rendered and visually checked for arms moving inward; face/eye/dress texture bytes unchanged.
- GitHub Actions generated the V73 GLB and checked the original V72 SHA.
- In live previews, V73 GLB and cream-kitten GLB returned HTTP **200** in actual headless desktop and mobile Chromium; V73 and held-kitten diagnostic states were both `ready`, canvas present, no JS runtime error captured.
- Versioned-entry preview did not create duplicate root/React app (checked in live browser).
- Browser screenshots could not be captured in the cloud GPU environment; a separate TinyFish browser had WebGL unsupported fallback even though asset loading succeeded. **These are test environment limits, not proof of perfect visual art direction.**
- **Not tested on physical iPhone/Android** or from mainland China. User visual confirmation is still needed, especially kitten-to-hands alignment and skin brightness.

## Safety and rollback
- `gh-pages` old film, cat, photo, album CSS, letter page, icons and original JS assets are preserved.
- **Rollback:** create a new fast-forward commit on current `gh-pages`, replacing only `index.html` and `christmas/index.html` with the two old blob SHAs above (and optionally marking V73 status as rolled back). No DNS, media, movie, page deletion or ChatGPT Sites operation required.
- Do not merge source feature branch wholesale to Pages: the actual live compiled tree has a separately evolved three-cat/album implementation. Reconcile future source improvements before a full rebuild.
- This V73 is a **static arm pose + independently rigged kitten at the waist**. It is *not* a human armature/bone-rig animation, nor is there natural blinking/waving. It should not be marketed as a true fully rigged princess.

## Production browser confirmation 44164476307

- **Successful real Chromium QA run**: https://github.com/yil384/luma-web-lab/actions/runs/44164476307
- Desktop home `/`: HTTP 200, one WebGL canvas, `princess=ready`, `kitten=ready`, no 3D fallback, V73 GLB HTTP 200, cat rig HTTP 200, no JavaScript console errors.
- Mobile emulation `/christmas/` (390 × 844): same successful checks and a captured PNG of the real rendered page. Artifact name `V73-WebGL-preview-evidence` (this workflow's historical name).
- The mobile screenshot visibly contains the princess, a cream kitten near her hands/waist, and the original scene. Because it is small-screen it does not prove precise 3D hand-to-fur contact, and it is not a physical iPhone/Safari performance test.
- Desktop screenshot capture still timed out in CI's continuous WebGL readback; the actual runtime checks passed. Do not interpret an optional screenshot failure as a model load failure.
- Site's published V73 marker: https://tanchensiyi.com/v73-release-status.json
- All preexisting production media, letter route, album CSS and three ground cats preserved; rollback blobs remain listed below.

