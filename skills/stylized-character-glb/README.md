# Stylized Character GLB Skill

Reusable, evidence-driven workflow for designing **original** cute, high-detail 3D characters and shipping them as `.glb` assets.

**Status: experimental / not yet end-to-end validated.** The observed GLB prototypes are structurally valid, but the latest character has not passed face and multiview acceptance. The Skill explicitly prevents confusing an exportable file with a publishable one.

- **Start:** [`SKILL.md`](SKILL.md)
- **Define the character:** [`references/CHARACTER_BRIEF.md`](references/CHARACTER_BRIEF.md)
- **Reference design:** [`references/REFERENCE_PROMPTS.md`](references/REFERENCE_PROMPTS.md)
- **Technical & aesthetic acceptance:** [`references/QUALITY_GATES.md`](references/QUALITY_GATES.md)
- **Real case history:** [`references/CASE_STUDY_2026-11-16.md`](references/CASE_STUDY_2026-11-16.md)
- **Inspect a GLB:** `python3 scripts/inspect_glb.py path/to/model.glb`
- **Check a PNG:** `python3 -m pip install Pillow && python3 scripts/check_reference.py path/to/image.png`
- **Render a turntable (optional Blender):** `blender -b -P scripts/render_turntable_blender.py -- model.glb out/`

This directory intentionally contains **no private photos, personal site content, generated character images, downloaded model binaries, or tokens**. For web deployment, do not embed private assets or ship a failed candidate.

**Rights:** Do not treat publication as a blanket model/texture/media license. Follow each source material's actual terms. Aesthetic inspiration should result in original characters, not copies of existing studio IP.