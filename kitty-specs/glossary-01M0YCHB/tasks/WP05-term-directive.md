---
work_package_id: WP05
title: :term directive (remark-directive)
dependencies:
- WP02
requirement_refs:
- FR-011
planning_base_branch: feat/glossary
merge_target_branch: feat/glossary
branch_strategy: Planning artifacts for this mission were generated on feat/glossary. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary unless the human explicitly redirects the landing branch.
subtasks:
- T018
- T019
- T020
- T021
history:
- '2026-08-26: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/remark/glossary-term.ts
create_intent:
- src/lib/remark/glossary-term.ts
- src/tests/glossary-term.test.ts
execution_mode: code_change
owned_files:
- src/lib/remark/glossary-term.ts
- src/tests/glossary-term.test.ts
- package.json
- pnpm-lock.yaml
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md), [../research.md](../research.md) (the supply-chain evidence table),
[../contracts/autolink-and-term.md](../contracts/autolink-and-term.md), and
`docs/adr/0027-auto-link-resolution-scoping-and-term-directive.md`.

## Objective

Add the `:term[text]{context=<ctx>}` escape hatch (FR-011). It parses via **`remark-directive`
+ `mdast-util-directive`** (new **pinned** dependencies, AS-2), resolves against the
**explicit** context through WP02's resolver, and emits the **same link node shape** the
auto-linker (WP04) produces — so the hover island, no-JS fallback, and links-used treat both
uniformly. A `link=false` form suppresses. All logic is Astro-free + vitest.

**This WP is DORMANT** — WP08 registers `remark-directive` and this plugin **before** the
auto-linker; until then the corpus is byte-identical.

## Subtasks

### T018 — Pin the directive dependencies + supply-chain evidence
- Add `remark-directive` and `mdast-util-directive` to `package.json` at **exact** versions
  (no `^`); `pnpm install`; commit the resulting `pnpm-lock.yaml`.
- Record the **supply-chain evidence** in the handoff note (per `research.md`): both are
  mainstream `unified`/`syntax-tree` org packages, registry-authentic, no install-time
  lifecycle scripts of concern; deny-by-default `preinstall`/`install`/`postinstall`; Node
  Active LTS. Confirm the peer range admits Astro 5.2's unified.
- **Files**: `package.json`, `pnpm-lock.yaml`.
- **Validation**: `pnpm install --frozen-lockfile` is clean; versions are exact-pinned.

### T019 — `:term` → shared link node via explicit context; `link=false` suppress
- `src/lib/remark/glossary-term.ts`: a remark plugin that runs **after** `remarkDirective`
  has parsed `:term[...]{...}` into a `textDirective` node named `term`.
- For each `term` directive: read `attributes.context` and the child text; call WP02's
  `resolveSurface(text, attributes.context, index, ignoreList)` **forcing** the explicit
  context (it overrides collision ambiguity and false positives). On a `link` result, replace
  the directive with the **same** `link` node shape WP04 emits (`/glossary/<context>/#<anchor>`,
  `target="_blank"`, `rel="noopener"`, `data-glossary-term`, `data-glossary-context`).
- `:term[text]{link=false}` → render `text` as a plain text node (sanctioned suppress).
- **Files**: `src/lib/remark/glossary-term.ts` (new).
- **Validation**: unit test — `:term[policy]{context=hr}` links to `/glossary/hr/#policy`;
  `:term[cargo]{link=false}` renders bare text.

### T020 — Counts-as-used, counts-as-first-eligible, unknown-context warning
- A resolved `:term` link **counts as a used link** via **one sanctioned mechanism**: it emits
  the same `data-glossary-term`/`data-glossary-context` link node the auto-linker emits, and
  WP04's `computePageLinks` collects links-used by **scanning every `data-glossary-term` node
  in the tree** (WP04 T016). Do **not** invent a separate `file.data` list — the tree scan is
  the single source (post-squad L-3).
- A `:term` occurrence **counts as the section's first eligible** for its surface, so the
  auto-linker does **not** add a second link for the same surface in that section (the
  auto-linker sees the already-present `link` node via its ancestor/existing-link guard).
- Unknown or missing `context` → emit a `file.message` **warning** (not fatal), consistent
  with the skip-and-warn posture.
- **Files**: `glossary-term.ts`.
- **Validation**: unit test — a `:term` for "cargo" in a section suppresses a later auto-link
  of "cargo" in that section; `:term[x]{context=nope}` warns, does not throw.

### T021 — Unit tests
- `src/tests/glossary-term.test.ts` (Astro-free, vitest): force-link, suppress (`link=false`),
  collision-resolved-by-explicit-context, unknown-context warning, and the node shape parity
  with WP04's link node. Use a stub `SharedTermIndex` (type from `src/lib/glossary/types.ts`).

## Branch Strategy

Planning branch: `feat/glossary`. Final merge target: `feat/glossary`. **Depends on WP02**
(→ WP01). `approved ≠ merged`: merge the approved dependency lane(s) into your lane first so
`src/lib/glossary/{types,resolve}.ts` exist; resolve `kitty-specs/**` conflicts with `--ours`.
`package.json`/`pnpm-lock.yaml` are owned **only** by this WP (avoids overlap with other WPs).
Implement with `spec-kitty agent action implement WP05 --agent claude`.

## Definition of Done

- `remark-directive` + `mdast-util-directive` exact-pinned; lockfile committed; supply-chain
  evidence recorded; peer range OK.
- `:term[text]{context=…}` emits the exact WP04 link node via the explicit context;
  `link=false` suppresses.
- `:term` counts as used + as the section's first eligible; unknown context warns (not fatal).
- `ci-ok` green; corpus byte-identical (plugin registered by nobody yet).

## Risks / Reviewer guidance

- **Node-shape parity**: the `:term` link node MUST match WP04's exactly (href, `target`,
  `rel`, `data-glossary-*`) or the island/links-used will treat them differently. Diff the two.
- **Ordering dependency**: this only works if WP08 registers `remarkDirective` →
  `glossary-term` → `glossary-autolink`; note that contract in the handoff for WP08.
- **Supply-chain**: exact pins, no `^`; confirm no lifecycle scripts of concern.
