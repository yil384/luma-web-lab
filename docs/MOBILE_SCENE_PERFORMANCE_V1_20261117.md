# Mobile Christmas Scene Performance v1 (2026-11-17 PT)

## Scope

The live `tanchensiyi.com` Christmas-tree runtime is built as a
versioned lazy-loaded React/Three bundle on `gh-pages`, rather than
from the older `main` source snapshot. This release changes **only**
the Christmas scene performance path on phones; it preserves the
published V73 princess/kitten model, three cats, photo tree, fireworks,
panorama, camera gestures, high-definition album v10, and
`/letter/` confession experience.

## Measured bottlenecks in the existing published runtime

The production `TreeScene-SparkleCamera-20261117-v2.js` contained:

- `Canvas dpr=[1,3]` plus `RenderResolution` raising the DPR to
  the full native up to 3 and a large 8-million-physical-pixel budget.
  On a 390×844 iPhone-like viewport at DPR 3 the actual canvas is
  1170×2531/2532: about **2.96 million raster pixels per frame**.
- An unconditional `EffectComposer` with HDR intermediate buffers,
  full-screen Bloom and Output passes on every frame, even at full
  phone Retina resolution.
- `App` kept the Three scene's `frameloop='always'` running when
  the film dialog was open (behind the playing video).

A separate `/letter/` experience uses video, 2D animation and its
own conservative DPR cap. It was not changed.

## Optimizations

Versioned assets:

- `assets/TreeScene-MobileSmooth-20261117-v2.js`
- `assets/App-MobileSmooth-20261117-v2.js`

They are selected on the public Christmas entrypoints by an import
map; existing files are left available for rollback.

On a coarse-pointer viewport of at most 1000 CSS pixels:

1. Limit 3D scene DPR to **1.65** and the raster budget to
   **1.1 million physical pixels**. Canvas initializes with the
   mobile cap rather than briefly allocating full 3x native targets.
   Desktop high-DPR behavior and its 8MP pixel budget are unchanged.
2. Render directly to the canvas instead of running high-cost
   full-screen HDR Bloom/EffectComposer passes each animation frame.
   Retain existing ACES tone mapping and adjust exposure slightly
   on mobile to preserve an illuminated scene. Desktop retains Bloom.
3. Use compact snowfall, fireworks and object presets even when a
   touch phone is rotated to landscape.
4. When the video modal is open, stop the hidden tree's render loop
   to avoid competing with video playback for the same GPU.

Retain the existing frame-state pause while viewing the album.
No image source, original photo or camera control was removed.

## Browser measurements (preview, not physical-device claims)

QA: https://github.com/yil384/luma-web-lab/actions/runs/44259431402

Measured by macOS Playwright at viewport 390×844 with
`deviceScaleFactor: 3`:

| Metric | Existing live | Mobile optimized | Difference |
|---|---:|---:|---:|
| Canvas raster pixels | ~2,962,000 | 895,056 | **−69.8%** |
| Canvas effective DPR | 3.0 | 1.649 | capped |
| WebKit rAF interval p50 | 26 ms | 17 ms | 9 ms less |
| WebKit rAF interval p95 | 488 ms | 73 ms | lower in this run |

The same run confirmed the active tree camera, V73 princess status,
zero page errors, and desktop Bloom remaining enabled. The WebKit
frame-time measurement includes heavy GLB loading and runner variability
and is **not a controlled steady-state iPhone FPS benchmark**.
A different preview run gave 23→17 ms p50. CPU-side loading stutters
still occur, and the scene has not been measured on a physical iPhone.

## Verification/rollback

Preview: `https://tanchensiyi.com/mobile-perf-preview/`.

For production, `index.html` and `christmas/index.html` should map
`/assets/App-AlbumSwipe-20261117-v5.js` to
`/assets/App-MobileSmooth-20261117-v2.js`.
`/letter/` must keep its own route and player.

To revert, remove **only** that App import-map override from
the home and Christmas entrypoints. The original built assets are
still published. Do not rebuild and overwrite all of `gh-pages`
from the stale `main` snapshot.

If a specific physical iPhone still drops frames, capture a Safari
Web Inspector performance trace; the next targets are GLB parse
long tasks and mobile scene draw-call/texture count, not reducing
photo viewer resolution.
