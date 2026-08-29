---
work_package_id: WP02
title: Block-detection normaliser (line-prefix + wrapper → containerDirective)
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-004
- FR-012
- C-001
- C-002
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T004
- T005
- T006
- T007
- T008
history:
- '2026-08-29: authored by /spec-kitty.tasks'
authoritative_surface: src/lib/remark/markua-normalise
create_intent:
- src/lib/remark/markua-normalise.internal.ts
- src/lib/remark/markua-normalise.ts
- src/tests/markua-normalise.test.ts
execution_mode: code_change
owned_files:
- src/lib/remark/markua-normalise.internal.ts
- src/lib/remark/markua-normalise.ts
- src/tests/markua-normalise.test.ts
agent_profile: frontend-freddy
agent: claude
model: opus
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (FR-001,
FR-004, FR-012; US1 + Edge Cases), [../plan.md](../plan.md) (IC-01 substrate, the mdast spike),
**the pinned contract** [../contracts/normaliser-block-detection.md](../contracts/normaliser-block-detection.md)
(this WP implements it verbatim), [../contracts/callout-mapping.md](../contracts/callout-mapping.md)
(the class→directive-name table), and `docs/adr/0030-markua-preprocess-to-directive.md`. Study
the repo's existing `*.internal.ts` split and hand-rolled walks:
`src/lib/remark/diagram-meta.internal.ts` + `diagram-meta.ts` and
`src/lib/remark/deck-split.internal.ts` + `deck-split.ts`.

## Objective

Build the **core of the shared substrate**: the block-detection normaliser that compiles Markua
**line-prefix runs** (`A>` asides and the `B> C> D> E> I> Q> T> W> X>` callout shorthands) and
the **`{aside}…{/aside}` / `{blurb, class: …}…{/blurb}` wrappers** into `remark-directive`
**`containerDirective`** nodes, implementing
[`contracts/normaliser-block-detection.md`](../contracts/normaliser-block-detection.md)
**exactly**. It is an **mdast-level remark plugin** (the ratified route, ADR-0030 / research
D-02): the pure state machine lives in `markua-normalise.internal.ts` (Astro-free, vitest-
covered), and the thin `markua-normalise.ts` is the remark-plugin wrapper that reads
paragraph/code node values and rewrites the tree.

This WP is **dormant** until WP08 wires it into `config.ts` and WP10 turns the example preset
on — it registers nothing and imports into no pipeline here, so the corpus stays
**byte-identical** (NFR-001/FR-011) and `ci-ok` is green on unit tests alone. The normaliser is
**total** (`contracts` Guarantees): every input produces valid output; **no input throws or
fails the build** (FR-012, NFR-002). It emits directive *names* per the callout-mapping table
(`:::aside`/`:::tip`/`:::caution`/`:::danger`/`:::note`/`:::discussion`/…) but does **not**
decide Starlight-vs-theme routing — that is WP04.

> **Boundary with WP08 (attribute-list plugin).** This WP recognises the wrapper markers and
> emits the container; it does **not** parse or attach `{key: value}` attribute lists — that is
> the attribute-list plugin (WP08), which runs *after* the normaliser on the same tree. The one
> point of contact is the **attr-above-wrapper** rule: this WP emits the container so the
> attribute-list paragraph ends up *immediately preceding* it; WP08 then attaches the id/class.
> Do not attach attributes here (contract "Attribute list above a wrapper open").

## Subtasks

### T004 — Line classifier + fence-state machine (`markua-normalise.internal.ts`)
- Create `src/lib/remark/markua-normalise.internal.ts` (Astro-free). Model the **line-level**
  classifier the contract pins, operating on reconstructed line text:
  - `classifyLine(line, insideFence)` → one of `fence-toggle` | `line-prefix` | `wrapper-open`
    | `wrapper-close` | `ordinary`, tracking the single piece of state `insideFence`.
  - **Fence toggle**: a line matching ```` ``` ```` or `~~~` (CommonMark opening/closing fence).
    Flips `insideFence`. **While inside a fence, no other rule fires** — every line passes
    through verbatim (this is the correctness core of `fence-suppresses-line-prefix`).
  - **Line-prefix**: outside a fence, `^([A-Z])>(\s|$)` where the capture ∈
    `A B C D E I Q T W X`. A letter outside that set (e.g. `Z>`) is **ordinary**. The `^` anchor
    means `see W> in the manual` mid-sentence is ordinary (contract "look-alike in prose").
  - **Wrapper open**: outside a fence, trimmed content `{aside}` or `{blurb, class: <name>}` or
    bare `{blurb}` (tolerate whitespace inside braces).
  - **Wrapper close**: outside a fence, trimmed content `{/aside}` or `{/blurb}`.
- Export the recognised-letter set and the family mapping (`A`→aside; `B`→generic; the rest →
  their callout class) as named constants so WP04's mapping and the vitest reuse them.
- **Files**: `markua-normalise.internal.ts` (classifier section, ~90 lines).
- **Validation**: unit-covered in T008 (classifier cases). Edge: a fence indented ≤3 spaces is
  still a fence; a `>` at line start (`> quote`) is **ordinary** here (real blockquote — never
  a Markua line).

### T005 — Line-prefix run recognition, termination, inner-content compile
- In `markua-normalise.internal.ts`, implement run detection over the classified lines:
  - A **run** starts at the first line-prefix line of a family and extends across consecutive
    lines that are **either** a line-prefix line of the **same family** **or** a bare prefix
    marker on its own (`A>` with nothing after — a blank line *within* the aside).
  - It **ends** at the first line that is neither: an ordinary line, a blank no-prefix line, a
    wrapper marker, a fence toggle, or EOF.
  - **Mixing families does not extend a run** (`A>` does not continue a `W>` run; a new family
    starts a new run).
  - **Inner content**: strip the prefix (`X>` + the single following space if present) from
    every line, join the remainder as the block's inner Markdown. That inner Markdown is
    **compiled normally** — so `A> # A longer aside` yields a real heading inside the aside, and
    a fenced block written inside an `A>` run is preserved.
  - **Output**: one `containerDirective` per run — name `aside` for `A`, else the callout-class
    name from the callout-mapping table for that family — wrapping the compiled inner content.
