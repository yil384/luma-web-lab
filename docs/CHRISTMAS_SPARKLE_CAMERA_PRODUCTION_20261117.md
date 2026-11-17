# Production camera and fireworks release — 2026-11-17

**Hosting:** GitHub Pages `gh-pages` (NOT ChatGPT Sites). Public domain: https://tanchensiyi.com/

## Current deployment
- Pages release commit: `60b15a73aff8618036acf18ddd35a2579b825b38`
- Build/deploy run: https://github.com/yil384/luma-web-lab/actions/runs/44195377870 — success
- Production entry: `assets/index-SparkleCamera-20261117-v2.js` referenced by `index.html` and `christmas/index.html`.
- `assets/App-SparkleCamera-20261117-v2.js` and `assets/TreeScene-SparkleCamera-20261117-v2.js` preserve the live app, V73 princess/kitten, three cats, existing album/film and all media.
- The published marker `/sparkle-release-status.json` has been fetched publicly.

## Corrections
1. **Camera zoom out:** previous `maxDistance=165` allowed the tree and characters to shrink to specks. The new maximum is no greater than `Math.min(85, framing.defaultDistance*1.015)`: ~53.12 desktop / ~75.98 mobile simulated. Initial framing moves slightly closer (94% desktop and 91% mobile of prior distance). Closest distance ~2.35; zoom-to-cursor (wheel and two-finger touch centroid) remains.
2. **Single-tap rotation:** prior scene set an interaction lock which survived the tap toggle, so the UI said playing while the camera stayed still. V2 emits an explicit `luma-camera-resume` event after a blank-area tap, clears the manual camera lock and allows automatic rotation again. Blank tap pauses / next tap resumes. After manual drag/zoom while still playing, a tap resumes orbit directly.
3. **Fireworks:** 8 phase-staggered color-varied bursts (gold/pink/blue/lavender/ivory/mint/peach), larger sparkling shader points and trails; one draw call, ~1,840 particle points desktop and ~901 compact. Reduced motion and paused mode remain respected.

## QA
- The fast V2 real Chromium tap test, https://github.com/yil384/luma-web-lab/actions/runs/44195021222, passed. It recorded a camera movement of `0.25` scene units after unpausing. This checks *actual camera motion*, not just the state label.
- The initial V1 tap test failed (rotation label changed, camera remained fixed), and was corrected before deploying V2. Initial preview smoke separately confirmed 8 fireworks groups, zoom caps, V73 loaded and browser without JS errors; do not claim the initial broader run passed end-to-end.
- GitHub Pages production deployment succeeded; newly published metadata URL and entry file refs were verified. The `gh-pages` tree diff to preceding commit changes **only** `index.html`, `christmas/index.html` and the new status marker. No media was removed.
- Physical iOS Safari, low-end Android performance, and China-mainland network access still require user-side testing.

## Rollback
Previous Pages commit: `6bac0bb03646a790c4b265c484415f7a56a4da31`.
Old root index blob: `4ecf3d93628150e0ae502fa0f6d8fc0d3c1e8761`.
Old Christmas index blob: `725c8fc0377166e8ab9d4436d2147a20b3ba3d90`.
If necessary, create a **new fast-forward** `gh-pages` commit restoring only those two HTML blobs. Do not delete GLBs, media, letter, photos or cat assets.

## Release discipline
`main` source and live `gh-pages` compiled scene are still not fully in sync. Never rebuild and overwrite `gh-pages` directly from stale `main` without reconciling the live three-cat, V73, album, camera and fireworks features. Keep a real browser test covering actual camera movement for every later camera release.
