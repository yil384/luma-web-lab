# Album v10 — Correct front/back photos during a mobile page turn

Released: 2026-11-17 PT. GitHub Pages site: `https://tanchensiyi.com/`.

## Observed behavior

On a phone, after turning a right-side page to the left, the browser could
briefly show the *old front photo mirrored on the back of the leaf*, then
switch to the correct back-side photo. Turning from left to right had the
same visual error. This is different from a blank texture/image decode
flash: the incorrect texture is a real photo, but on the wrong side.

## Why v9 was insufficient

The rotating paper leaf contains **two simultaneous DOM faces**:

- `.memory-album-leaf-front`: outgoing photo (`leafCurrentRight` or
  `leafCurrentLeft`)
- `.memory-album-leaf-back`: incoming reverse photo (`leafNextLeft`
  or `leafNextRight`)

The parent rotates via `rotateY(0deg)` to `rotateY(±179.9deg)`; the back
face has its own `rotateY(180deg)`. The old CSS only used
`backface-visibility: hidden` to determine which face should render.
On some mobile WebKit compositing paths, nested rotated, clipped,
image-backed layers can briefly show the old front as the parent settles.

The image predecoder, low-memory WebPs and delayed reveal handoff in v9
address *other* performance races; they cannot guarantee that the
back-facing photo is not painted at the end of a 3D rotation.

## v10 fix

Published assets:

- `/assets/PhotoGallery-FlipFaces-20261117-v10.js`
- `/assets/memory-album-flip-faces-v10.css`

On touch/small screens the leaf's actual computed 3D transform matrix is
observed via `requestAnimationFrame`. The first `matrix3d` entry is
`cos(θ)`, independent of the direction of the turn:

- `cos(θ) > 0.06` => `data-active-face="front"`, show front, **hide back**
- `cos(θ) < -0.06` => `data-active-face="back"`, show back, **hide front**
- Otherwise, when approximately edge-on, hide both textures

The CSS deliberately overrides native mobile WebKit backface culling with
explicit `visibility` and `opacity` rules. This ensures an old front
photo cannot remain painted on the reverse after rotation passes 90°,
regardless of whether Safari incorrectly culls a back-facing layer.
Only the turning leaf is monitored, and changing its `data-active-face`
does not cause React renders. Desktop behavior is unaffected.

v9's photo resolution, original-size viewer, preloading, stationary DOM
node reuse, mouse drag, touch swipe and page settling are preserved.

## Validation

macOS WebKit iPhone viewport emulation; 6 alternating forward and backward
turns recorded frame-by-frame:

- At every sampled `cos(θ) > 0.20` frame, the front was visible and the
  back hidden.
- At every sampled `cos(θ) < -0.20` frame, the back was visible and the
  front hidden (zero wrong-face violations).
- The front photo URL matched the outgoing page; back photo URL matched
  the destination page for **both** directions.
- Opaque reveal on settle, reused stationary images, original book-image
  proportions and no JavaScript errors.

Initial preview WebKit QA: https://github.com/yil384/luma-web-lab/actions/runs/44256793550
Initial preview Chromium swipe/HD/hover QA:
https://github.com/yil384/luma-web-lab/actions/runs/44256852077

Production runs:
- WebKit: https://github.com/yil384/luma-web-lab/actions/runs/44257389635
- Chromium: https://github.com/yil384/luma-web-lab/actions/runs/44257395270

**Limitations:** Browser-engine emulation does not exactly replicate every
real iPhone GPU or OS version. A real-device check is still needed to
fully confirm that the reported visible artifact is gone.

## Rollback

In the `gh-pages` `index.html`, `christmas/index.html`, and
`album-preview/index.html`, change only the versioned gallery import
and stylesheet:

- JS: `PhotoGallery-MobileOptimized-20261117-v9.js`
- CSS: `memory-album-mobile-optimized-v9.css`

Retain the underlying v9 optimized images and V73 tree/film assets. Do not
replace the production app with an uncoordinated rebuild from the older
`main` source snapshot.
