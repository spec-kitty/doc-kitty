---
work_package_id: WP01
title: Internal links resolve — base-prefix glossary/component/authored links + glossary anchors (#61/#63)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- NFR-001
- NFR-002
planning_base_branch: fix/link-integrity
merge_target_branch: fix/link-integrity
branch_strategy: Planning artifacts for this mission were generated on fix/link-integrity. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/link-integrity unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
- T007
- T008
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/
create_intent:
- src/lib/with-base.ts
- src/tests/link-integrity.test.ts
execution_mode: code_change
owned_files:
- src/lib/config.ts
- src/lib/with-base.ts
- src/lib/metadata.ts
- src/lib/glossary/generate.ts
- src/lib/glossary/resolve.ts
- src/lib/glossary/preview.client.ts
- src/lib/glossary/preview-popover.client.ts
- src/lib/remark/glossary-autolink.internal.ts
- src/lib/remark/glossary-autolink.ts
- src/lib/remark/glossary-term.ts
- src/components/slots/Related.astro
- src/components/slots/OnThisPage.astro
- src/components/slots/Audience.astro
- src/tests/link-integrity.test.ts
- example/docs/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load frontend-freddy` (role: implementer), or `spec-kitty agent profile show frontend-freddy` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_024 (fix base-prefixing at shared seams, not per-call-site), DIRECTIVE_001 (one helper, no cloned base logic), red-first tests.

## Objective

Close #61 (internal links omit `/doc-kitty` base → 404) and #63 (glossary anchors never resolve). Read `../spec.md`, `../plan.md` (IC-01/IC-02), `../research.md` (D1–D3). Approach is squad-grounded — implement it, don't re-litigate. Work in the lane worktree only.

## Critical context (verified on main 7921389)

- **Base-less hrefs (Astro does NOT base-prefix raw `/…` links).** Glossary: `src/lib/remark/glossary-autolink.internal.ts` (~:160) + `src/lib/remark/glossary-term.ts` (~:108) build `/glossary/<ctx>/#<anchor>`; components: `src/lib/metadata.ts` `routeFor` (~:288), `src/components/slots/Related.astro` (~:65), `OnThisPage.astro` (~:253 section, :299 glossary), `Audience.astro` (~:74).
- **Established base pattern**: `config.ts` uses `normalizeBasePrefix(base)` for `/rss.xml`,`/llms.txt` — thread the same `base` into the glossary integration/plugins. In `.astro`/`.ts` module scope, `import.meta.env.BASE_URL` is available (use it in `withBase`).
- **Relative-as-child trap**: leaf pages are served at trailing-slash dir URLs, so a bare `[…](blocks-demonstrator)` resolves to `…/superseded-note/blocks-demonstrator` (404). Fix by authoring `./target.md`.
- **Glossary anchor desync**: `src/lib/glossary/generate.ts` (~:93) emits inline `## name {#anchor}`, but markua-attributes (`src/lib/remark/markua-attributes.ts:200-227`) is block-form only → id doubles (`cargo-cargo`), literal `{#…}` renders.

## Subtasks

### T001 — Base-prefix the glossary term URL (one shared builder)
Thread `base` into the glossary remark plugins (via `config.ts`/`normalizeBasePrefix`), and make one base-aware term-URL builder produce `/<base>/glossary/<ctx>/#<anchor>`, used by the autolinker, the `:term` directive, AND the preview client (`preview.client.ts`/`preview-popover.client.ts`) so all three stay identical. Keep the `no-autolink` + collision-stays-plain behavior unchanged.

### T002 — Resolvable glossary anchors (#63)
In `generate.ts` (~:93) emit the supported **block-form** heading attribute (attribute line immediately above the heading) so `{#anchor}` is consumed: headings show no literal `{#}`, and each term heading id equals its intended anchor. Do not change the visible heading text.

### T003 — `src/lib/with-base.ts`
Add one helper that prefixes an in-site path with `import.meta.env.BASE_URL` (normalized, no double slash, leaves external/`#`/`mailto` untouched).

### T004 — Component links via `withBase`
Route `metadata.ts routeFor` (~:288), `Related.astro` (~:65), and `Audience.astro` (~:74) through `withBase`.

### T005 — OnThisPage.astro
Section links (~:253) via `withBase`; glossary list links (~:299) via the shared glossary URL builder from T001 (import it — do not re-hardcode `/glossary/…`).

### T006 — Re-author content links (#61 Class B + A6)
Convert to `./target.md` / `../section/target.md` form (Astro emits the base-prefixed route): `example/docs/architecture/superseded-note.md:19`, `architecture/blocks-demonstrator.md:29,32,34`, `plans/missions/mission-alpha.md:22`, `plans/missions/mission-beta.md:14`, `changelog/README.md:12`, `adr/README.md:17`, `guides/README.md:14`, `architecture/README.md:16`. Leave correct directory-index relative links (e.g. `plans/index.md` `./missions/…/`) and external/anchor links alone.

### T007 — Tests (red-first)
`src/tests/link-integrity.test.ts`: assert the glossary term-URL builder yields a base-prefixed href whose `#anchor` matches the generated heading id (fails on the pre-fix `/glossary/...`-no-base + `cargo-cargo` id); assert `withBase` prefixes internal + skips external/anchor. Add/extend a check that a Related/Audience href is base-prefixed.

### T008 — Verify in the built site
`pnpm clean && pnpm build`, then confirm 0 base-less internal hrefs and 0 relative-child 404s:
```
grep -rhoE 'href="/(glossary|architecture|guides|plans|context|changelog|adr)/[^"]*"' example/dist --include='*.html' | grep -vc '/doc-kitty'   # expect 0
grep -roE 'id="[a-z]+-[a-z]+"|\{#' example/dist/glossary/shipping/index.html   # expect no {# and no doubled ids
```
(Full CI/gate coverage is WP02.)

## Branch strategy
Planning branch `fix/link-integrity`; final merge target `main` (PR). Lane worktree per `lanes.json`.

## Definition of Done
- 0 base-less internal hrefs + 0 relative-child 404s in `example/dist`; glossary anchors resolve (no `{#}`, ids correct).
- Glossary autolink/`:term`/preview share one base-aware URL builder; components share one `withBase`.
- T007 red→green; `pnpm -C src test`, `pnpm lint`, `pnpm build` pass; `pnpm validate:docs` clean.
- External/anchor/directory-index-relative links untouched.

## Risks / reviewer guidance
- Watch double-prefixing (Astro components can already resolve some paths); verify the emitted href has exactly one `/doc-kitty`.
- Keep the three glossary URL builders single-sourced (NFR-002).
