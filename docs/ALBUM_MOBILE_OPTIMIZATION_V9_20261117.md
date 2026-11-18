# Album Mobile Performance v9 — 1280px book prints and stable compositing

Release date: 2026-11-17 PT. Published on `gh-pages`, without rebuilding the
older source snapshot on `main`.

## Problem and performance baseline

Mobile Safari can flash the stationary left page during a 3D flip because
the original photo has to be decoded, uploaded to a GPU texture, and painted
while the scene backdrop and other 3D layers are composited.

v8 had already added a three-frame opaque reveal handoff and destination
predecoding, but it still decoded six **full original-resolution** images
at a time and recreated stationary React page/image elements on each turn.
Of the 95 published photos, one is 1014×10798 pixels. Huge decoded textures
can compete with the live Three.js Christmas tree for GPU memory.

## Implemented on production

1. **95 native-aspect WebP book-only assets.** A GitHub Actions job runs
   `scripts/generate-album-book-images.mjs` against the current, published
   original photos. It produces `generated/photos/<id>-book.webp`, capped
   at 1280 pixels on the long side (quality 88). Portraits, landscapes and
   ultralong strips maintain their original aspect ratios. The source
   originals are untouched.
2. **Full-size photo zoom unchanged.** `PhotoGallery-MobileOptimized-20261117-v9.js`
   uses the book-size image **only** inside physical pages and flip leaves.
   `PhotoViewer` still loads `photo.src`, the original file.
3. **Stable React page DOM.** Left and right stationary `BookPage` and
   internal `img` nodes are reused across turns instead of remounting.
   The v8 decoded-image/opaque-reveal handoff remains in place.
4. **Bounded image decode cache.** At most four nearby book pictures are
   retained by the predecoder on touch/small screens; six on desktop.
   Destination images are decoded before turning. Optimized-file failures
   fall back to original images rather than silently showing a blank.
5. **Simpler touch compositing.** `memory-album-mobile-optimized-v9.css`
   disables the expensive full-scene backdrop blur on mobile, removes the
   unnecessary radial shadow blur, avoids hinting static images as GPU
   compositor layers, and preserves the photo-frame centering and opacity
   handoff. Desktop appearance remains unchanged.

### Generated asset measurements

Auditable data: `generated/book-photo-report.json` on `gh-pages`.

| Metric | Full WebP originals | Book WebPs | Reduction |
|---|---:|---:|---:|
| Total file bytes across 95 photos | 35,232,248 | 13,011,378 | 63.1% |
| Sum of decoded image pixels | 242,593,303 | 104,122,560 | 57.1% |

These are **asset-level** totals, not measured page-load transfer or live GPU
memory savings. On a typical book spread, fewer resources are requested at
once, and actual savings depend on which photos are visible.

## Validation

- GitHub Action generated and verified all 95 aspect-preserving WebPs:
  https://github.com/yil384/luma-web-lab/actions/runs/44249497730
- Chromium desktop/mobile gestures, native photo viewer, optimized resources,
  stable stationary image DOM nodes and alignment passed:
  https://github.com/yil384/luma-web-lab/actions/runs/44250051766
- macOS WebKit with iPhone-like viewport/touch: six alternate flips, decoded
  and opaque settling frames, stable stationary nodes, reduced backdrop
  compositing and no JavaScript errors:
  https://github.com/yil384/luma-web-lab/actions/runs/44250119451

Automated WebKit emulation is **not** a physical iPhone GPU test. Final
confirmation should use a physical phone, preferably with a fresh private
tab to avoid stale entrypoint JavaScript.

## Release and rollback

Published files:

- `/assets/PhotoGallery-MobileOptimized-20261117-v9.js`
- `/assets/memory-album-mobile-optimized-v9.css`
- `/generated/photos/*-book.webp`
- `/generated/book-photo-report.json`

`/`, `/christmas/`, `/album-preview/` now all reference these versioned
assets via the existing import map and stylesheet.

To roll back: change only those three entrypoint HTML files to point to
`PhotoGallery-AlbumMobileStable-20261117-v8.js` and
`memory-album-mobile-stable-v8.css`. Keep the generated book photos; they
do not interfere with previous releases.

**Important:** `main` remains an older source snapshot of the live site.
Do not replace live Pages from a naive fresh `main` build without
reconciling the production V73, album and custom-route assets.
