# Tasks: Astro 7 and Starlight 0.41 migration

**Mission**: astro7-starlight-migration-01M57Y2C · **Branch**: `claude/ecstatic-mccarthy-pm655w` (planning base and merge target)

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Throwaway spike branch: bump astro/Starlight, add @astrojs/markdown-remark, set processor unified() | WP01 | |
| T002 | Run example build, packed consumer fixture, artifact gates, vitest, Playwright a11y; record failures | WP01 | |
| T003 | Changelog audit: Astro 6, Astro 7, Starlight 0.33–0.41 | WP01 | [P] |
| T004 | Per-plugin proof under unified(); answer the updateConfig append question | WP01 | |
| T005 | Re-check the #188 root-canonical rewrite under Starlight 0.41 | WP01 | |
| T006 | Research note in docs/architecture/research/ + #142 findings comment draft + resize proposals | WP01 | |
| T007 | Go/no-go report to operator; stop | WP01 | |
| T008 | Write the processor ADR (Accepted) | WP02 | |
| T009 | Regenerate ADR index; link ADR from #119 scope | WP02 | |
| T010 | Version bumps and peer ranges in src/ and example/ package.json; lockfile | WP03 | |
| T011 | Wire processor: unified() in the toolkit config and markdown-pipeline integrations | WP03 | |
| T012 | Content loader and zod schema fixes | WP03 | |
| T013 | Build-hook fixes (sitemap-order incl. #188, favicon, manifest) | WP03 | |
| T014 | Starlight carriers (Head, Header, Footer, PageTitle, MarkdownContent) | WP04 | |
| T015 | Route middleware and locals.starlightRoute; Starlight config | WP04 | |
| T016 | CSS cascade layers and theme fixes | WP04 | |
| T017 | Compiler-strictness markup fixes in layouts and slots | WP05 | |
| T018 | Example build, consumer fixture and artifact gates green | WP05 | |
| T019 | Rebaseline a11y and visual screenshots with reasons | WP06 | |
| T020 | Determinism two-build check; fix at cause | WP06 | |
| T021 | Example pins and remark-stack enumerator | WP06 | |
| T022 | Consumption test on packed tarball | WP06 | |
| T023 | Red-first: scenarios API without generated_from, bumped version (#183) | WP07 | |
| T024 | Remove generated_from and the deprecated constant; update gate and docs | WP07 | |
| T025 | Red-first: legacy-stamped page fails with regenerate instruction (#210) | WP07 | |
| T026 | Remove LEGACY_STAMPS and the sha256: at fallback | WP07 | |
| T027 | Compatibility-matrix test pinning the new peer ranges | WP08 | |
| T028 | Version 0.4.0 and 💥 Breaking changelog entries | WP08 | |
| T029 | Migration guide 0.3.x → 0.4.0 in docs/migrations/ | WP08 | |
| T030 | Final release-readiness check (no tag/publish) | WP08 | |

## Phase 1 — Spike and gate

### WP01 — Spike and go/no-go (#142) · P1 · [tasks/WP01-spike-and-go-no-go.md](tasks/WP01-spike-and-go-no-go.md)

Goal: turn the migration into an evidence-backed breakage list, then stop for the operator's decision.
Independent test: the note and the #142 comment let the operator decide without reading code.

T001 Throwaway spike branch with the new versions (WP01)
T002 Run every gate; record failures, not just errors (WP01)
T003 Changelog audit (WP01)
T004 Per-plugin proof under unified() (WP01)
T005 #188 canonical re-check (WP01)
T006 Research note + #142 comment draft + resize proposals (WP01)
T007 Go/no-go report; stop (WP01)

Dependencies: none. Risks: proxy blocks registry or docs sites; Playwright browser path.

## Phase 2 — After GO only (C-002)

### WP02 — Processor ADR (#143) · P2 · [tasks/WP02-processor-adr.md](tasks/WP02-processor-adr.md)

T008 Write the ADR (WP02)
T009 Regenerate ADR index (WP02)

Depends on WP01.

### WP03 — Core bump and unified() wiring (#119) · P1 · [tasks/WP03-core-bump.md](tasks/WP03-core-bump.md)

T010 Versions and peer ranges (WP03)
T011 processor: unified() wiring (WP03)
T012 Content loader / zod (WP03)
T013 Build hooks incl. #188 (WP03)

Depends on WP02.

### WP04 — Starlight overrides, config, CSS (#144) · P1 · [tasks/WP04-starlight-overrides.md](tasks/WP04-starlight-overrides.md)

T014 Starlight carriers (WP04)
T015 Route middleware, starlightRoute, config (WP04)
T016 CSS cascade layers (WP04)

Depends on WP03.

### WP05 — Compiler-strictness markup, build green (#145) · P1 · [tasks/WP05-compiler-markup.md](tasks/WP05-compiler-markup.md)

T017 Markup fixes in layouts and slots (WP05)
T018 Builds and gates green (WP05)

Depends on WP04.

### WP06 — Rebaseline gates (#146) · P2 · [tasks/WP06-rebaseline-gates.md](tasks/WP06-rebaseline-gates.md)

T019 A11y and visual baselines (WP06)
T020 Determinism (WP06)
T021 Example pins, remark-stack enumerator (WP06)
T022 Consumption test (WP06)

Depends on WP05.

### WP07 — Remove deprecated surfaces (#183, #210) · P2 · [tasks/WP07-deprecated-removals.md](tasks/WP07-deprecated-removals.md)

T023 Red-first scenarios API test (WP07)
T024 Remove generated_from (WP07)
T025 Red-first legacy-stamp test (WP07)
T026 Remove legacy stamps (WP07)

Depends on WP01 (gate). Can run in parallel with WP02–WP06.

### WP08 — 0.4.0 release prep (#147) · P2 · [tasks/WP08-release-prep.md](tasks/WP08-release-prep.md)

T027 Compatibility-matrix test (WP08)
T028 Version and changelog (WP08)
T029 Migration guide (WP08)
T030 Release-readiness check (WP08)

Depends on WP06, WP07.
