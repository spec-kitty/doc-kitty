---
work_package_id: WP02
title: PlantUML build-render + '-metadata parity
dependencies:
- WP01
requirement_refs:
- C-001
- C-002
- C-003
- FR-006
- FR-007
- FR-008
- FR-011
planning_base_branch: feat/diagram-build-render
merge_target_branch: feat/diagram-build-render
branch_strategy: Planning artifacts for this mission were generated on feat/diagram-build-render. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/diagram-build-render unless the human explicitly redirects the landing branch.
subtasks:
- T101
- T102
- T103
- T104
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/remark/plantuml-meta.internal.ts
create_intent:
- src/lib/remark/plantuml-meta.internal.ts
execution_mode: code_change
owned_files:
- src/lib/remark/plantuml-meta.internal.ts
role: implementer
tags: []
tracker_refs: []
---

## Objective
Issue #13, WP02: ```plantuml renders to a STATIC, THEMED, ACCESSIBLE inline `<svg>`
at build time via `astro-plantuml` against a SELF-HOSTED PlantUML server (NEVER
plantuml.com, C-001), wrapped in the SAME `<figure>`/`<figcaption>` treatment as
Mermaid, named by a `'`-comment metadata block (the twin of the Mermaid `%%`
parser), and themed via the SAME sentinel→`var(--dk-diagram-*)` rewrite WP01
landed. Full parity with Mermaid's `%%` design.

Depends on WP01 (committed b84067a): the mode seam (`resolveDiagramMode`), the
sentinel→var rewrite (`sentinelThemeRewrite` in config.ts), and `diagram-figure.ts`
already exist — REUSE them, do not duplicate. Read kitty-specs/diagram-build-render-01M1XSBP/
{spec,plan,research}.md (research D3/D8 are load-bearing — D8 is a WORKING spike),
contracts/build-render.md. Issue: `gh issue view 13`.

## Proven facts (research D8 spike — reproduce/extend)
- A self-hosted PlantUML server is RUNNING locally: `docker ps` shows
  `dk-plantuml-spike` on http://localhost:8091 (endpoint `/svg/<encoded>`). Use
  `serverUrl: 'http://localhost:8091'` locally. If it is gone, restart:
  `docker run -d --name dk-plantuml -p 8091:8080 plantuml/plantuml-server:jetty`.
- THEMING IS SOLVED and simpler than Mermaid: injecting `skinparam` colours as the
  SIX sentinels (config.ts `DIAGRAM_SENTINELS`) surfaces EXACTLY those sentinels in
  the SVG with ZERO chromatic derived shades. So the WP01 sentinel→var rewrite
  applies unchanged and the chromatic-hex gate passes trivially. Inject a skinparam
  preamble mapping the six --dk-diagram-* tokens → PlantUML colour params (cover the
  diagram type(s) your example uses: e.g. global `backgroundColor`, and per-element
  `BackgroundColor`/`BorderColor`/`FontColor`, `ArrowColor`, and the
  package/rectangle border for the subgraph/cluster analog).
- `astro-plantuml@<pin>` is a REMARK plugin (peerDep astro >=5.5.6, we resolve it).

## Hard rules
- Exact-pin `astro-plantuml` (C-002). NEVER plantuml.com (C-001) — the resolved
  serverUrl must be self-hosted; add a gate asserting no plantuml.com in config/source.
- REUSE WP01's `resolveDiagramMode`, `sentinelThemeRewrite`, `diagram-figure` (adapt,
  don't fork). Mermaid behaviour must be UNCHANGED (client byte-parity + build mode).
- PlantUML is BUILD-ONLY: in client mode a ```plantuml is a plain code fence (no
  figure) — there is no client PlantUML renderer, no pre-#13 output, no byte-parity
  obligation. Document this; do not invent a client PlantUML path.
- Do NOT run `astro check`. Unit tests `cd src && ./node_modules/.bin/vitest run --project fast`.
  Local build-render needs BOTH the PlantUML server (above) AND
  `PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright` (Mermaid still build-renders).
  Do NOT touch DeckLayout or .github/ (WP03). Do NOT commit — the orchestrator commits.

## Subtasks
### T101 — pin + wire astro-plantuml (build mode, self-hosted)
- Add `astro-plantuml` (exact) to src/package.json. Wire it into config.ts's
  `diagramsIntegration` BUILD branch (a remark plugin), `serverUrl` from a resolved
  option/env (default the self-hosted local for the example; NEVER plantuml.com),
  SVG mode. In client/diagrams-off mode it must NOT load or run (C-004).
### T102 — `'`-comment metadata parser twin
- NEW `src/lib/remark/plantuml-meta.internal.ts` + `plantuml-meta.ts`, mirroring
  `diagram-meta.internal.ts`: parse a leading `' key: value` block (PlantUML line
  comment; mandatory space after `'`, never a `'{...}` form) over the SAME closed
  set {title,description,attribution,source}, strip matched lines, inject the
  skinparam sentinel preamble, and stash figure fields on `file.data` for the
  figure builder. Ensure the rendered SVG carries an accessible `<title>`/`<desc>`
  from title/description (inject them into the SVG post-render if PlantUML omits
  them) so axe `svg-img-alt` + the figure aria-labelledby pass.
### T103 — shared figure/caption + var-rewrite + example
- Adapt `diagram-figure.ts` to also wrap an astro-plantuml SVG in the SAME
  `figure.dk-diagram[role=group][aria-labelledby]`+`figcaption` shape. Apply the
  shared `sentinelThemeRewrite` to the PlantUML SVG. Add an example ```plantuml page
  (e.g. example/docs/architecture/plantuml-demonstrator.md) with a `'`-metadata block,
  registered in the example nav/sections as the mermaid demonstrator is.
### T104 — gates + verify
- Extend the mode-aware build gate (`assert-build-artifacts.mjs`) so the PlantUML
  figure is asserted like the Mermaid build figure (inline svg + title/desc + var()
  fills + no sentinel + no CHROMATIC raw hex + caption order). Add an assertion that
  no plantuml.com URL appears in the built output or the shipped config, and that the
  resolved serverUrl is self-hosted (C-001). Verify locally: build with the server +
  Chromium → the plantuml page is a themed named accessible inline SVG; mermaid pages
  unchanged; client mode still byte-identical for mermaid (plantuml = code fence).
- Report per-file changes, the token→skinparam map, the pin, both-engine build
  evidence, the never-plantuml.com proof, fast test count, tsc delta. Do NOT commit.

## Definition of Done
- ```plantuml builds to a themed accessible inline SVG (self-hosted, never
  plantuml.com); `'`-metadata parity with Mermaid's `%%`; shared figure + var-rewrite;
  example page; mode-aware gates green; Mermaid unchanged; astro-plantuml exact-pinned.
