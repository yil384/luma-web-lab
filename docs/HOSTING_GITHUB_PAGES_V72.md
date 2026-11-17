# Production hosting: GitHub Pages (V72 update)

**Authoritative release target (verified 2026-11-17):** `gh-pages` branch in `yil384/luma-web-lab`, custom-domain `CNAME` exactly `tanchensiyi.com`. The published Pages root has `index.html`, `christmas/index.html`, `letter/index.html`, 95-photo assets, a memory-album v4 stylesheet, the castle/film assets, and an independently customized live TreeScene (three cats). GitHub Actions emitted a successful `pages build and deployment` run after publishing the new V72 preview.

**Do not route this release through ChatGPT Sites.** Historical text in `docs/SEASONAL_SITE.md` describing Sites workflows refers to a previous deployment plan, not the current GitHub Pages release target. GitHub Pages availability from mainland China should be tested directly by the user or local monitoring; this workflow cannot guarantee regional reachability.

## Model
- User-approved-for-use Gemini V72: `princess-eyes-candidate-v72.glb`
- Pinned SHA-256: `9bbf7c0ed5da9b7372906a30b665f0e118a3a66c3122e1499ea8dc4ecd454cbf`
- 15,329,160 bytes; embedded WebP; no rig/animations; fallback to old companion if load fails
- V72 is committed to `feat/princess-kitten-art-direction-20261116/public/princess/luma-princess-v72.glb`.

## Do not deploy the GitHub source build wholesale
Current `gh-pages` production assets have customized live behaviors **not represented in source `main` or the older princess feature branch**. In particular, the live compiled `TreeScene-Cgos-MVd.js` contains three animated chonky cats and a live `PrincessCompanion` while the source feature branch uses one authored cat and another scene component. The live `assets/memory-album-v4.css` is also not present in source builds.

Overwriting the entire Pages root with `dist/` from the feature branch will silently regress these live features, despite a green build. Instead, stage an *additive patch* to the existing `gh-pages` tree and preserve all existing media and entry routes.

## Safe preview already staged
- Preview: https://tanchensiyi.com/preview-v72/
- Pages branch staging commit: `564de41ab7f4c625016e6e46dd87cd9acb1d3567`
- Original Pages baseline: `f87b00bb895aca60310c228bb011780e55a51fff`
- Files added: `assets/App-GeminiV72.js`, `assets/TreeScene-GeminiV72.js`, `assets/princess-v72-loader.js`, `preview-v72/index.html`, `preview-v72/v72-manifest.json`, and `princess/luma-princess-v72.glb`.
- Only changed existing asset: `assets/index-CJX_PAH8.js`, adding a preview URL branch. The live `index.html`, `christmas/index.html`, `letter/index.html`, `CNAME`, memory album CSS, film, photos and existing root React application chunks were byte-for-byte unchanged.
- The preview uses the same React and Three.js runtime as production, and dynamically imports the already bundled glTF loader with no external model/CDN dependencies.
- See workflow [Browser QA for live Pages V72 preview](../.github/workflows/pages-v72-browser-qa.yml) for HTTP asset/sha + WebGL checks.

## Production flip, only after preview verification
Change only the default (non-preview) App choice in `gh-pages/assets/index-CJX_PAH8.js` from `./App-BJDn6o_4.js` to `./App-GeminiV72.js`. Use a fast-forward commit with the current `gh-pages` tree, never a forced push. Existing preview branches and older chunks remain as rollback. Verify live root, /christmas/, /letter/, V72 model, gallery, film, and three-cat interaction.

Rollback: restore only the previous `assets/index-CJX_PAH8.js` blob in a new `gh-pages` commit; keep model and other static assets untouched. The old production tree scene and application bundles have not been changed.

## Limits
The optical appearance and WebGL compatibility of a real iPhone still requires a human/device check. An unrigged model cannot wave or blink naturally; use only restrained root-group nod/idle. Any remaining compatibility problem must preserve fallback and allow immediate root entrypoint rollback.
