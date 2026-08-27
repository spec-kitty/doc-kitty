---
work_package_id: WP09
title: Terminal example demonstrator (the atomic on-switch)
dependencies:
- WP01
- WP02
- WP03
- WP04
- WP05
- WP06
- WP07
- WP08
requirement_refs:
- FR-013
- FR-014
- FR-015
- NFR-001
- NFR-003
planning_base_branch: feat/glossary
merge_target_branch: feat/glossary
branch_strategy: Planning artifacts for this mission were generated on feat/glossary. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary unless the human explicitly redirects the landing branch.
subtasks:
- T030
- T031
- T032
- T033
- T034
- T035
history:
- '2026-08-26: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: example/
create_intent:
- example/.contextive/definitions.yaml
- example/tests/fixtures/definitions.malformed.yaml
- example/docs/glossary-demo/cargo-and-collisions.md
- docs/architecture/glossary.md
- tests/a11y/glossary.spec.ts
execution_mode: code_change
owned_files:
- example/.contextive/**
- example/docs/glossary/**
- example/docs/glossary-demo/**
- example/tests/fixtures/**
- tests/a11y/routes.ts
- tests/a11y/glossary.spec.ts
- docs/architecture/glossary.md
- docs/plans/features/glossary-and-contextive.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../quickstart.md](../quickstart.md), all four glossary ADRs
(`docs/adr/0025`–`0028`), and — the a11y gate shape to extend —
`tests/a11y/routes.ts` (the `AXE_PAGES` + `renderWait`/`renderCount` gates) and
`tests/a11y/axe.spec.ts`.

## Objective

The **atomic on-switch**. Every prior WP (WP01–WP08) is dormant/green; **this WP flips
activation** by landing the example `.contextive/definitions.yaml`, and it must land — in one
mission-approved package — the demonstrator pages, the malformed fixture, the example nav
placement, the generated `docs/glossary/**`, the `AXE_PAGES` glossary entry with its
**non-vacuity** gate, the count-pins, and the docs-of-record. After this WP, the **full seam is
live** and `ci-ok` (code-quality, doc-sanity, **build-example browser-free**, a11y) is green
(D3). Only `example/docs/**` + the example definitions file are auto-linked/rendered/asserted
(C-004); the toolkit's own `docs/**` stays doc-sanity only.

## Dependency note (approved ≠ merged)

This WP sits on **all** of WP01–WP08. Land every approved dep lane onto `feat/glossary` first
(land-approved-deps-early), then cut this lane so the full toolkit seam is present. This is the
integration point — expect to run the whole `ci-ok` here with the seam live.

## Subtasks

### T030 — Example definitions file + demonstrator pages
- Create `example/.contextive/definitions.yaml` with **two contexts** and **≥1 real
  cross-context collision**: e.g. `shipping` (`cargo` + alias `consignment`, `policy`) and
  `hr` (`policy`, …). Realistic definitions (Markdown), examples, and at least one `meta` URL.
- Create demonstrator page(s) under `example/docs/glossary-demo/` exercising:
  - **auto-link** — the first eligible "cargo"/"Cargo"/"consignment" per H2 section links;
  - **hover** — the preview island shows the definition;
  - **`:term`** — `:term[policy]{context=hr}` forces a link where the page context would
    otherwise leave it an unresolved collision; `:term[…]{link=false}` suppresses one;
  - a page with `glossary_context` and one **without** (to exercise the unresolved-collision
    warning path).
- **Files**: `example/.contextive/definitions.yaml`, `example/docs/glossary-demo/*.md`.
- **Validation**: `pnpm --filter example build` — browser-free; `/glossary/**` generated.
- **Greppable-warning build assertion (R-2, NFR-007)**: the context-less demonstrator page
  emits the unresolved-collision warning. Capture the build output (stderr) and assert it
  contains **exactly one** occurrence of the pinned line
  `[glossary] unresolved collision "policy" in hr, shipping — left unlinked` for that page, and
  that the build **exits 0**. This proves NFR-007 at the real build layer, not just vitest.

### T031 — Malformed fixture (FR-002)
- Create `example/tests/fixtures/definitions.malformed.yaml` (a term missing `definition`, or
  a bad-scheme `meta` URL), kept **out of the normal build** (not under `.contextive/`).
- Add a check (vitest or a build-mode script) that loading it **fails** with a message naming
  the offending context/term/field — proving SC-006/FR-002 without breaking the main build.
- **Files**: `example/tests/fixtures/definitions.malformed.yaml` + the assertion.
- **Validation**: the assertion is red if the loader ever stops being build-fatal.

### T032 — Committed generated pages + sidebar via tree-autogen (FR-013, re-scoped P-1)
- **No `sections.yaml` relocation (post-squad P-1).** The `_meta/sections.yaml` registry is
  **unwired** today (draft spec; the only live section-identity is the M3-frozen
  `SECTION_ORDER`/`SECTION_LABEL` in `metadata.ts`, which this mission must not edit). So do
  **not** ship an example `sections.yaml` or claim "under Reference." The glossary appears in
  the sidebar **for free** via Starlight tree-autogeneration (the `docs/glossary/` folder), and
  in the sitemap/agent-API/`llms.txt` because the generated pages are real files under the
  globbed `docs/` collection. FR-013's named-group relocation is **descoped** (documented
  deviation) and tracked as the `sections.yaml`-registry follow-up issue.
- Commit the generated `example/docs/glossary/**` (the generator writes them during build;
  commit the deterministic output so the generators include them and the count-pins assert them).
- **Validation**: the built sidebar shows a glossary group (tree-autogen); `sitemap.xml` +
  `llms.txt` include `/glossary/` + `/glossary/<context>/` routes; a rebuild yields no diff.

### T033 — `AXE_PAGES` glossary entry + non-vacuity gate + hover 1.4.13 spec (FR-014, NFR-001)
- Add the glossary demonstrator route to `AXE_PAGES` in `tests/a11y/routes.ts`, scanned in
  **both** colour modes (mirror the diagram/deck entries).
- **Non-vacuity — pin TWO semantic `guardRoots` selectors (R-1, load-bearing).** Because
  `:term` emits a **byte-identical** link node to the auto-linker, a bare `a[data-glossary-term]`
  count proves *neither* half distinctly — a pure-auto-link page would pass vacuously. So wire
  into `AXE_PAGES[<glossary route>].guardRoots` (which gate the axe scan via `.count()` — the
  right tool here since glossary links are build-time SSR, **not** the client-render `renderWait`)
  **two** selectors that a link-free page cannot satisfy:
  1. an **auto-link discriminator** — e.g. `a[data-glossary-term="cargo"]` on the demonstrator
     (proves ≥1 auto-link), and
  2. a **`:term`-only discriminator** — `a[data-glossary-context="hr"][href*="/glossary/hr/#policy"]`
     **on a page whose own `glossary_context` is NOT `hr`** (so the link can *only* have come from
     `:term`; an unresolved `policy` collision would otherwise be plain text). Make the **scanned
     demonstrator route the context-less page** so both selectors are present and distinguishable.
  A link-free or `:term`-less page must **fail** the gate, not pass green.
- **Hover 1.4.13 behavioral spec (NFR-001)**: create `tests/a11y/glossary.spec.ts` (mirror
  `tests/a11y/diagram.spec.ts`) with **direct** Playwright assertions of the WP06 popover —
  **hoverable** (move the pointer from the link onto the popover; it stays), **Esc-dismissible**
  (Escape closes it), **persistent** (no auto-hide timer while hovered/focused), in **both**
  colour modes. These are behavioral, not axe checks (axe cannot assert 1.4.13); they own the
  NFR-001 evidence.
- **Files**: `tests/a11y/routes.ts`, `tests/a11y/glossary.spec.ts` (new).
- **Validation**: `pnpm test:a11y` green **in the pinned container**
  (`mcr.microsoft.com/playwright:v1.62.1-noble`) for the visual baseline; the non-vacuity
  assertions fire; the 1.4.13 behavioral assertions pass in both modes.

### T034 — Count-pins + footprint twin + JS-off (NFR-003, NFR-005)
- Pin the observable counts the mission asserts (number of generated glossary routes, number of
  auto-links on the demonstrator, `:term` resolutions) so a regression is caught.
- **Footprint twin** (NFR-003): a Playwright network capture proving a **glossary page requests
  the preview chunk** and a **glossary-free control route does not**. **Pin a dedicated control
  route (R-6)** — name a specific existing page that is guaranteed **term-free** and add a guard
  asserting it carries **zero** `a[data-glossary-term]` (so auto-link cannot silently add a link
  after the definitions file lands and rot the negative direction of the twin).
- **JS-off (R-5, NFR-005)**: a Playwright check with `javaScriptEnabled: false` asserting the
  "On this page" block and its plain glossary anchors are present in the served HTML (the block
  and links do not depend on the WP06 island).
- **Files**: within the a11y/e2e suite + `tests/a11y/routes.ts`.
- **Validation**: the twin is red if the island ever loads on a glossary-free page; the control
  route's zero-glossary-link guard holds; the JS-off assertion passes.

### T035 — Docs of record (FR-015)
- Update `docs/plans/features/glossary-and-contextive.md` to reflect the shipped design
  (resolve the "Open questions for planning" — the AS-3 channel, AS-6 codegen, the no global
  toggle decision — pointing at ADR-0025/0026/0027/0028).
- Add a concise `docs/architecture/glossary.md` (a glossary architecture doc) describing the
  load-once index, the resolver/plugin split, codegen-into-collection, the **render-time
  re-derive** links-used mechanism (the frontmatter channel is retired), the presence-gated
  block mount, and sidebar-via-tree-autogen (noting the deferred `sections.yaml`-registry
  relocation) — linking the four ADRs.
- **Files**: `docs/plans/features/glossary-and-contextive.md`, `docs/architecture/glossary.md`.
- **Validation**: `doc-sanity` (markdownlint + link check) green.

## Branch Strategy

Planning branch: `feat/glossary`. Final merge target: `feat/glossary`. **Depends on
WP01–WP08** (all landed on `feat/glossary` first). This is the terminal WP. Implement with
`spec-kitty agent action implement WP09 --agent claude`.

## Definition of Done

- Example `.contextive/definitions.yaml` (2 contexts + real `policy` collision), demonstrator
  pages (auto-link, hover, `:term`, unresolved-collision warning), and the malformed fixture
  all present.
- `example/docs/_meta/sections.yaml` places the glossary under Reference (relocatable);
  generated `docs/glossary/**` committed and picked up by sidebar/sitemap/agent-API/`llms.txt`.
- `AXE_PAGES` glossary entry scans both modes with the **non-vacuity** gate (≥1 auto-link + ≥1
  `:term` collision before the scan); count-pins + footprint twin in place.
- Docs of record updated (feature page + `docs/architecture/glossary.md`).
- **Full `ci-ok` green** with the seam live — build-example browser-free, a11y in the pinned
  container, doc-sanity, code-quality.

## Risks / Reviewer guidance

- **This is the only WP that turns the feature on.** Reviewer: confirm no earlier WP already
  shipped an `.contextive/` file (each earlier WP must have stayed dormant — the corpus was
  byte-identical until here).
- **Non-vacuity (FR-014, the M5 lesson)** — verify the a11y gate would go **red** on a
  link-free page; a vacuous green is the exact failure this asserts against.
- **Browser-free build (NFR-003)** — build-example must spawn **0** headless browsers; the
  preview is client-only and the glossary render is build-time codegen.
- **Container baselines** — regenerate a11y visual snapshots only in the pinned
  `mcr.microsoft.com/playwright:v1.62.1-noble` container (host font-AA drift); chown back +
  `pnpm install --frozen-lockfile` after (see the lane-hygiene note).
- **C-004** — only `example/docs/**` + the example definitions file are asserted; do not
  auto-link the toolkit's own `docs/**`.
