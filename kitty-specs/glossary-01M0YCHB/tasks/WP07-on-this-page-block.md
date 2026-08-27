---
work_package_id: WP07
title: '"On this page" block (composes M3) + owned mount'
dependencies:
- WP04
- WP05
requirement_refs:
- FR-010
- NFR-002
- NFR-005
planning_base_branch: feat/glossary
merge_target_branch: feat/glossary
branch_strategy: Planning artifacts for this mission were generated on feat/glossary. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary unless the human explicitly redirects the landing branch.
subtasks:
- T024
- T025
- T036
history:
- '2026-08-26: authored by /spec-kitty.tasks'
- '2026-08-26: post-tasks squad A-1/A-2/A-3 remediation'
agent_profile: frontend-freddy
authoritative_surface: src/components/slots/OnThisPage.astro
create_intent:
- src/components/slots/OnThisPage.astro
execution_mode: code_change
owned_files:
- src/components/slots/OnThisPage.astro
- src/components/MarkdownContent.astro
role: implementer
agent: claude
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md),
[../contracts/on-this-page-block.md](../contracts/on-this-page-block.md),
`docs/adr/0025-glossary-on-this-page-block-and-remark-render-channel.md` (**re-read Decisions
1–3 — the frontmatter channel is retired; re-derive is the mechanism**),
`docs/adr/0017-m3-content-block-rendering-seam.md`, and the files you **compose** (read, do
NOT edit): `src/components/slots/{ExternalReferences,Related}.astro`, `src/lib/metadata.ts`,
`src/lib/catalog.ts`, `src/themes/spec-kitty/components/molecules/{ReferenceItem,RelatedCard}.astro`;
and the files you reuse: `src/lib/remark/glossary-autolink.internal.ts` (WP04
`computePageLinks`), `src/lib/remark/glossary-term.ts` (WP05), `src/lib/glossary/*` (index +
`isGlossaryActive`). Study the carrier you **own the mount in**: `src/components/MarkdownContent.astro`.

## Objective

Deliver the **"On this page"** block (FR-010) — three labelled sub-lists (external references,
related pages, distinct glossary links used) — by **composing** the M3 renderers (import, never
edit the frozen M3 files), and **own its mount** in the ADR-0013 carrier
`MarkdownContent.astro`. Two post-squad corrections are load-bearing:

- **Links-used is re-derived at render, not read from frontmatter (A-1/A-2).** The
  `remarkPluginFrontmatter` channel is **closed** (schema strips undeclared keys; `entry.data`
  freezes at load). Compute the list with one shared helper over `entry.body`.
- **The mount is owned + presence-gated (A-3).** Mounting `<OnThisPage/>` in the carrier must
  retire the standalone `<Related/>`/`<ExternalReferences/>` to avoid a double render, and must
  be gated on glossary presence so a glossary-free site stays byte-identical (NFR-002).

Present with **JS off** (NFR-005). Dormant until the WP09 definitions file lands.

## Dependency note (approved ≠ merged)

Depends on **WP04 and WP05** (the re-derive reuses `computePageLinks` + `glossary-term`) and
transitively WP02→WP01 (`isGlossaryActive`, the index). Land the approved dep lanes onto
`feat/glossary` first (lane-hygiene "land approved deps early"), then cut this lane. Scope
review to `OnThisPage.astro` + `MarkdownContent.astro`. **Do not edit the frozen M3 files**
(`ExternalReferences.astro`/`Related.astro`/`metadata.ts`/`catalog.ts`/molecules) — import them.

## Subtasks

### T024 — Compose the M3 refs + related sub-lists (no frozen-M3 edits)
- Create `src/components/slots/OnThisPage.astro`. Read `Astro.locals.starlightRoute` for
  `entry.data` (ADR-0017 self-resolving pattern) and build the catalog/index from
  `getCollection('docs'|'bibliography'|'tools')`.
- **External references**: reuse `resolveCitation` (from `src/lib/metadata.ts`) +
  **`buildCatalog` (from `src/lib/catalog.ts` — NOT `metadata.ts`; post-squad L-1)** and render
  each with the `ReferenceItem` molecule — exactly as `ExternalReferences.astro` does.
- **Related**: reuse `resolveRelated` + `slugFromEntryId` (`metadata.ts`) and render with
  `RelatedCard` — as `Related.astro` does.
- Each sub-list has a labelled heading; the block sits below the content in the searchable region.
- **Files**: `src/components/slots/OnThisPage.astro`.
- **Validation**: the refs + related sub-lists render identically to the standalone M3 blocks.

