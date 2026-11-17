# Live Christmas site feature parity and regression gate — 2026-11-17

## Hosting and release source
- Public domain: **https://tanchensiyi.com/**, via GitHub Pages branch `gh-pages`; never publish this site through ChatGPT Sites.
- Static compiled `gh-pages` bundles contain current interactive 3-cat scene, an extended photo memory-album stylesheet, Gemini V73 princess with kitten, and more changes than source `main`.
- **IMPORTANT: `main` is not yet a faithful production source for these features.** Never overwrite `gh-pages` from a plain build of `main` or the V73 branch. Reconcile all features into source and test build parity before any future wholesale build/deploy. The minimally invasive production patch below preserves the deployed files.

## Verified current production version
- Release commit: `6762bc2d98e112cb120cd006602b20b36cfac364` on `gh-pages`.
- New versioned entry: `assets/index-Explore-20261117-v2.js`, import map and script in `index.html` and `christmas/index.html`.
- Scene: `assets/TreeScene-Explore-20261117-v2.js`. App: `assets/App-Explore-20261117-v2.js`.
- Original model unchanged: `/princess/luma-princess-hug-v73.glb`; early lossless gzip `/princess/luma-princess-hug-v73.glb.gz`; original SHA `82850162e6363cf41fdcf660d7cf317d276bc99d4c6872824f51f939af5dc297`.
- The original `index.html` and `christmas/index.html` content was retained except for the new entry module's import map and URL. All cats, film, photos, album CSS, `CNAME`, `letter/index.html` and source media are unchanged.
- Browser interaction regression run: https://github.com/yil384/luma-web-lab/actions/runs/44179331038 — passed on desktop and mobile emulations: cat focus, physical dolly zoom, return overview, free mode, princess focus, V73+kitten loaded, zero browser exceptions.
- Additional live production regression: https://github.com/yil384/luma-web-lab/actions/workflows/qa-christmas-production.yml (checks all 95-photo records, sample thumbnails/full images, film dialog and fixed routes).

## User-facing controls
- **🐈 看小猫**: camera moves to small cat close-up, wheel zoom, touch pinch, orbit drag; tapping a ground cat also triggers focus and its existing action.
- **👑 看公主**: close-up view of V73 and the cradled cream kitten.
- **🧭 自由探索**: unlocks 360° horizontal orbit, vertical tilt, mouse right-drag pan, wheel dolly, touch two-finger pan and pinch.
- **↩ 回全景**: resets full Christmas tree view and resumes calm camera orbit.
- Original photo picking, film and secret interactions remain in the existing React App.

## Checklist for any next release

| Feature | Automated check | Remaining human QA |
|---|---|---|
| Christmas root and /christmas/ | 200 + scene UI | iOS Safari and Android device |
| /letter/ castle/confession | HTTP + title | complete sequence and video playback |
| 3 cats | existing bundled rig untouched, V73 + cats inspected | all cats visible and touch gestures |
| V73 princess and cradled cat | GLB 200, `data-princess-v73=ready`, browser checks | actual visual positioning and lighting |
| Close-up cats and princess | browser click + camera distance check | comfortable composition on phones |
| Free orbit/pan/dolly/pinch | button/mode and wheel checks | multi-touch on Safari, camera orbit around background |
| Return overview and auto orbit | mode and distance checks | check after 10–20 seconds |
| 95 photos | manifest count + thumbnail & source HTTP 200 | open full album and browse |
| Film | poster HTTP + film dialog browser test | real play/seek audio on mobile |
| Main site identity and access | no CNAME/asset removal | Mainland-China access requires local network test |

### Rollback
Previous Pages commit: `1c59414ce424149a5860e00d5536c87dc8da55c6`.
Previous home HTML Git blob: `a113c089ff3700aa68cb24261eec18baa85399cc`.
Previous Christmas HTML Git blob: `75d5cff9c0b7b015300c3e887e8ecda5d45e4e47`.
If anything regresses, fast-forward a new `gh-pages` commit restoring only those two HTML blobs. Do not force-push or remove media.

## Caveat
Passing Playwright in simulated mobile viewports does not mean real device behavior has been verified, especially WebGL GPU drivers, long-touch/photo picking, pinch and mainland-China network paths. Record those as remaining QA, rather than claiming 100% tested.
