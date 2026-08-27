---
work_package_id: WP04
title: Auto-link remark plugin + links-used
dependencies:
- WP02
requirement_refs:
- FR-005
- FR-006
- FR-007
- FR-008
- FR-009
planning_base_branch: feat/glossary
merge_target_branch: feat/glossary
branch_strategy: Planning artifacts for this mission were generated on feat/glossary. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
- T016
- T017
history:
- '2026-08-26: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/remark/glossary-autolink.ts
create_intent:
- src/lib/remark/glossary-autolink.ts
- src/lib/remark/glossary-autolink.internal.ts
- src/tests/glossary-autolink.test.ts
execution_mode: code_change
owned_files:
- src/lib/remark/glossary-autolink.ts
- src/lib/remark/glossary-autolink.internal.ts
- src/tests/glossary-autolink.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../contracts/autolink-and-term.md](../contracts/autolink-and-term.md),
[../contracts/resolver.md](../contracts/resolver.md), and
`docs/adr/0027-auto-link-resolution-scoping-and-term-directive.md`. Study the existing remark
precedents you are mirroring: `src/lib/remark/deck-split.ts` (the `kind`-guard + `file.data.
astro.frontmatter` read + `file.message` warning re-emit) and `src/lib/remark/diagram-meta.ts`
(pure-internal split + `file.data` stash).

## Objective

A **thin** remark plugin that auto-links glossary terms over WP02's pure resolver. Link the
**first eligible occurrence per H2 section** of each term/alias (FR-005), never inside code /
headings / existing links (FR-006), whole-word **case-insensitive**; on an unresolved
collision leave the text plain and emit one **greppable** warning (NFR-007, exit 0); publish
the distinct **links-used** list to `remarkPluginFrontmatter` for the "On this page" block
(ADR-0025). All string/tree logic lives in `glossary-autolink.internal.ts` (Astro-free,
vitest); the wrapper only walks, guards, rewrites, and moves data.

**This WP is DORMANT** — registered by nobody until WP08 wires the plugin order, and no-op
until WP09 lands the example definitions file. The built corpus stays byte-identical.

## Subtasks

### T013 — Section model + first-eligible-per-section (incl. pre-existing `:term` links)
- In `glossary-autolink.internal.ts`, implement the **section walk** (FR-005): an `heading`
  of `depth === 2` **begins** a new section; body content before the first H2 is one
  **implicit** section; H3+ headings and their blocks **belong to their parent H2 section**.
- Track, per section, the set of distinct surfaces already linked; only the **first eligible**
  occurrence of a surface in a section is linked (later occurrences in the same section are
  left as text; the next section resets).
- **CRITICAL — seed the per-section set from pre-existing `:term` links (WP04↔WP05
  coupling).** The `:term` plugin (WP05) runs **before** this plugin (pinned order in WP08),
  so a section may already contain `link` nodes marked `data-glossary-term=<term>` /
  `data-glossary-context=<ctx>`. When entering/scanning a section, **register each such
  pre-existing glossary link's surface as already-linked for that section** so this plugin
  does **not** add a second link for the same surface in the same section. (The ancestor
  guard already prevents rewriting *inside* the existing link; this is the additional rule
  that stops a *later* plain occurrence in the same section from being linked twice.)
- Walk `paragraph`/`text` nodes in document order; the section counter advances as H2s are
  encountered.
- **Files**: `src/lib/remark/glossary-autolink.internal.ts` (new).
- **Validation**: unit tests — (a) two H2 sections each mentioning "cargo" twice → exactly two
  links (one per section), at the first mention each; (b) a section containing a
  `:term`-produced `data-glossary-term="cargo"` link followed by a plain "cargo" → **exactly
  one** link total in that section (the `:term` one consumed the slot).

### T014 — Eligibility guard + opt-outs
- **Ancestor guard** (FR-006): never rewrite a text node when any ancestor is `code`,
  `inlineCode`, `heading`, or `link`. (Frontmatter is stripped before remark — the deck-split
  precedent — so no frontmatter guard is needed.)
- **Whole-word, case-insensitive** (FR-006): match on word boundaries; a substring inside a
  larger word never matches; natural-prose capitalization ("Cargo", "cargo") both link.
- **Opt-outs before any rewrite** (FR-008): honor the **ignore-list** (surfaces never linked)
  and the per-page **`glossary_autolink: false`** — read from
  `file.data.astro.frontmatter.glossary_autolink`; when `false`, the whole plugin is a no-op
  for that page.
- **Files**: `glossary-autolink.internal.ts`.
- **Validation**: unit tests — a term inside `` `code` `` / a heading / an existing link is
  never linked; "policyholder" does not match "policy"; a page with
  `glossary_autolink: false` gets zero links.

### T015 — Emit the shared link node + unresolved warning
- For an eligible surface, call WP02's `resolveSurface`:
  - `link` → split the text node and insert a `link` mdast node to
    `/glossary/<context>/#<anchor>` carrying `data.hProperties`:
    `target="_blank"`, `rel="noopener"`, `data-glossary-term=<termName>`,
    `data-glossary-context=<context>` (FR-009 link half; the marker the WP06 island keys on).
  - `unresolved` → **do not link**; emit **one** `file.message` per **distinct** unresolved
    surface **per page**, in the exact stable form
    `[glossary] unresolved collision "<name>" in <ctxA>, <ctxB> — left unlinked` (NFR-007);
    the build still exits 0.
  - `none` → leave the text unchanged.
