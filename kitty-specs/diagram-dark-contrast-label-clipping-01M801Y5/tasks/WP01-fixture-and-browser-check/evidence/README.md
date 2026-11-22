# WP01 legibility evidence

`legibility.json` from `tests/a11y/diagram-legibility.spec.ts` (attached by the spec on each run) for both colour projects at 1280 px and 390 px.

- `red-lane-a/`: lane-a at 934b407, i.e. `main` code plus the fixture. Red only for the stated reasons:
  - light: "Deep fill, no label colour" 3.06:1; 3 overflowing labels
  - dark: pale-fill node 1.41:1, deep-fill node 3.88:1, ArchiMate labels 1.19–1.41:1; the same 3 overflowing labels
  - themed edges pass: min 6.15:1 (light), 10.63:1 (dark); per figure [3, 2, 2, 3]; nothing skipped
- `green-wp02-draft/`: the same spec over the WP02 draft fix. Every label at least 4.96:1 (light) and 5.62:1 (dark), no overflow.

How to run without Docker: any self-hosted PlantUML server on :8091 serving `/svg/` (CI uses `plantuml/plantuml-server:jetty-v1.2026.9`), then `DK_DIAGRAM_BUILD_RENDER=1 pnpm build:a11y` and `npx playwright test diagram-legibility --project=light --project=dark`. A `DK_PLANTUML_SERVER_URL` override points the build elsewhere. Without any PlantUML server the build fails by design (#13 WP03), so this spec cannot run.
