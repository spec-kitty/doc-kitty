---
work_package_id: WP06
title: ToC heading-exclusion demotion rehype pass (bounded spike)
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-008
- NFR-004
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T021
- T022
- T023
- T024
history:
- '2026-08-29: authored by /spec-kitty.tasks'
authoritative_surface: src/lib/rehype/markua-toc-demote.ts
create_intent:
- src/lib/rehype/markua-toc-demote.ts
- src/tests/markua-toc-demote.test.ts
execution_mode: code_change
owned_files:
- src/lib/rehype/markua-toc-demote.ts
- src/tests/markua-toc-demote.test.ts
agent_profile: frontend-freddy
agent: claude
model: opus
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (FR-001 —
internal headings out of the ToC; FR-008; US1 sc.2), **the pinned mechanism** in
[../contracts/callout-mapping.md](../contracts/callout-mapping.md) (§"Heading exclusion from the
table of contents (bounded spike)"), [../research.md](../research.md) (D-03 ToC note, the
"second bounded spike"), `docs/adr/0030-markua-preprocess-to-directive.md` (Risks — ToC
exclusion), and the existing rehype pattern `src/lib/rehype/diagram-figure.ts` (hand-rolled hast
walk, no `unist-util-visit`).

## Objective

Implement the **ToC heading-exclusion demotion pass** — the **second bounded spike** of the
mission (the first being the IC-01 mdast wiring). There is **no native hook**: Starlight's
`rehypeCollectHeadings` collects **every** ATX heading unconditionally, and neither Starlight nor
Astro offers an aside-heading exclusion. The ratified mechanism (contract) is **demotion**: a
doc-kitty **user rehype pass that runs before `rehypeHeadingIds`** (and before
`rehypeCollectHeadings`) and, for any ATX heading inside a callout/aside container, demotes the
`<h_n>` to a **non-heading element carrying `role="heading"` + `aria-level="{n}"`** — so
`rehypeCollectHeadings` no longer sees an `h_n` and omits it from the on-this-page nav, while
assistive tech still announces it as a heading at the right level (WCAG 2.2 AA preserved,
NFR-004).

This WP is **dormant** until WP08 registers it (as a user rehype plugin, ordered **before**
`rehypeImages`/`rehypeHeadingIds`) and WP10 flips the preset — it changes no rendering here and
keeps the corpus byte-identical. It is a **pure hand-rolled hast pass** in
`markua-toc-demote.ts`, unit-tested on synthetic hast.

> **Boundaries.** This WP does **not** map callouts (WP04), style them (WP05), or wire the
> pipeline (WP08). It only demotes in-container headings. The **integration proof** (the ToC
> genuinely omits the heading in a real build, and the document outline stays intact) lands in
> WP10's a11y lane — this WP owns the unit-level proof of the demotion node shape + ordering.

## Subtasks

### T021 — The demotion rehype pass (`markua-toc-demote.ts`)
- Create `src/lib/rehype/markua-toc-demote.ts` — a user rehype plugin with a hand-rolled hast
  walk (no `unist-util-visit`, repo convention):
  - Identify **callout/aside containers** in the hast: Starlight native asides (rendered by
    `remarkAsides` at the remark stage — e.g. `aside.starlight-aside` / the aside class the
    pinned Starlight version emits) **and** the doc-kitty theme callout containers (the
    `dk-callout`-class element WP04/WP05 produce). Match on a small, explicit selector set;
    document each matched container class.
  - For each `<h1>`…`<h6>` **inside** such a container, demote it: replace the `h_n` element with
    a `<p>` (or `<div>`) that carries `role="heading"` and `aria-level="{n}"`, preserving the
    heading's children (text/inline) and any existing `id`.
  - Headings **outside** any callout/aside container are **untouched** (they keep their normal
    ToC + auto-id behaviour, FR-008).
- **Files**: `markua-toc-demote.ts` (~90 lines).
- **Validation**: T024 (in-container demoted; outside untouched; nested containers).

### T022 — Ordering + accessibility preservation
- **Ordering (load-bearing)**: the pass must run **before** `rehypeHeadingIds` and
  `rehypeCollectHeadings` — as a **user rehype plugin** it naturally precedes them in Astro's
  fixed rehype order (research divergence: USER rehype → `rehypeImages` → `rehypeHeadingIds`).
  WP08 registers it in that stage; document the requirement in a file-top comment so a future
  reorder is caught. A heading demoted *after* collection would still appear in the ToC — the
  exact failure this guards.