- **Files**: `glossary-autolink.ts` (wrapper) + `glossary-autolink.internal.ts`.
- **Validation**: unit test — a single-candidate term links with the right href + attrs; an
  unresolved "policy" on a context-less page stays text and emits exactly one warning even if
  it appears three times.

### T016 — Expose `computePageLinks` (the shared links-used mechanism) + deck no-op
- **Factor the core as a pure function** `computePageLinks(tree, pageContext, index,
  ignoreList) → { tree, linksUsed }` in `glossary-autolink.internal.ts`. It does the
  first-per-section walk + guards + rewrite, and returns `linksUsed` = the **deduped, ordered
  `GlossaryLinkUsed[]`** (`{ surface, context, anchor, termName }`, distinct by term)
  collected by **scanning every `data-glossary-term` node in the final tree** — so it includes
  BOTH this plugin's links and the pre-existing `:term` links (WP05 runs first in the pinned
  order), or `:term` links vanish from the "On this page" block (FR-010, post-squad A-2). This
  is the **one** function WP07's render-time re-derive also calls (over `entry.body`) — do NOT
  publish to `file.data.astro.frontmatter` (the ADR-0025 frontmatter channel is **retired**:
  the schema strips undeclared keys and `entry.data` freezes at load, so it is unreadable —
  post-squad A-1). The remark wrapper (`glossary-autolink.ts`) just calls `computePageLinks`
  and swaps in the rewritten `tree`.
- **Deck no-op** (AS-1/AS-4): early-return the whole transformer when
  `file.data.astro.frontmatter.kind === 'Presentation'` (mirror `deck-split.ts`). A deck is
  not auto-linked (`:term` still works there — WP05).
- **Presence-gate**: if the shared index is empty/absent, early-return (corpus byte-identical).
- **Files**: `glossary-autolink.ts` + `glossary-autolink.internal.ts`.
- **Validation**: unit test — `computePageLinks` `linksUsed` includes a pre-existing
  `data-glossary-term` (`:term`) node's surface as well as its own; deduped; a
  `kind: Presentation` page is untouched; `linksUsed` order is stable across two runs (NFR-004).

### T017 — Unit tests
- `src/tests/glossary-autolink.test.ts` (Astro-free, vitest): drive the internal transformer
  over hand-built mdast trees covering section-walk counts, every guard exclusion, the
  ignore-list + `glossary_autolink: false` opt-outs, warning multiplicity (one per distinct
  term per page), the emitted link node shape, and links-used dedup/order.
- **`:term` coupling cases (WP04↔WP05)**: a section with a pre-existing `data-glossary-term`
  link node followed by a plain occurrence of the same surface → one link total; and
  `glossary_links_used` includes the `:term` link's entry (both-sources collection). Build the
  `:term` link node in the fixture tree to mirror WP05's exact shape.
- Use a small stub `SharedTermIndex` (import the type from `src/lib/glossary/types.ts`) —
  do not depend on WP01's loader at runtime in the test.

## Branch Strategy

Planning branch: `feat/glossary`. Final merge target: `feat/glossary`. **Depends on WP02**
(which depends on WP01). `approved ≠ merged`: as the first implementation step, merge the
approved dependency lane(s) into your lane so `src/lib/glossary/{types,resolve,anchor}.ts`
are present — e.g. `git merge --no-edit kitty/mission-glossary-01M0YCHB-lane-<dep>`; resolve
any `kitty-specs/**` coordination-file conflicts with `--ours` (see the lane-hygiene note).
Scope the reviewer to this WP's own three files. Implement with
`spec-kitty agent action implement WP04 --agent claude`.

## Definition of Done

- First-eligible-per-H2-section linking; pre-first-H2 implicit section; H3+ nested — all
  unit-proven.
- Guards: never in code/heading/link; whole-word case-insensitive; ignore-list +
  `glossary_autolink: false` honored.
- Link node carries `target=_blank`, `rel=noopener`, `data-glossary-term/-context`.
- Unresolved collision → plain text + exactly one greppable warning per distinct term per
  page; exit 0.
- `glossary_links_used` published to `remarkPluginFrontmatter` (presence-gated), deduped,
  stable order; deck no-op; index-absent no-op.
- `ci-ok` green; corpus byte-identical (plugin registered by nobody yet).

## Risks / Reviewer guidance

- **Thin wrapper**: all resolution is WP02's resolver — reject any collision/alias logic
  re-implemented here (D1/D6). The wrapper only walks + guards + rewrites + publishes.
- **Warning multiplicity**: one per *distinct* surface per page — a term repeated across
  sections still warns once. Verify the dedup key.
- **Case-insensitivity**: confirm "Cargo" links (rev 2 T-01) and "policyholder" does not
  (whole-word).
- **Deck guard**: confirm a `kind: Presentation` page is completely untouched.
