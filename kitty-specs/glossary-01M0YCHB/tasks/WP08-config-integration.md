---
work_package_id: WP08
title: Single-owner config.ts integration + schema fields
dependencies:
- WP01
- WP02
- WP03
- WP04
- WP05
- WP06
- WP07
requirement_refs:
- FR-008
- FR-013
planning_base_branch: feat/glossary
merge_target_branch: feat/glossary
branch_strategy: Planning artifacts for this mission were generated on feat/glossary. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary unless the human explicitly redirects the landing branch.
subtasks:
- T026
- T027
- T028
- T029
history:
- '2026-08-26: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/config.ts
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/config.ts
- src/lib/schema.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../contracts/autolink-and-term.md](../contracts/autolink-and-term.md),
`docs/adr/0027-auto-link-resolution-scoping-and-term-directive.md`,
`docs/adr/0028-glossary-frontmatter-fields.md`,
`docs/adr/0025-glossary-on-this-page-block-and-remark-render-channel.md`, and the pattern you
mirror: the `diagramsIntegration` + `deckSplitIntegration` blocks in `src/lib/config.ts` (the
M5 WP03 single-owner integration).

## Objective

Own the **single** integration seam (D2, the M5 WP03 pattern). This is the only WP that edits
`config.ts` and `schema.ts`. Add the two new frontmatter fields (ADR-0028); pin the remark
plugin order (ADR-0027); wire the generator hook (ADR-0026); inject the preview island
page-wide (ADR-0025/WP06); and run the AS-3 surfacing **spike**. **Everything is
presence-gated** so a site with no `.contextive/definitions.yaml` keeps a **byte-identical**
integration array and corpus (NFR-002) — exactly like the `diagrams: false` path. This WP does
**not** land the example on-switch (that is WP09); with no example definitions file, all wiring
here is inert and `ci-ok` stays green.

## Dependency note (approved ≠ merged)

This WP composes **all** prior WPs. Land each approved dep lane onto `feat/glossary` first (the
lane-hygiene "land approved deps early" flow) so `src/lib/glossary/*`, `src/lib/remark/
glossary-*`, `src/components/slots/OnThisPage.astro`, and `src/lib/glossary/preview.client.ts`
are all present, then cut this lane from the composed `feat/glossary`. Resolve any
`snapshot-latest.json`/`lanes.json` add/add with `--ours`.

## Subtasks

### T026 — Add `glossary_context` + `glossary_autolink` to the schema (ADR-0028)
- `src/lib/schema.ts`: extend `docKittyDocsSchema` with two **optional** fields:
  `glossary_context: z.string().optional()` and
  `glossary_autolink: z.boolean().optional()` (absent = `true` at read sites).
- Mirror them in the standalone validator if it enforces the schema separately.
- **Additive**: a page with neither field validates and renders exactly as before (NFR-002).
- **Files**: `src/lib/schema.ts`. **Validation**: `astro check` clean; existing pages unaffected.

### T027 — Wire the generator hook + pinned remark order (presence-gated)
- In `src/lib/config.ts`, add a **glossary integration** (mirroring `diagramsIntegration`),
  **presence-gated** on `.contextive/definitions.yaml`:
  - Call `loadGlossary(cwd)`; if absent → contribute **nothing** (array byte-identical).
  - If present → (a) run `generateGlossaryPages(index, docsDir)` in the **`astro:config:setup`**
    hook (pin it — the content-layer glob `sync` runs after all config hooks, so files on disk
    are visible to `getCollection('docs')`, the sitemap filter, sidebar, agent API, and
    `llms.txt`); (b) register the remark plugins in the **pinned order** via
    `updateConfig({ markdown: { remarkPlugins: [...] } })` **append** semantics:
    `remarkDirective → glossary-term → glossary-autolink` (Astro's built-in `remark-gfm`
    already precedes them). Pass the shared `index` + ignore-list into the plugin factories.
- **Files**: `src/lib/config.ts`. **Validation**: covered by T028/T029 + WP09.

