# V72 Princess — Stage, QA and Production Sites Release Runbook

**Updated 2026-11-17.** User explicitly chose Gemini V72 as the provisional princess model and requested an early public launch. This is a release plan, **not a declaration that it is live**.

## Canonical asset (verified)
- User-uploaded `princess-eyes-candidate-v72.glb`, 15,329,160 bytes
- SHA-256 `9bbf7c0ed5da9b7372906a30b665f0e118a3a66c3122e1499ea8dc4ecd454cbf`
- Store at `public/princess/luma-princess-v72.glb`
- `src/scene/PrincessAsset.tsx` is already integrated with the **`VITE_PRINCESS_V72_PREVIEW=true`** build flag. With no asset or false flag, procedural princess fallback remains.
- This unrigged model does NOT have a blinking/waving skeleton; greeting is a subtle whole-body movement.

## Source & deployment ownership (critical)
The user-facing domain **tanchensiyi.com is a ChatGPT Sites deployment**, not a direct auto-publish from GitHub `main` or `gh-pages`. The live Sites source may be ahead of the public GitHub branch. Read `docs/SEASONAL_SITE.md`, `docs/SITES_MEDIA_DELIVERY.md` and the newest Sites source before reconciling.

**Do not deploy the old GitHub build over the current Sites source.** Preserve the already published photos, current film, gallery, narration, cat, HTTPS/domain configuration, `/christmas/` and `/letter/`.

## Stage V72 into source GitHub (safe, no public side effects)

The GLB was uploaded to the user's Google Drive:
`https://drive.google.com/file/d/1yKq-WtC7UH8pn6L66LuIvlqUpT-z4Bja/view`

At the time this runbook was written Google reports **`shared:false`**, with only the owner permission. Thus GitHub Actions cannot download it anonymously yet.

One user-controlled setting is required:
1. Open that Google Drive file → **Share** → General access → **Anyone with the link**, role **Viewer** → Save. This makes **only the model file** publicly retrievable. Do not share other Drive data.
2. In GitHub, open [Actions → Stage Gemini V72 princess asset (safe, manual)](https://github.com/yil384/luma-web-lab/actions/workflows/stage-princess-v72.yml), select the **main** branch (the workflow is registered on the default branch) and click **Run workflow**.
3. The workflow checks out `feat/princess-kitten-art-direction-20261116`, downloads V72 via `gdown`, checks the exact SHA and GLB structure, runs `npm ci`, lint, tests and V72-enabled build, and commits **only** the verified GLB to the feature branch. It uploads a `dist/` build artifact. It does not touch production or Pages.

If anonymous download fails due to Drive policy/quotas, do **not** bypass integrity checks, retry blindly or replace with a different GLB. The offline source distribution is available in the conversation for approved manual upload.

## Production Sites integration (separate from GitHub)
1. Through the **official ChatGPT Sites source workflow**, open the *current* source and verify its project identity/settings and `.openai/hosting.json`. Do not create a new site or replace the current source with stale GitHub main.
2. Copy the original verified V72 bytes into its `public/princess/luma-princess-v72.glb`. Reconcile `PrincessAsset.tsx` into the newest `TreeScene.tsx` rather than wholesale replacing current scene/gallery/audio/route files.
3. Set `VITE_PRINCESS_V72_PREVIEW=true` at build time, preserving current site BASE_URL and hosting prefix. It is an opt-in preview/activation switch, not an environment variable supplied to the browser at runtime.
4. Build and verify the output has `dist/princess/luma-princess-v72.glb` with the same pinned SHA-256 and a V72-enabled JS bundle. Direct GET for the exact asset must return 200, bytes as expected, and an appropriate content type. Check errors/fallback and Safari support for embedded WebP textures.
5. Validate desktop/mobile (real iPhone Safari and Android Chrome ideally): princess near kitten without clipping; camera orbit, touch/drag vs tap, reduced motion, pause/resume, loading and error fallback. Confirm neither gallery, photos, album, film, hand gestures, Christmas home nor the fixed `/letter/` and `/christmas/` routes regress.
6. Create and inspect a **preview of the updated Sites build**. Publish the same verified source via the official Sites release flow; verify externally the live domain and routes after deployment. Retain rollback revision/last good source.

**Until step 6 is actually complete and the public site is verified, report "not yet live".**

## Current status
- [x] V72 user asset saved and SHA-verified in local work.
- [x] Source component, installer, hash tests and TypeScript integration present in [PR #2](https://github.com/yil384/luma-web-lab/pull/2).
- [x] Safe GitHub manual asset staging workflow added to default branch.
- [x] V72 stored privately on the user's Google Drive.
- [ ] Drive model shared as link-viewable (requires user's action).
- [ ] GitHub staging workflow successfully run and GLB committed.
- [ ] Verified **current** Sites source reconciled.
- [ ] Real browser + phone integration QA.
- [ ] Official Sites publish + live domain verification.

PR #2 remains Draft until an actual Sites build is tested; never merge it as a way to "publish" a different system.
