# Tasks: Build-time diagram render — Mermaid + PlantUML (#13)
**Mission**: `diagram-build-render-01M1XSBP` · **Branch**: `feat/diagram-build-render` (direct-to-feat; PR to main, Closes #13)
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Contract**: [contracts/build-render.md](./contracts/build-render.md)

Four sequenced work packages. WP02 depends on WP01; WP03 on WP01+WP02; WP04 on all.

## Subtask Index
| ID | Description | WP |
|----|-------------|----|
| T001 | Pin @beoe/rehype-mermaid; build-render stage under the diagrams opt-in | WP01 |
| T002 | Mode flag + dual-mode seam (build when Chromium resolvable, else client) | WP01 |
| T003 | Sentinel→var(--dk-diagram-*) theme rewrite (full themeVariable enumeration) | WP01 |
| T004 | Reuse diagram-meta accTitle/accDescr; adapt diagram-figure to wrap <svg> | WP01 |
| T005 | Make Mermaid build-artifact + unit gates mode-aware | WP01 |
| T006 | Verify: local build BOTH modes; client mode byte-identical to pre-#13 | WP01 |
| T101 | Pin astro-plantuml; self-hosted serverUrl (never plantuml.com); build stage | WP02 |
| T102 | ' -comment metadata parser twin (title/description/attribution/source) | WP02 |
| T103 | Shared figure/caption + var-rewrite for PlantUML SVG; example plantuml page | WP02 |
| T104 | PlantUML gates; verify never contacts plantuml.com | WP02 |
| T201 | CI+deploy: Chromium + self-hosted PlantUML service; @beoe disk cache | WP03 |
| T202 | Regenerate + pin visual/golden baselines under the build engines | WP03 |
| T203 | Mode-aware diagram.spec.ts (FP-1/T021/T022/DX-*); build-mode deck static SVG | WP03 |
| T301 | ADR + docs/architecture/diagrams.md + CHANGELOG | WP04 |
| T302 | Final full-suite pass; mission-level a11y | WP04 |

## Work Packages
### WP01 — Mermaid build-render core (docs pages)
- **Goal**: docs ```mermaid → static themed accessible inline SVG in build mode; client fallback unchanged; Mermaid gates mode-aware.
- **Requirements**: FR-001..005, FR-010; NFR-001..005; C-002..005.
- **Included subtasks**: T001–T006 · **Dependencies**: none
- **Prompt**: [tasks/WP01-mermaid-build-render.md](./tasks/WP01-mermaid-build-render.md)

### WP02 — PlantUML build-render + `'`-metadata parity
- **Goal**: ```plantuml → static themed accessible inline SVG (self-hosted, never plantuml.com); `'`-metadata twin; example + gates.
- **Requirements**: FR-006..008, FR-011; C-001..003. · **Dependencies**: WP01
- **Prompt**: [tasks/WP02-plantuml-build-render.md](./tasks/WP02-plantuml-build-render.md)

### WP03 — CI/deploy infra + baselines + a11y + deck
- **Goal**: CI+deploy render both engines with cache; regen+pin baselines; mode-aware e2e; build-mode deck SVG.
- **Requirements**: FR-009, FR-010, FR-011; NFR-003..005. · **Dependencies**: WP01, WP02
- **Prompt**: [tasks/WP03-ci-baselines-e2e.md](./tasks/WP03-ci-baselines-e2e.md)

### WP04 — Docs/ADR + mission close
- **Goal**: ADR + architecture docs + changelog; final full-suite pass.
- **Requirements**: NFR-005; C-003. · **Dependencies**: WP01, WP02, WP03
- **Prompt**: [tasks/WP04-docs-adr.md](./tasks/WP04-docs-adr.md)

## MVP
WP01 delivers the Mermaid build-render vertical slice (the core capability + dual-mode + mode-aware gates).
