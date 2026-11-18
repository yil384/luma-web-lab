# Mobile album v8: flicker-free page handoff (2026-11-17 PT)

## Why a phone could still flash after desktop v7 was fixed

The production v7 book module performed the last phase of each turn
in one React update: it replaced the stationary left/right `BookPage`
image elements and removed both the rotating leaf and the incoming
`.memory-album-reveal` layer. On mobile WebKit, image decoding or GPU
compositing can lag behind a DOM replacement, briefly uncovering blank
paper. The old prewarm effect started `image.decode()` in the
background but **did not await its completion**. CSS on coarse pointers
also used a 92 ms alpha transition for the incoming reveal.

This is a code-level race risk, independent of the possibility of a
stale mobile browser tab. Prior to v8, the CI phone simulation used
Chromium rather than WebKit.

## Published implementation

The `gh-pages` branch contains:

- `assets/PhotoGallery-AlbumMobileStable-20261117-v8.js`
- `assets/memory-album-mobile-stable-v8.css`

Both `index.html` (home) and `christmas/index.html` now refer to
those cache-busted asset names; `album-preview/index.html` matches.

The v8 module:

1. Caches and awaits decode of original-resolution destination photos
   before beginning a turn; bounds the cache to eight neighboring images.
2. Keeps the outgoing/incoming reveal layer opaque while committing the
   new stationary page content in a separate `settling` phase.
3. Waits for the stationary page image elements' decode/load, then
   allows three browser animation frames to paint before removing the
   incoming overlay. Never leave the new left page exposed while its
   image element is still decoding.
4. Removes the fragile reveal-opacity fade on coarse/touch pointers.
5. Preserves v7 CSS centering across hover/focus/active, native aspect
   ratio and HD photos, actual touch swipes and desktop dragging.

## Validation and caveats

- Chromium desktop and mobile end-to-end QA (including real emulated
  touch swipes, forward/back turn, frame alignment, photo viewer and
  no JS errors): https://github.com/yil384/luma-web-lab/actions/runs/44246919627
- macOS WebKit with iPhone-like touch/viewport emulation:
  six alternating turns, each recorded frame in the `settling` phase
  had an opaque visible reveal with decoded 1440px images; final state
  was fully ready with no browser errors:
  https://github.com/yil384/luma-web-lab/actions/runs/44247264061
- Followup production route HTML/asset release checks are implemented
  in `.github/workflows/qa-album-swipe.yml` and
  `.github/workflows/qa-album-mobile-webkit-macos.yml`.

**Important:** macOS WebKit device emulation is not an actual iPhone,
and DOM/computed-style checks do not prove every native iOS GPU frame
was artifact-free. Physical-device confirmation remains useful.

## Rollback

Restore only the v7 script and CSS references in the HTML entrypoints:

- JS: `/assets/PhotoGallery-AlbumHD-20261117-v6.js`
- CSS: `/assets/memory-album-hd-v7.css`

The old files remain available. Do not replace the published V73
runtime with a fresh build from the stale `main` source snapshot
without reconciling the production CSS/JS changes and scene assets.

## Diagnose stale mobile caches

Open a fresh Safari Private tab or Android Chrome Incognito tab and
load `https://tanchensiyi.com/`. If the problem occurs only in the
existing tab, fully close the old tab and reload the site. For further
diagnosis clear site data only for this origin, not global browser
history; use the private-tab result to distinguish caching from
persistent browser-specific rendering.
