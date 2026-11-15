<div align="center">

<h1>Luma Web Lab</h1>

<p><strong>Experiments in light, motion, and immersive web interfaces.</strong></p>

<p>React · TypeScript · Three.js · Vite</p>

<p>A frontend design-and-engineering study exploring how spatial scenes,<br />photography, video, and small interactions can share one responsive interface.</p>

</div>

---

## The idea

A website can feel like a place, not just a sequence of screens.

Luma Web Lab explores that idea through a seasonal WebGL scene, a photo-led gallery, and a cinematic narrative interface. The emphasis is on the details between them: transitions, loading states, touch targets, playback controls, and the balance between atmosphere and usability.

This is an experimental application, not a production-ready component library or a general-purpose site builder.

## Interface studies

| Study | What it explores |
| --- | --- |
| **Spatial composition** | A photo-based 3D scene, layered environments, animated characters, and camera interaction with Three.js and React Three Fiber. |
| **Photo browsing** | Generated thumbnails, scene textures, and an on-demand larger-image viewer instead of loading every full-size image at startup. |
| **Cinematic interfaces** | HLS playback, timeline-driven interactions, audio controls, and a separate narrative route. |
| **Touch-first design** | Portrait layouts, safe-area spacing, touch interaction, and playback recovery on mobile browsers. |
| **Optional gesture input** | A camera-based interaction mode that is requested explicitly rather than enabled when the page opens. |

## Design principles

**Atmosphere without losing orientation.** Visual effects should support the scene while leaving navigation and playback controls understandable.

**Progressive loading.** Start with the interface; load heavier scenes and media when they are needed.

**Motion with restraint.** Account for reduced-motion preferences, background tabs, and devices that cannot comfortably run the full experience. These are design goals and implementation concerns, not a claim of universal device compatibility.

**Real-device verification.** A passing build does not establish smooth WebGL rendering, correct audio behavior, or comfortable touch interaction on a phone.

## Run locally

Use Node.js **20.19 or newer** and npm. From a checkout of the source branch:

```bash
npm ci
npm run dev
```

The preparation scripts generate photo, scene, and gesture-recognition assets. The first asset preparation may need network access to download the gesture model. Generated resources live in `public/generated/`; they are not a replacement for the source assets.

```bash
npm run lint
npm test
npm run build
npm run preview
```

The production build performs TypeScript checks, builds with Vite, and writes static route entry files into `dist/`.

## Explore the application

| Local route | Experience |
| --- | --- |
| `/` | Seasonal scene and gallery entry |
| `/christmas/` | Explicit seasonal-scene route |
| `/letter/` | Cinematic narrative interface; the established route name is retained for compatibility |

For project-site hosting, these routes sit beneath the configured deployment base path rather than the domain root.

## Project map

```text
src/
  main.tsx                 Application bootstrap
  SeasonalEntry.tsx        Route selection and lazy loading
  scene/                   WebGL scene and animation
  components/              Gallery, viewer, and interface components
  journey/                 Video, timeline, and narrative interactions
  hand-tracking/           Optional gesture input
  lib/                     Shared helpers and route logic
public/
  photos/                  Source photographs and manifest
  journey/film/            Existing HLS media and playlists
  generated/               Build-generated runtime resources
scripts/                   Asset preparation and build finalization
tests/                     Automated checks
```

## Static deployment

The application can be served as static files. This repository uses `gh-pages` for a prebuilt GitHub Pages snapshot; `main` contains a separately versioned source snapshot.

Before replacing a published build, check that the intended source version and generated assets match. Do not assume that rebuilding an older source snapshot reproduces the currently published scene or media.

A deployment should preserve the root entry, `letter/index.html`, `christmas/index.html`, and all referenced assets. For branch-based GitHub Pages publishing, place `.nojekyll` at the publishing root and select `gh-pages` / `/(root)` in the Pages settings.

A repository rename also changes the project-site base path. Update HTML, CSS, JavaScript, and route normalization together; renaming the repository alone is not a deployment migration. DNS changes and custom-domain migration are separate operations.

## Working on the project

Small, focused changes are easiest to review. Useful areas include loading behavior, keyboard interaction, touch ergonomics, reduced-motion behavior, rendering cost, and reliable media playback.

Run the available checks and describe what was actually tested. For visual or playback changes, include the browser, viewport, interaction sequence, and any real-device observations. Avoid presenting desktop emulation as mobile-device validation.

Use your own media when adapting an experiment. Preserve attribution and applicable notices for third-party components and assets.

## Code and media permissions

Public visibility does not make every file a freely reusable asset. This repository does not currently declare a repository-wide open-source license; do not assume MIT or another license applies to the whole tree.

Photographs, video, audio, fonts, character models, and production materials are separate from the interface implementation. Publication here does not grant permission to reuse them. Third-party materials remain subject to their own licenses and attribution requirements.

---

<sub>Built to study the craft of interactive websites: composition, motion, media, and the engineering that keeps them usable.</sub>
