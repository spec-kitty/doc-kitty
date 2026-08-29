---
work_package_id: WP09
title: Crosslink ids — precedence, span, and resolution verification (test-only)
dependencies:
- WP08
requirement_refs:
- FR-007
- FR-008
- C-005
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T036
- T037
- T038
history:
- '2026-08-29: authored by /spec-kitty.tasks'
authoritative_surface: src/tests/markua-crosslink.test.ts
create_intent:
- src/tests/markua-crosslink.test.ts
execution_mode: code_change
owned_files:
- src/tests/markua-crosslink.test.ts
agent_profile: implementer-ivan
agent: claude
model: sonnet
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (FR-007, FR-008;
US3; C-005), [../data-model.md](../data-model.md) (§"Id precedence rule" + coverage rows 27–31),
[../research.md](../research.md) (D-06 — explicit-id-wins is **native and proven**; the
`rehype-slug`-not-needed divergence), [../contracts/attribute-list-plugin.md](../contracts/attribute-list-plugin.md)
(the id/span write this WP verifies — owned by WP08), and
`docs/adr/0030-markua-preprocess-to-directive.md` (Risks — explicit-id precedence). The parser is
owned **whole by WP08**; this WP is **verification only** and must **not** edit
`markua-attributes*.ts` or any source.

## Objective

**Verify** crosslink-id behaviour — the concern the plan pins as **TEST + span + resolution
ONLY** (parser owned by WP08), fixing the earlier IC-01/IC-04 file overlap. Three things are
proven, none of which re-edits the parser:

1. **Explicit-id precedence (C-005, US3 sc.3)** — an explicit `{#id}`/`{id: …}` **wins** over the
   auto-generated heading id on collision. This is **native and proven**: Astro's
   `rehypeHeadingIds` (runs last) assigns a slug **only when `node.properties.id` is not already a
   string** (`rehype-collect-headings.js:52`). No `rehype-slug`, no ordering shim.
2. **Span forms (US3 sc.2)** — `[span]{#id}` and trailing `word{#id}` produce a `<span id>` that
   a `[text](#id)` link resolves to (WP08 writes these; this WP asserts the shape).
3. **Auto-id preserved (FR-008, US3 sc.4)** — a heading with **no** Markua id syntax still
   receives its auto-generated anchor exactly as today.

This WP owns a **single test file** (`src/tests/markua-crosslink.test.ts`). The **render-time
crosslink resolution** assertions (a `[text](#id)` link actually reaching the target in a built
page — coverage rows 27–31 at the DOM level) live in **WP10's a11y/render lane** (they need the
live corpus); this WP owns the **unit-level** precedence + span + auto-id proofs against WP08's
attribute plugin.

> **Boundaries.** No source edit — this WP adds one test file. It does **not** touch
> `markua-attributes*.ts` (WP08), `config.ts` (WP08), or any plugin. If a test reveals a parser
> bug, that fix is a WP08 change, not this WP's.

## Subtasks

### T036 — Span-form + block-id shape unit tests
- Create `src/tests/markua-crosslink.test.ts` importing WP08's attribute-list plugin
  (`markua-attributes*.ts`) and driving it over synthetic mdast:
  - `[is lorem]{#lorem}` → `<span id="lorem">is lorem</span>` (bracketed span form).
  - `This is ipsum{#ipsum}.` → `<span id="ipsum">ipsum</span>` around the preceding token
    (trailing word form, US3 sc.2).
  - `{#intro}` above a heading → the heading node carries `hProperties.id = "intro"` (block-id
    form, US3 sc.1). `{id: foo}` above a heading → `hProperties.id = "foo"`.
  - a non-id key on a span (e.g. `[x]{title: y}`) → ignored (only `id`/`#id` honoured on a span).
- **Files**: `markua-crosslink.test.ts` (span + block section, ~80 lines).
- **Validation**: `pnpm test` green.

