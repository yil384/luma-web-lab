# Album HD v7 — hover/focus frame displacement fix (2026-11-17 PT)

## Symptom and verified root cause

After v6 fixed blurry, off-center photo prints, moving the cursor over a
photo caused the photo frame to jump **right and down by half its width and
height**. The old v5 stylesheet contained the higher-specificity rule:

```css
button.memory-album-photo-mount:is(:hover,:focus-visible) {
  transform: none !important;
}
```

The v6 centering rule used `transform: translate(-50%, -50%) !important`,
but the v5 pseudo-class selector was more specific. That declaration won
only when a button was hovered or keyboard-focused and therefore removed
its essential centering transform. Existing entrypoints loaded the v5
stylesheet before the v6 stylesheet, but the later CSS source order alone
could not overcome this specificity difference.

## Targeted correction

Created `assets/memory-album-hd-v7.css` on the published `gh-pages`
branch. It contains the same original-resolution, aspect-ratio-preserving
v6 layout plus more-specific selectors:

```css
.memory-album .memory-album-sheet .memory-album-photo-mount,
.memory-album .memory-album-leaf-face .memory-album-photo-mount {
  transform: translate(-50%, -50%) !important;
  transition: none !important;
}
```

The same selector prefix is used for mobile frame sizing. This keeps
normal, hover, focus-visible and active state positioning identical and
also covers turning paper faces.

Live `index.html`, `christmas/index.html`, and `album-preview/index.html`
now load `/assets/memory-album-hd-v7.css` instead of v6. The original
v6 HD JavaScript, photo files, 3D scene, and other pages were not changed.

## QA

Preview Chromium automated regression:
https://github.com/yil384/luma-web-lab/actions/runs/44209868560

Checks (passed):
- Hover each stationary photo both before and after a backward page turn:
  frame x/y/width/height remain **exactly identical**.
- Keyboard-focus-visible left and right: no frame displacement, computed
  transform remains the centering translation.
- Full-resolution portrait photos remain inside and centered in pages.
- Left page stays stable halfway through leaf animation.
- Next/previous, mouse drag, actual mobile left and right touch swipes and
  click-to-open original-resolution photo viewer continue working.
- Desktop and mobile JavaScript error checks and public route smoke checks.

Release follow-up GitHub Actions validates the three deployed entrypoints
for the v7 stylesheet (see `qa-album-swipe.yml`).

## Rollback

Restore the prior `/assets/memory-album-hd-v6.css` link in the three
entrypoint HTML files if needed. Old v5/v6 CSS assets remain available.
Do not rebuild and replace this hosted V73 application from the stale
main-branch source without first reconciling the published changes.