- **Inner compile mechanism**: re-parse the stripped inner Markdown to mdast children (reuse the
  repo's already-pinned `remark-parse`/`unified` the way existing transforms do; hand-roll, no
  new dependency — research supply-chain). Attach the produced children under the container.
- **Files**: `markua-normalise.internal.ts` (run section, ~120 lines).
- **Validation**: T008 `blank-line-run` (heading survives, blank `A>` does not end the run) and
  the family-mix case.

### T006 — Wrapper recognition: balanced nesting, attr-above-wrapper, unbalanced degradation
- Implement wrapper handling in `markua-normalise.internal.ts`:
  - A wrapper opens on `{aside}`/`{blurb…}` and closes on the matching `{/aside}`/`{/blurb}`;
    the body is every line between.
  - **Nestable, balanced**: track an open-count **per wrapper type**; an inner `{aside}` inside
    an outer `{aside}` increments the count; the outer closes only on the `{/aside}` that returns
    the count to **zero** (balanced matching, **not first-close-wins**).
  - `{blurb, class: <name>}` carries its class onto the emitted directive; bare `{blurb}` is the
    generic blurb.
  - **Body compilation**: compile the wrapper body as normal Markdown (it may itself contain
    line-prefix runs, images, nested wrappers, fenced code), then wrap in the container for the
    wrapper's type/class.
  - **Attr-above-wrapper (H)**: an attribute-list line (`{#id}` / `{class: …}`) **immediately
    above** a wrapper-open consumes the wrapper open/close lines into the container **but leaves
    the attribute-list paragraph as the immediately-preceding sibling** so WP08's attribute-list
    plugin (running after) attaches it to the container. Do **not** consume or interpret the
    attribute list here.
  - **Unbalanced degradation**: a wrapper-open with no matching close (or a stray close with no
    open) does **not** break the page — the unmatched marker line is left as **literal text** and
    surrounding content renders normally. **Never throw** (FR-012, NFR-002).
- **Files**: `markua-normalise.internal.ts` (wrapper section, ~110 lines).
- **Validation**: T008 `nested-wrapper`, `unbalanced-degrades`, `attr-above-wrapper`.

### T007 — The mdast remark-plugin wrapper (`markua-normalise.ts`) + fence/blockquote safety
- Create `src/lib/remark/markua-normalise.ts` — the thin unified/remark plugin:
  - A hand-rolled tree walk (no `unist-util-visit` dependency — repo convention, research
    divergence) over the parsed mdast. **Only** `paragraph` and `code` node values are ever
    candidates for conversion; a real `blockquote` node and a fenced `code` node are already
    distinct node types, so **fence and blockquote avoidance largely falls out for free** at
    this level (contract "Avoiding adjacent CommonMark", research D-02).
  - Reconstruct line text from paragraph/code node values, run the T004–T006 state machine, and
    splice the resulting `containerDirective` node(s) back into the parent's children in place of
    the source paragraph(s).
  - Emit `containerDirective` nodes shaped for `remark-directive`@4.0.0 /
    `mdast-util-directive`@3.1.0 (the pinned versions) so downstream `remarkDirective` +
    WP04/Starlight consume them.
  - The plugin is a **no-op** on a tree with no line-prefix paragraph and no wrapper marker: a
    Markua-free page is passed through **unchanged** (FR-011, byte-identical base rendering).
- **Files**: `markua-normalise.ts` (~80 lines). **No `config.ts` edit** — wiring is WP08.
- **Validation**: T008 exercises the plugin end-to-end on mdast fixtures (parse → plugin →
  assert tree), plus the internal-only unit cases.