### T028 — Inject the preview island page-wide (M5 pattern); deck guard; byte-identical
- Mirror the `diagramsIntegration` `injectScript('page', …)`: import `initGlossaryPreview`
  from `src/lib/glossary/preview.client.ts` by absolute on-disk path and call it (with a
  `.catch(console.warn)` like the diagram owner). The island's own early-return keeps a
  glossary-free page cost-free (NFR-003).
- The island must be safe on the out-of-frame deck (`main.reveal`) — it keys on
  `[data-glossary-term]`, so a deck with no glossary links is a no-op; a deck with `:term`
  links gets the preview. No `main.reveal`-specific guard is needed for the preview (unlike the
  diagram render), but confirm it does not double-init.
- **Presence-gating**: the whole glossary integration is omitted when no definitions file
  exists → the integrations array is **byte-identical** to pre-M4 (NFR-002).
- **Committed byte-identity gate (R-4)**: make the glossary-free byte-identity a **committed,
  re-runnable** assertion (not a manual "diff vs pre-WP08") — e.g. a vitest/build check that
  building the example with **no** `.contextive/` yields an integration array / output hash
  equal to a pinned baseline, mirroring how `diagrams: false` is verified. A future
  unconditional-plugin-registration regression must fail loudly.
- **Files**: `src/lib/config.ts` (+ the committed check). **Validation**: the committed
  glossary-free byte-identity assertion is green.

### T029 — Codegen timing + dev-watcher idempotency guard (spike retired)
- **The AS-3 surfacing spike is RETIRED (post-squad A-1).** The `remarkPluginFrontmatter`
  channel is architecturally closed — `docKittyDocsSchema` (`docsSchema({ extend: z.object })`)
  strips undeclared keys and `entry.data` freezes at collection-load — so there is nothing to
  spike; WP07 re-derives links-used at render via `linksForBody`. Do not build a probe.
- **Instead, guard the codegen timing + idempotency** (architect MED/LOW):
  - Confirm `generateGlossaryPages` runs in `astro:config:setup` (T027) so `docs/glossary/**`
    exists before the glob sync — the generate-before-glob ordering.
  - **Dev-watcher safety**: the content layer watches the glob base; each `config:setup` re-run
    regenerates the files, so generation MUST be byte-identical or `astro dev` loops. Assert the
    generated frontmatter/body carry **no timestamp or nondeterministic field** (in particular
    the `generated: { by, at }` schema field must **not** be emitted by the generator).
  - Add a CI-style check that `git diff --exit-code docs/glossary example/docs/glossary` is
    clean **after** a build, so generator drift fails loudly instead of shipping a dirty tree.
- **Files**: `src/lib/config.ts` (hook pinning) + the drift check (wire into the build/test
  lane). **Validation**: `astro dev` settles (no rebuild loop); post-build `git diff` is clean.

## Branch Strategy

Planning branch: `feat/glossary`. Final merge target: `feat/glossary`. **Depends on
WP01–WP07** (land all approved dep lanes onto `feat/glossary` first). Implement with
`spec-kitty agent action implement WP08 --agent claude`.

## Definition of Done

- `schema.ts` carries the two optional fields (ADR-0028); existing pages unaffected.
- `config.ts` presence-gated glossary integration: generator hook + pinned remark order
  (`gfm → directive → :term → autolink`) + island inject.
- Glossary-free build is **byte-identical** to pre-M4 (integration array + corpus).
- The AS-3 spike result is recorded and WP07's channel/fallback is confirmed accordingly.
- `ci-ok` green — **the example is not switched on here** (WP09 owns the on-switch).

## Risks / Reviewer guidance

- **Single owner** — this is the only WP touching `config.ts`/`schema.ts`. Reviewer: confirm no
  other WP's diff edits them.
- **Presence-gating is load-bearing (NFR-002)** — with no definitions file the array must be
  byte-identical; the most common miss is registering a plugin unconditionally. Mirror the
  `diagrams ? [diagramsIntegration] : []` shape.
- **Plugin order** — `remarkDirective` before `glossary-term` before `glossary-autolink`;
  a wrong order double-links or mis-parses `:term`. A regression test (WP04/WP05) guards it.
- **Do not flip the example on** — no `example/**` edits here; WP09 is the atomic switch.