### T037 — Explicit-id-wins precedence — RUN the real heading-id pass (no citation escape hatch)
- Prove **precedence** by **running the pinned `@astrojs/markdown-remark@6.3.11`
  `rehypeHeadingIds` pass** over a real tree (D-06). A memory-only / citation-only proof is
  **not permitted** — the assertion must exercise the actual pass, not assert the documented rule.
  - Construct **one tree** carrying **both**: (a) a heading with an explicit **colliding**
    `{#overview}` written to `hProperties.id = "overview"` (whose auto-slug would *also* be
    `overview`), and (b) a **sibling plain heading** with no Markua id whose text auto-slugs.
  - **Import and run** the pinned Astro `rehypeHeadingIds` over that tree (the same pass the
    build uses), then assert **both** on the resulting tree:
    - **(a)** the explicit heading's id is still exactly `overview` — **unchanged** (the explicit
      id **wins**, US3 sc.3, C-005); and
    - **(b)** the sibling plain heading **received an auto-slug** id (FR-008 — auto-id still
      works for a no-syntax heading).
  - Both assertions run on the **same tree** in the **same test**, so the proof is that the real
    pass leaves an explicit id alone *while* still slugging a plain one — not two separate claims.
    (Cite `rehype-collect-headings.js:52` in a comment for the reader, but the **passing test is
    the running pass**, never the citation.)
- **Files**: `markua-crosslink.test.ts` (precedence section, ~70 lines).
- **Validation**: `pnpm test` green; the test **imports and executes** the pinned
  `rehypeHeadingIds` — a reviewer can confirm the pass is actually invoked, not described.

### T038 — Resolution scope note + hand-off to WP10
- Document (a test-file header comment) the **resolution scope split**: `[text](#id)` crosslink
  **resolution** is plain CommonMark (the link syntax is not Markua), and asserting a link
  actually **reaches** the target in a rendered page (coverage rows 27–31 at the DOM level) is a
  **render assertion owned by WP10's a11y/render lane** — this WP owns the **unit-level**
  precedence + span-shape + auto-id proofs. This keeps IC-04 verification-only and avoids
  duplicating WP10's live-corpus assertions.
- Add a short assertion (or documented expectation) that the span/heading `id`s this WP proves
  are exactly the anchors WP10's fixture links (`[go](#intro)`, `[span](#ipsum)`) target — so the
  two lanes are consistent.
- **Files**: `markua-crosslink.test.ts` (header comment + consistency note).
- **Validation**: `pnpm test` green; the scope split is explicit.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**Depends on WP08** (imports the attribute-list plugin it verifies). Implement with
`spec-kitty agent action implement WP09 --agent claude`.

## Definition of Done

- `src/tests/markua-crosslink.test.ts` proves: span forms (`[text]{#id}`, `word{#id}`) → `<span
  id>`; block `{#id}`/`{id:}` → `hProperties.id`; **explicit-id-wins** precedence proven by
  **running the pinned `rehypeHeadingIds` pass** over a single tree carrying a colliding explicit
  `{#overview}` **and** a sibling plain heading, asserting **both** (explicit id survives
  unchanged **and** the plain heading gets an auto-slug) — **no citation-only / memory-only proof
  is accepted**; and **auto-id preserved** for a no-syntax heading (FR-008).
- The test-file documents that render-time crosslink **resolution** (DOM rows 27–31) is WP10's,
  and that the anchors it proves match WP10's fixture links.
- **No source edit** — only this test file changes; `markua-attributes*.ts`/`config.ts` are
  untouched. `ci-ok` green.

## Risks / Reviewer guidance

- **Verification-only** — this WP owns one test file and **must not** edit the parser (WP08) or
  any source. A source diff here is a finding (this is the IC-01/IC-04 overlap the plan fixed).
- **Precedence must RUN the real pass — the citation escape hatch is removed** — the test must
  **import and execute** the pinned `@astrojs/markdown-remark@6.3.11` `rehypeHeadingIds` over the
  tree and assert both directions on the same tree; asserting the documented
  `properties.id`-already-set rule from memory (or a hand-rolled slugger, or a citation alone) is
  a **vacuous proof and a finding**. Reviewer: confirm the pinned pass is actually invoked.
- **Don't duplicate WP10** — render-time resolution is WP10's lane; keep this unit-level so the
  two do not drift.
- **FR-008 both directions** — assert an explicit-id heading keeps its id **and** a plain heading
  still gets an auto id on the same tree.