### T008 — Non-fakeable vitest matrix (`markua-normalise.test.ts`)
- Create `src/tests/markua-normalise.test.ts` covering the contract's **named, non-fakeable**
  cases (chosen so a shallow implementation fails):
  - **`fence-suppresses-line-prefix`** — a fenced code block whose body contains a line
    **`W> not a warning`**: the fenced block is passed through **byte-identical** and **no
    `:::caution` container is emitted** (a bare `>` inside a fence proves nothing — the trigger
    is a *letter-prefix*, so the fence must suppress an actual line-prefix line).
  - **`unterminated-fence-at-EOF`** — an opening ```` ``` ```` fence with no closing fence,
    followed by `W>` lines to EOF: `insideFence` does **not** unwind at EOF; the trailing `W>`
    lines stay inside the (unterminated) code and are **not** converted.
  - **`adjacent-blockquote`** — a real `> quote` directly beside an `A>` run: the blockquote is
    untouched (a `blockquote` node), the `A>` run becomes `:::aside`.
  - **`fence-inside-aside`** — an `{aside}` wrapper whose body holds a fenced block containing
    `>`: aside boundaries correct, code block intact (US1 sc.5).
  - **`blank-line-run`** — `A> # Heading` / `A>` / `A> para`: one aside; the internal heading
    survives; the blank `A>` line does not end the run.
  - **`three-way-equivalence`** — `W>` · `{class: warning}`+`B>` · `{blurb, class: warning}`:
    all three emit the **identical** `caution` container (FR-004). (The `{class:}` line is left
    for WP08 to fold onto the `B>` block per contract; assert the emitted directive name /
    normalised class is identical across the three.)
  - **`nested-wrapper`** — `{aside}` containing `{aside}…{/aside}`: balanced close; outer closes
    only at count zero.
  - **`unbalanced-degrades`** — `{aside}` with no `{/aside}`: the marker line stays literal; **no
    throw**; the rest renders.
  - **`attr-above-wrapper`** — `{#note}` immediately above `{aside}`: the container is emitted
    with the attribute-list paragraph left as its immediate predecessor (this WP does **not**
    attach `note`; assert the structural precondition WP08 relies on).
- Add classifier unit tests (T004): `Z>` → ordinary; `see W> here` mid-line → ordinary; `~~~`
  and ```` ``` ```` both toggle.
- **Files**: `markua-normalise.test.ts` (~140 lines).
- **Validation**: `pnpm test` green; `astro check`/`tsc` clean.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**Depends on WP01** (the ratified approach is on record). Implement with
`spec-kitty agent action implement WP02 --agent claude`.

## Definition of Done

- `markua-normalise.internal.ts` implements the pinned classifier + run + wrapper rules;
  `markua-normalise.ts` is the mdast remark plugin (hand-rolled walk, no new dependency).
- All nine named contract cases plus the classifier cases pass in `markua-normalise.test.ts`;
  `fence-suppresses-line-prefix` and `unterminated-fence-at-EOF` are **letter-prefix** cases,
  not bare-`>`.
- The normaliser is **total** — no input throws; unbalanced wrappers degrade to text.
- **No wiring** — `config.ts` untouched; the corpus is byte-identical (this code is called by
  nobody until WP08/WP10). `ci-ok` green on unit tests.

## Risks / Reviewer guidance

- **Fence suppression is the load-bearing claim** — verify the two non-fakeable cases use an
  actual `W>` letter-prefix line inside/after the fence, and that `insideFence` does not unwind
  at EOF. A bare `>`-only test is a vacuous pass and is a finding.
- **mdast-level, not string-preprocess** — the plugin operates on parsed mdast (paragraph/code
  values); a pre-parse body-string stage is unreachable (research D-02) and is a finding.
- **No attribute parsing here** — `{key: value}` handling belongs to WP08; this WP only
  recognises the wrapper *markers* and emits the container. Attaching attributes here is a
  finding (owns the WP08 boundary).
- **No new dependency** — inner-Markdown compile and the tree walk reuse the pinned
  `unified`/`remark-parse`/`remark-directive`; a new `unist-util-visit` or parser dep is a
  finding (research supply-chain).
- **Byte-identical base render** — a tree with no Markua marker must pass through unchanged.

## Activity Log

- 2026-08-29T11:26:21Z – claude – shell_pid=3616367 – Implementation complete on lane-b (commit 6114abb): markua-normalise.internal.ts + markua-normalise.ts + markua-normalise.test.ts, 27 tests green incl. non-fakeable fence cases; T004-T008 marked done. move-task --to for_review is BLOCKED by the lane guard (kitty-specs/ changes not allowed on lane branch — move-task auto-commits status.json/acceptance-matrix.json/status.events.jsonl onto lane-b and its own guard rejects them). Lane reset clean; not forcing. Needs coordination-worktree status transition.
