# V77 skeletal princess and scene interaction release

The live site is served from this repository's `gh-pages` branch at
<https://tanchensiyi.com/>. This release applies a focused change to the reviewed
production tree. It does not publish a full build from the older `main` or Sites source.

## Character behavior

- V76's original face, hair, dress, eye meshes, textures and UV data are retained.
- The independent arm mesh now has real shoulder, elbow and wrist skinning on
  both sides. Petting moves the left arm while the right arm supports the kitten.
- Four real eyelid joints drive new fitted upper/lower lid surfaces; the iris is
  covered by skin during a blink. The static face mesh is not scaled or swapped.
- The held cream kitten owns an independent skeleton and a calibrated rest pose.
- A single scene clock drives the princess, held kitten and three ground cats.
  Ground cat overlays preserve native walking, leg IK and social-play ownership.
- Clicking the princess triggers an implemented arm action and kitten response.
  Clicking the held kitten produces its own response and a small wrist/blink
  response from the princess. Ground clicks keep the existing focus behavior.
- Visibility, dialogs, scene pauses, camera dragging and reduced motion are
  connected to the actual scene lifecycle. No separate animation loop is added.

## Reproducible build and publication

1. Build `public/princess/luma-princess-rigged-v77.glb` from the committed V76
   asset with `python tools/princess-rig/build_v77.py` (NumPy 2.3.5, SciPy 1.17.0).
2. Run the rig and runtime tests, and the release tests with
   `LUMA_PAGES_BASELINE` pointing to a checkout of the live `gh-pages` tree.
3. Run `node scripts/build-princess-v77-release.mjs /absolute/pages/tree`.
   The builder rejects a changed production App, scene or entrypoint mapping.
4. The staging workflow runs actual desktop and mobile Chromium against that
   complete tree, including bone motion, clicks, film pause/resume and reduced
   motion. A failed browser check prevents creation of a release candidate.
5. The successful candidate is recorded in a separate `release/princess-v77-*`
   branch. Production publication uses a fresh `gh-pages` head and a checked
   ref update, carrying across only the declared V77 paths.

Only `index.html`, `christmas/index.html` and these new paths belong to the release:

- `assets/TreeScene-PrincessRig-V77.js`
- `assets/princess-kitten-v77/` (five runtime modules)
- `princess/luma-princess-rigged-v77.glb` and its gzip copy
- `v77-release-status.json`

The existing App, album, film, photos, ground-cat assets, `/letter/`, domains and
other static content remain byte-for-byte unchanged. Periodic live-room data
updates are retained when rebasing the small release onto a newer Pages head.

## Evidence and limits

The source tests use real Three.js bones, skeletons and skinned vertices. They
check rest-pose preservation, independent arms and eyelids, repeatable updates,
the kitten's separate skeleton, native ground-cat control, interruption recovery
and lossless release output. Blender CPU renders check open, partial and closed
eyes and arm poses from frontal and angled views.

The staging workflow stores its browser report, screenshots and exact candidate
commit in the **V77-skeletal-scene-evidence** artifact. The production release
marker records the model and scene hashes and the pre-release entrypoint hashes.

Software-rendered desktop/mobile Chromium and static renders do not constitute
a physical iPhone, Safari, mainland-network or sustained mobile-performance test.
The inherited V76 sleeve/arm seams and eye-socket shape are preserved model
details, not a claim that the entire character was remodeled or fully body-rigged.

## Rollback

Create a new fast-forward commit on the latest `gh-pages` restoring only
`index.html` and `christmas/index.html` from the production commit immediately
before V77. The original V73 Scene and model remain available. Keep unrelated
live-room snapshots and all other assets; do not reset or force-push the branch.
