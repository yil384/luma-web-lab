> **ART-DIRECTION REJECTION — 2026-11-16 (supersedes earlier V41 visual optimism).**
>
> After re-review of the actual 45-degree renders side by side, **V41 fails visual acceptance and looks worse than V24**. The eyes flatten into narrow slits; the jaw and cheek mass widen, creating a stretched mask-like silhouette; nose/lips remain unaligned with their albedo detail; the chin-to-neck connection creates hard geometric and color transitions. The previous conclusion that V41 was a balanced best candidate is **withdrawn**. Additional mesh detail, manifold geometry, and matching SHA-256 do not prove aesthetic improvement.
>
> **Disposition:** V41 is a **failed experiment**, not the active model, not a release candidate, and must not be imported into `public/princess/` or merged into `main`. For visual comparison, V24 remains the less distorted prior prototype; even V24 is not approved for production. The proper next fix requires an artist-quality face topology/UV rebuild with 0°/30°/45°/60°/90° parity, rather than more flattened portrait projection or whole-head ellipsoid edits. Keep the existing production site unchanged.

---

# Princess GLB: 45-degree face-repair V41 (November 16, 2026)

**Draft study, NOT production approval, and NOT deployed.** The actual V41 GLB is delivered separately, not committed to this GitHub branch.

## What was wrong

V22–V24 used a volumetric PCHIP head with a pretty frontal portrait projected on its UV atlas. At 45°, eye/brow/mouth detail lacked corresponding local geometry: the face looked glued onto a shell. Changing texture resolution cannot repair this. The user's TRELLIS.2 free quota was exhausted; no new paid reconstruction was submitted.

## Real repairs and failure experiments

- Retained the user's original tiara, hair, gown, hands and shoes. Removed **3,503** broken facial fragments; built a watertight continuous head, jaw and neck.
- Localized nose, cheek, eyelid, lip and chin relief; used **high-frequency shape differences only** from the MediaPipe canonical 468 facial landmarks (Apache-2.0), preventing the unrelated canonical face's identity/age from replacing the fantasy character. Smoothed and feathered the albedo atlas at the lateral cheeks.
- V25's bigger ellipsoid looked like a mask; V26's wholesale normal recomputation created dark horizontal stripes; V27–28's separate floating eyeballs were bug-eyed; V29–30 overblurred facial pigment; V31's whole canonical face was harsh and too mature. V38 ear blobs and V39 neck extension did not fix the key issue; V40 eye/lip shadow gradients were too sharp. **V41** toned the actual 3D folds down.
- Attempted a mobile LOD. Decimation lost original art-directed normals and created horrible shading bands; transferring the normals back still damaged hair and could enlarge the GLB. **Rejected, not offered as a shipping LOD**.

## V41 checked facts

| Item | V41 |
| --- | --- |
| GLB size | 13,029,036 bytes |
| SHA-256 | `99113af42e0b1055567a752fc369c4c7c874435601d5c1649c49b4d44245b4cc` |
| Mesh primitives / triangles | 2 / 348,712 |
| Original retained triangles / rebuilt head triangles | 285,000 / 63,712 |
| Embedded WebP textures | 3, no external references |
| Skins / animations / morph targets | 0 / 0 / 0 |
| New head watertight | Yes; entire original/hair/dress composite is *not* globally watertight |
| CPU-rendered angles | 0°, 30°, **45°**, 60°, 90°, 180°, plus clay inspection |
| Reproducible export | Reran the source: same SHA-256 |
| Real browser WebGL / iPhone Safari | **Not tested** |
| Film-grade visual acceptance | **NOT passed** |

Despite improved 45-degree 3D relief, the iris/eyelash details still rely mostly on color texturing rather than properly retopologized independent eyeballs and eyelid loops. The head/neck junction and stylized low-poly hair also still need artistic cleanup. Structural and clay checks do **not** prove cinematic quality.

The complete reproducible source kit and `stylized-character-glb-skill-v0.3.zip` were delivered to the user separately, including original asset, modified landmark array, source attribution, V41 GLB, 45° before-after review, clay view, scripts, and JSON QA. MediaPipe canonical data credit: https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj, Apache 2.0.

**Release boundary:** PR #2 stays Draft. Do not replace `gh-pages`, published domain, album, movie, cat or `/letter/` and `/christmas/`. The `VITE_PRINCESS_GLB_APPROVED=true` build flag is a technical preview gate, not a human aesthetic approval. A real-browser Three.js/WebGL and physical-device QA plus user acceptance are required before any deployment.