### T025 — Glossary-links-used via the render-time re-derive + dedup/order/omit-empty
- **Re-derive (the sole mechanism, A-1/A-2).** Compute the used list with one shared helper
  `linksForBody(entry.body, pageContext, index, ignoreList)` that runs the SAME transforms the
  pipeline applies — parse → `remarkDirective` → `glossary-term` (WP05) → `computePageLinks`
  (WP04) — and returns `linksUsed` collecting **every** `data-glossary-term` node (auto-linked
  **and** `:term`). Do NOT read `route.entry.data.glossary_links_used` (retired). Do NOT use
  `resolve.ts` alone (no section model, no directive pass → drops `:term` links and mis-counts).
  Import WP04/WP05's pure exports — do not re-implement the walk. (Place `linksForBody` where it
  can import both; it lives in this component's module or a tiny co-located helper — your call,
  but it must reuse the pure exports.)
- Render each as a plain anchor to `/glossary/<context>/#<anchor>` — **present with JS off**
  (NFR-005); the hover island (WP06) is orthogonal.
- **Dedup** by distinct term; **stable order** (definition order, then first appearance).
- **Omit-when-empty**: omit the whole block when all three sub-lists are empty; omit any
  individual empty sub-list (FR-010).
- **Files**: `OnThisPage.astro`.
- **Validation** (R-3): a page with a term linked twice across sections → **one** glossary
  entry; a page missing one datum omits that sub-list; a fully-empty page omits the block; a
  `:term`-linked page's used-list **includes** the `:term` term (proves the re-derive ran the
  directive pass). Assert these deterministically (component/unit or a build-output check).

### T036 — Own the mount in the carrier, presence-gated (A-3)
- Edit `src/components/MarkdownContent.astro` (the **ADR-0013 M1 carrier**, NOT an
  INV-G5-frozen M3 file — legal to edit, owned here) to **swap** the after-content blocks on
  `isGlossaryActive()` (import from WP01's `src/lib/glossary/`; a cheap `.contextive/
  definitions.yaml` presence check):
  - **inactive** → keep rendering the existing standalone `<Related/>` + `<ExternalReferences/>`
    exactly as today — **byte-identical** (NFR-002 dormancy; the swap flips only when WP09 lands
    the definitions file — D3).
  - **active** → render `<OnThisPage/>` **in place of** those two standalones (so refs/related
    are not double-rendered), keeping the named `<slot name="dk:*">`s for authored MDX.
- **Files**: `src/components/MarkdownContent.astro`.
- **Validation**: with no `.contextive/` file the carrier output is byte-identical to pre-WP07
  (diff the built after-content region); with the file present, `<OnThisPage/>` renders once and
  the standalone Related/ExternalReferences do not also appear (no double render).

## Branch Strategy

Planning branch: `feat/glossary`. Final merge target: `feat/glossary`. **Depends on WP04 +
WP05** (+ transitive WP01/WP02). Runs in parallel with WP06. Implement with
`spec-kitty agent action implement WP07 --agent claude`.

## Definition of Done

- `OnThisPage.astro` composes the M3 refs + related renderers by **import** (zero edits to any
  frozen M3 file — INV-G5) and adds the glossary-links-used sub-list via the render-time
  re-derive (`linksForBody`), deduped, stable order, omit-when-empty, `:term` included.
- The mount in `MarkdownContent.astro` is presence-gated: glossary-free build byte-identical
  (NFR-002); glossary-active renders `<OnThisPage/>` once with no double render.
- Present and complete with JS off (NFR-005). `ci-ok` green (dormant — no `.contextive` yet).

## Risks / Reviewer guidance

- **No frozen-M3 edits (INV-G5)** — Reviewer: `git diff` touches only `OnThisPage.astro` +
  `MarkdownContent.astro`. Any change to `ExternalReferences.astro`/`Related.astro`/
  `metadata.ts`/`catalog.ts`/a molecule is a finding. `MarkdownContent.astro` IS allowed (it is
  the ADR-0013 carrier, not a frozen M3 file) and is owned here.
- **Re-derive, not frontmatter** — confirm the block does NOT read
  `route.entry.data.glossary_links_used` (dead channel) and that `linksForBody` runs the
  directive+term pre-pass so `:term` links appear in the list.
- **Dormancy** — the mount swap must leave a glossary-free build byte-identical; the most common
  miss is mounting `<OnThisPage/>` unconditionally, which changes every page before WP09.
- **JS-off** — the block + glossary anchors must be in the SSR HTML; nothing depends on WP06.
