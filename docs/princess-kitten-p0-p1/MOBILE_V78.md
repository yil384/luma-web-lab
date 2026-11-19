# V78 mobile gesture optimization

V78 is published at [tanchensiyi.com](https://tanchensiyi.com/?v=78). It reduces mobile picking and rendering costs, preserves the V77 arm/eyelid interactions and production content, and prevents delayed movement from being mistaken for a hold. The exact published files passed the browser checks below.

## Confirmed sources of unnecessary work

- **Expensive character picking.** Mobile hover handlers kept the 336,832-triangle character and the photo instanced mesh in R3F's `pointermove` hit-testing path during camera gestures. See the [asset audit](evidence/reports/mobile-v78-asset-audit.json) and [raycast benchmark](../../scripts/benchmark-princess-raycast.mjs).
- **Render pixel and antialiasing cost.** The previous mobile renderer allowed DPR 1.65 and requested MSAA. Pixel work scales with DPR squared, so a high device DPR could keep a large drawing buffer active throughout a gesture. Mobile bloom was already disabled; V78 retains that behavior.
- **Repeated frame work.** Character overlays refreshed matrices and skeletons before the renderer refreshed them again. Periodic actor snapshot serialization and camera diagnostic DOM writes also ran for normal visitors. See [runtime.mjs](../../src/scene/princess-kitten/runtime.mjs) and [princess-rig.mjs](../../src/scene/princess-kitten/princess-rig.mjs).
- **Lost touch contacts.** Cancelling a stage press after a character claimed it also forgot fingers still touching the screen. A second finger could become a new long press, opening Share during a slow pinch.
- **A hold action overtaking queued movement.** The [native-event reproduction](evidence/reports/mobile-v78-stale-drag-reproduction.json) recorded down/move event timestamps only about 0.4 ms apart, but software rendering delayed delivery of the move by about 3 seconds. The 650 ms hold action opened the album first. This trace establishes the event-order problem; it does not by itself establish when the timer callback ran. A later run confirmed that rejecting late timers alone was insufficient.

## Released behavior

### Picking and native input

[production-component.inc.js](../../src/scene/princess-kitten/production-component.inc.js) uses five invisible box proxies: three for the princess and two for the held kitten, totaling 60 picking triangles. Visual meshes skip raycasting. The actors retain separate click targets; hover handlers are omitted on touch screens.

Native OrbitControls, camera limits, and photo press recognition remain in use; manual input avoids a duplicate `controls.update()`. [scene-gestures.ts](../../src/lib/scene-gestures.ts) and [useSecretInteractions.ts](../../src/hooks/useSecretInteractions.ts) expose `cancelIntent`, cancelling tap/hold intent while retaining live touch contacts. The [release builder](../../scripts/build-mobile-v78-release.mjs) also patches the actual production App bundle.

A lightweight native `pointerrawupdate` listener cancels press intent as soon as movement crosses the existing drag threshold. It performs no raycasting, rendering, or DOM updates. Ordinary pointer handling and OrbitControls remain in place, including on browsers that do not emit raw updates. This addresses the distinction documented in [W3C Pointer Events §4.2.4–5](https://www.w3.org/TR/pointerevents3/#the-pointerrawupdate-event): ordinary movement may be delayed or coalesced, while raw updates should be dispatched promptly and before the corresponding ordinary movement.

A separate stale-timer guard is applied to both source and the actual App bundle: if the hold callback runs more than 250 ms past its scheduled deadline, `cancelPress` cancels its intent while retaining live contacts. Normal 650 ms holds keep their existing timing. A legitimate hold delayed by a severe main-thread stall must be repeated, so that stale actions do not run before queued movement arrives. Source and actual-bundle tests cover 650/900/901 ms delivery, a three-second stall, contact preservation, and a fresh tap after release.

### Adaptive rendering

[mobile-performance.mjs](../../src/scene/princess-kitten/mobile-performance.mjs) controls drawing-buffer resolution without changing CSS dimensions, model geometry, photo textures, or camera movement. Mobile profiles are:

| Quality level | Idle DPR cap / pixel budget | Gesture DPR cap / pixel budget |
|---|---|---|
| High, initial | 1.5 / 850,000 | 1.0 / 420,000 |
| Medium | 1.25 / 650,000 | 0.9 / 330,000 |
| Low | 1.0 / 500,000 | 0.8 / 260,000 |

The controller respects native DPR and viewport area, lowers quality for sustained slow frames, and recovers with hysteresis. The [R3F adapter](../../src/scene/princess-kitten/production-performance.inc.js) waits for every contact to release, then restores idle quality after 420 ms. Cancellation, lost capture, blur, and visibility changes settle the gesture state. Framebuffer resizing runs in the render callback, outside `pointerdown`, so registering the second finger is not blocked by allocation. Mobile MSAA is disabled.

Paused automatic orbit uses demand rendering while preserving manual zoom/pan. Manual input does not clear the user's pause. Dialog activity guards and reduced-motion behavior remain in place.

### Character updates and diagnostics

`deferMatrices` assigns final matrix/skeleton updates to the renderer while retaining native ground-cat IK's intermediate updates. Fixed held-kitten poses are cached; unchanged princess poses skip bone writes. Detailed diagnostics require `rigqa`.

The V77 GLB and textures remain byte-for-byte identical. Independent arms/lids, the held kitten, three ground cats, all 95 photos, album interactions, film, letter, and routes remain. Two entry import maps select versioned App/scene/modules; unrelated assets are preserved.

Production is generated by the focused release builder against the current `gh-pages` tree. It checks the original scene/App hashes before applying the reviewed changes. The ordinary source build validates the project; the focused Pages patch preserves newer production album and content assets.

## Verification and limits

The [general build run 44500550142](https://github.com/yil384/luma-web-lab/actions/runs/44500550142) completed for the final code, including the stale-hold guard: 297 tests, 294 passed, 0 failed, 3 skipped; lint had 0 errors and 4 existing warnings, and the build passed. The optional real-production-asset checks run separately with a Pages baseline in the [staging workflow](../../.github/workflows/stage-mobile-v78.yml). Coverage includes:

- [Real skeletal tests](../../tests/princess-rig-v77.test.mjs): deferred pose equivalence, independent arms/lids, and native ground-leg preservation.
- [Quality tests](../../tests/mobile-performance-v78.test.mjs): budgets, resume sampling, degradation, and hysteresis.
- [Actual component proxy tests](../../tests/character-hit-proxy-v78.test.mjs): invisible picking and separate actors from default, close, and oblique viewpoints.
- [Release integration](../../tests/mobile-v78-release.test.mjs): module graph, original asset hashes, patched touch contacts, idempotence, and baseline guards.
- [Browser input/performance](../../scripts/qa-mobile-performance-v78.cjs): character/empty-scene pan and pinch, slow two-finger holds, partial release, continued one-finger movement, cancellation, landscape stability, and manual controls while paused.
- [Browser character/content](../../scripts/qa-princess-v77.cjs): actual arms/lids, kitten clicks, photo click versus drag, album closure, film pause/resume, reduced motion, routes, and JavaScript errors.

The existing [Node raycast report](evidence/reports/mobile-v78-raycast-benchmark.json) measured a body-intersecting ray over 60 samples with the same Three r169 geometry and skin transforms:

| CPU hit-test measurement | Original character | Three princess proxy boxes |
|---|---:|---:|
| Median | 15.3504 ms | 0.0178 ms |
| P95 | 19.8058 ms | 0.0512 ms |

This is a 99.88% reduction in isolated median CPU hit-test time, **not mobile FPS**. GPU rendering is excluded; the microbenchmark measures the three princess proxies only.

Baseline/candidate browser runs use fresh processes on the same CI runner with Chromium/SwiftShader. Frame intervals, listener CPU, buffers, and draw counts describe that setup. CDP acknowledgement includes scheduling/transport; it is not touch-to-display latency. Software rendering establishes no iPhone/Safari/WeChat FPS, thermal, or battery result. Physical-phone performance has not been measured.

## Final release evidence

- Tested source: `764a42aafbc3b264a702063e63389a099a9a8fff`.
- Published Pages commit: `e082e0d2f953f922f03efcccea15a21b2ffa882b`, directly descended from V77 production `d7fb0d3524841207d8620ac21e8f9510761d80ec`.
- [Staging and browser run](https://github.com/yil384/luma-web-lab/actions/runs/44500541754): successful; **51 performance/lifecycle checks and 33 character/content checks**, with no recorded JavaScript errors. [Retained browser report](evidence/reports/mobile-v78-browser.json).
- [Pages deployment](https://github.com/yil384/luma-web-lab/actions/runs/44501412232): successful. [Live verification](evidence/reports/mobile-v78-live.json) confirms 15 URLs plus the fresh `?v=78` entry match the tested candidate byte-for-byte. All new JavaScript/module responses use a JavaScript MIME type.
- Release diff: nine added files and two changed entry HTML files; the other 638 pre-existing files remain unchanged. Both `/` and `/christmas/` select the V78 App and scene; `/letter/` and `/album-preview/` retain their original content.

Final browser measurements used a 390 × 844 touch viewport, DPR 3, fresh processes, and the same Chrome/SwiftShader runner:

| Measurement | V77 | Published V78 |
|---|---:|---:|
| Movement listener CPU per ordinary pointermove, including raw listeners | 8.909375 ms | 0.290625 ms |
| Ordinary pointermove events across four pan/pinch phases | 32 | 32 |
| Application raw pointer events counted separately | 0 | 32 |
| Total movement listener CPU | 285.1 ms | 9.3 ms |
| Median gesture drawing-buffer pixels | 895,056 | 210,600 |

The observed combined movement-listener CPU reduction is **96.7%**; the gesture pixel reduction is **76.5%**. Raw-listener CPU is included (0.1 ms total across 32 raw events in this run). Draw-call and triangle ratios are 1.0 for the corresponding phases. These are software-browser measurements, not physical-phone FPS or end-to-end hardware latency.

The successful desktop trace captured a raw move 7.6 ms after pointerdown, while its corresponding ordinary move arrived about three seconds later. The hold timer was cancelled; the ordinary move stayed on the canvas, changed the camera substantially, and did not open an album. Both desktop and mobile also passed album opening/closing, photo drag, real arm and eyelid motion, film pause/resume, reduced motion, and preserved-route checks.

Published hashes:

| Asset | SHA-256 |
|---|---|
| V78 scene | `4ca2839130432bd78b3b057e2dfd469dfb9f6a1f7c696dded914cafbb76cf179` |
| V78 App | `80fb0468e23593a4617f247dfa4cab9e619e3dadd8025e25866a9f4c3ded92a2` |
| Original V77 character GLB | `9b1cd945157dc1dc8645758bcf33d41ce54e4993cb7e299e5e9fe3bf780994e0` |

Physical iPhone, Safari, and WeChat performance has not been measured. The cloud review browser lacks WebGL, so it confirmed the live entry map; rendered-scene and native-input verification comes from the exact-byte CI candidate, followed by live file-hash verification.
