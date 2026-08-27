---
work_package_id: WP03
title: Glossary page generator + hub + nav default
dependencies:
- WP01
requirement_refs:
- FR-003
- FR-004
- FR-013
planning_base_branch: feat/glossary
merge_target_branch: feat/glossary
branch_strategy: Planning artifacts for this mission were generated on feat/glossary. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary unless the human explicitly redirects the landing branch.
subtasks:
- T009
- T010
- T011
- T012
history:
- '2026-08-26: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/glossary/generate.ts
create_intent:
- src/lib/glossary/generate.ts
- src/tests/glossary-generate.test.ts
execution_mode: code_change
owned_files:
- src/lib/glossary/generate.ts
- src/tests/glossary-generate.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../contracts/page-generation.md](../contracts/page-generation.md),
`docs/adr/0026-glossary-source-and-generation-seam.md`, and — for the collection/loader shape
you generate into — `src/lib/schema.ts` (the `glob({ base: 'docs' })` loader + README-as-index)
and `example/src/content.config.ts`.

## Objective

**Codegen** the glossary pages as Markdown files **into the docs collection** (ADR-0026,
AS-6): a `/glossary/` hub + one page per context under `docs/glossary/<slug>/`. Because they
land under `docs/`, the existing `glob({ base: 'docs' })` loader ingests them, so the
sidebar, sitemap draft-filter, agent API, and `llms.txt` pick them up with **zero new wiring**
(FR-013) — the reason an injected route was rejected. `generate.ts` is a **pure** function of
WP01's `SharedTermIndex` returning the written paths; it is **wired** by WP08's config hook,
not here, and is **presence-gated** (absent index → writes nothing). Dormant until WP09 lands
the example `.contextive`.

## Dependency note (approved ≠ merged)

Merge the approved WP01 lane first so `src/lib/glossary/{types,anchor,load}.ts` are present:
`git merge kitty/mission-glossary-01M0YCHB-lane-<wp01> --no-edit`. Scope review to this WP's
files.

## Subtasks

### T009 — Hub + per-context page generation
- Create `src/lib/glossary/generate.ts`:
  `generateGlossaryPages(index: SharedTermIndex, outDocsDir: string): string[]`.
- Write `<outDocsDir>/glossary/index.md` — the **hub**, `kind: Hub`, `title: Glossary`,
  `doc_status: active`, body listing each context with a link to its page.
- Write `<outDocsDir>/glossary/<slug(context)>/index.md` per context — `kind: Glossary`,
  `glossary_context: <context>` (self-declared, so cross-refs resolve), `title: <Context>`,
  `doc_status: active`.
- **Presence-gate**: an absent/empty index → write nothing, return `[]` (INV-G4).
- **Files**: `src/lib/glossary/generate.ts` (~110 lines).
- **Validation**: covered by T012.

### T010 — Markdown-rendered definitions/meta + deterministic anchors + domainVision
- Each term renders as a Markdown section at a deterministic `#<anchor>` (`slug(name)` from
  WP01 — import it, do **not** reinvent): a heading carrying the anchor id, the `definition`
  as **Markdown body** (not pre-escaped plain text — FR-003/FR-004 route it through the real
  pipeline when the page renders), aliases + examples if present, and `meta` rendered as
  Markdown (its URLs were already scheme-checked build-fatally in WP01).
- Render the context's `domainVisionStatement` (Markdown) at the top of its page if present
  (FR-003).
- **Files**: within `generate.ts`. **Validation**: covered by T012.

### T011 — Self-declared context (sidebar comes free from tree-autogen)
- Each generated context page sets its own `glossary_context` (done in T009) so ADR-0027's
  resolver links its own cross-references unambiguously (ADR-0026 Decision 4).
- **NO "default Reference nav" deliverable (post-squad P-1).** The only live section-identity
  mechanism today is the hardcoded `SECTION_ORDER`/`SECTION_LABEL` in the **M3-frozen**
  `src/lib/metadata.ts` (INV-G5 — do not touch), and `_meta/sections.yaml` is unwired (draft
  spec). So the generator does **not** try to place the glossary "under Reference." Instead the
  glossary appears in the sidebar **for free** via Starlight's tree-autogeneration (a
  `docs/glossary/` folder yields a sidebar group), and in the sitemap/agent-API/llms.txt
  because the pages are real files under the globbed `docs/` collection. Relocating it under a
  named nav group is deferred (the `sections.yaml`-registry follow-up issue), out of M4.
- **Files**: within `generate.ts` (write the real `docs/glossary/**` files only).
  **Validation**: covered by T012 + WP09's build (sidebar group present via tree-autogen).

### T012 — Determinism + presence-gating unit tests
- `src/tests/glossary-generate.test.ts` (vitest), generating into a temp dir:
  - Same `index` twice → **byte-identical** file contents + identical returned path list
    (NFR-004, INV-G2).
  - Absent/empty index → returns `[]`, writes nothing (INV-G4).
  - A term's `definition` markdown survives into the page body (not HTML-escaped to text).
  - Anchors equal `slug(name)`; the hub lists every context.
- **Validation**: `pnpm test` green; `astro check` clean.

## Branch Strategy

Planning branch: `feat/glossary`. Final merge target: `feat/glossary`. **Depends on WP01**
(merge the approved WP01 lane first). Runs in parallel with WP02. Implement with
`spec-kitty agent action implement WP03 --agent claude`.

## Definition of Done

- `generate.ts` writes a hub + per-context pages into `docs/glossary/**` with real
  frontmatter, Markdown-rendered definitions/meta, deterministic anchors, `domainVisionStatement`.
- Generated context pages self-declare `glossary_context`; default Reference nav placement in
  place; `example/` untouched.
- Presence-gated + deterministic (same index → byte-identical); vitest green.
- `ci-ok` green — the generator is not wired yet (WP08 wires it); corpus byte-identical.

## Risks / Reviewer guidance

- **Codegen INTO `docs/` — not an injected route.** Reviewer: confirm the output path is under
  the docs collection base so the glob loader sees it (FR-013). An `injectRoute` here is a
  finding.
- **Determinism** — no `Date.now()`/ordering by Map-iteration-nondeterminism; sort contexts/
  terms by a stable key so re-runs are byte-identical (NFR-004).
- **Reuse `anchor.slug`** — a second slug impl is a finding.
- **No `example/` edits** — the example demonstrator + `sections.yaml` are WP09's.