- **Accessibility**: the demoted node keeps `role="heading"` + `aria-level="{n}"` so the
  **document outline stays intact** for assistive tech; only the *visual on-this-page index*
  loses the entry. Preserve an explicit `{#id}` if the heading carried one (do not strip anchors
  authors set).
- **Files**: `markua-toc-demote.ts` (ordering comment + a11y attrs).
- **Validation**: T024 asserts `role`/`aria-level`/level `n` and id preservation.

### T023 — Spike disposition: prove-early-enough + fallback note
- This is a **bounded spike** — record its disposition in a file-top comment and in the WP
  completion note:
  - Prove (via T024 unit + a note pointing at WP10's build/a11y proof) that the pass runs early
    enough that `rehypeCollectHeadings` omits the demoted heading, and that the demoted node
    keeps its `role`/`aria-level`.
  - **Fallback (documented author limit)**: if demotion proves fragile in the real pipeline
    (e.g. Starlight collects at a stage the user pass cannot precede), fall back to restricting
    aside/callout bodies to **non-ATX-heading content** — a documented limit surfaced in the
    author doc (WP11). Demotion is the **ratified default** because it preserves author-written
    headings; only adopt the fallback if WP10's integration proof shows demotion cannot work,
    and record that outcome.
- **Files**: `markua-toc-demote.ts` (disposition comment).
- **Validation**: the spike outcome (demotion works / fallback adopted) is recorded on
  completion; WP10 carries the integration assertion.

### T024 — Vitest (`markua-toc-demote.test.ts`)
- Create `src/tests/markua-toc-demote.test.ts` on **synthetic hast**:
  - a heading inside a theme-callout container → demoted to `role="heading"` + `aria-level` with
    the right level `n` and children preserved;
  - a heading inside a native-aside container → demoted the same way;
  - a heading **outside** any container → **untouched** (still an `h_n`, keeps ToC eligibility,
    FR-008);
  - a **nested** callout with a heading → demoted once, correctly;
  - a heading carrying an explicit `id` inside a callout → demoted **and** the `id` preserved.
- **Files**: `markua-toc-demote.test.ts` (~70 lines).
- **Validation**: `pnpm test` green; `astro check`/`tsc` clean.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**Depends on WP01**. Authored independently on synthetic hast; WP08 registers it in the user
rehype stage, WP10 proves ToC omission in a real build. Implement with
`spec-kitty agent action implement WP06 --agent claude`.

## Definition of Done

- `markua-toc-demote.ts` demotes ATX headings inside callout/aside containers to
  `role="heading"` + `aria-level` non-heading elements, preserving children and explicit ids,
  and leaves outside-container headings untouched (FR-008).
- The pass is documented as a **user rehype plugin that must run before
  `rehypeHeadingIds`/`rehypeCollectHeadings`** (WP08 registers it there).
- The spike disposition (demotion works / fallback) is recorded; WP10 owns the integration proof.
- `markua-toc-demote.test.ts` covers theme-callout, native-aside, outside, nested, and
  id-preservation cases.
- **No wiring** (`config.ts` untouched — WP08); corpus byte-identical. `ci-ok` green on units.

## Risks / Reviewer guidance

- **Ordering is the spike's crux** — the pass MUST precede heading collection; a demotion after
  collection is a vacuous pass (the heading still shows in the ToC). Reviewer: confirm the
  file-top comment pins the user-rehype-before-`rehypeHeadingIds` requirement and WP08 honours
  it.
- **A11y preserved, not removed** — the demoted node must keep `role="heading"` + `aria-level`;
  simply deleting the heading or dropping the role fails WCAG 2.2 AA (NFR-004).
- **Match the real container classes** — the selector set must match what WP04/WP05 emit **and**
  the pinned Starlight aside class; a wrong selector silently demotes nothing (or demotes real
  page headings). Ground the selectors against WP04/WP05 output and Starlight 0.32.6.
- **Bounded spike** — if demotion cannot precede collection in the real pipeline, adopt the
  documented non-ATX-heading fallback and record it (do not ship a silently-broken ToC).
