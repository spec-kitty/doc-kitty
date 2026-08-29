---
work_package_id: WP11
title: Author-facing subset doc + docs of record + design-readiness close
dependencies:
- WP01
requirement_refs:
- FR-014
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T045
- T046
- T047
history:
- '2026-08-29: authored by /spec-kitty.tasks'
authoritative_surface: docs/architecture/markua.md
create_intent:
- docs/architecture/markua.md
execution_mode: code_change
owned_files:
- docs/architecture/markua.md
- docs/plans/design-readiness.md
agent_profile: curator-carla
agent: claude
model: sonnet
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load curator-carla` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (FR-014;
SC-006; C-006 scope boundary — document the limits), [../plan.md](../plan.md) (IC-07 + the FR-014
acceptance hook), [../data-model.md](../data-model.md) (the construct/limits surface),
`docs/adr/0030-markua-preprocess-to-directive.md` (landed by WP01 — link it), the six
`../contracts/*.md`, and the existing `docs/plans/design-readiness.md` (find the Markua item 7 to
close). For the docs-of-record shape, read a sibling architecture doc (e.g.
`docs/architecture/glossary.md` if present, or another `docs/architecture/*.md`). Respect the
user's writing preferences (audience-oriented docs; avoid AI-writing pitfalls).

## Objective

Land the **docs of record** for the Markua subset and **close design-readiness item 7**, so the
decision and the shipped surface are documented alongside the ADR (FR-014, SC-006, charter
living-documentation). Two documents:

- **`docs/architecture/markua.md`** — the architecture doc of record: the supported subset (the
  five constructs, the callout-class → target mapping, the attribute list, the icon seed map),
  the pipeline (normaliser → attribute-list plugin → remark-directive → callout mapping / figure
  rehype / ToC-demote), the preset-opt-in activation model, and — explicitly — the **limits**
  (what will and will **not** render: the C-006 Won't list). Links ADR-0030 and the contracts.
- **`docs/plans/design-readiness.md`** — mark the Markua item (7) **closed**, pointing at
  ADR-0030 and this doc.

The **FR-014 author-facing page** in the example docsite is
`example/docs/guides/markua-showcase.md` — that page is owned by **WP10**, which gates its
**publication** (`doc_status: active` + in-sidebar + `doc-sanity`). The substantive FR-014
obligation — that it (and `markua.md`) actually **document every in-scope construct and its
limits** — is human judgment, so it is **this WP's named reviewer check** (T047), not a WP10
build gate. This WP's `markua.md` is the **internal docs of record** documenting the subset +
limits authoritatively; together with the showcase they satisfy FR-014 (author-facing page) and
SC-006 (decision recorded alongside the ADR). This WP **adds no code and changes no rendering** —
it is content that passes the `doc-sanity` gate.

This WP **runs in parallel** with the render concerns (it depends only on WP01, the ADR being on
record). It does **not** own or edit the showcase page (WP10) or the ADR (WP01).

## Subtasks

### T045 — `docs/architecture/markua.md` (supported subset + limits)
- Create `docs/architecture/markua.md` (audience: doc-kitty authors + maintainers), covering:
  - **What the subset is**: the five constructs (aside, callout, figure image, crosslink id,
    callout icon), each with its author input form(s) and rendered target — reuse the data-model
    tables (do not contradict them).
  - **The callout-class → target mapping**: the four Starlight-mapped classes vs the six theme
    classes, and the pinned **attribute tradeoff** (a mapped class carrying `{#id}`/`{icon:}`
    routes through the theme callout).
  - **The pipeline** (build-time only, no client JS): normaliser → attribute-list plugin →
    `remark-directive` → callout mapping / figure rehype / ToC-demote; the preset-opt-in
    activation (`markua: true`, the `diagrams` shape).
  - **The limits (load-bearing — C-006 Won't)**: full Markua, book/manuscript types, non-image
    resources, quizzes/exercises/definition-lists, document-settings blocks, parts/multi-file
    concatenation, layout-only attrs with no web analog (`fullbleed`, `float`), table attrs,
    inline `:fa-name:` icons — all **out of scope**; an unsupported attribute is silently ignored;
    on a plain-Markdown host, Markua lines show as literal text.
  - **Links**: ADR-0030 (`docs/adr/0030-…`), the mission contracts, the example showcase page.
- **Files**: `docs/architecture/markua.md` (~120–160 lines).
- **Validation**: `doc-sanity` (markdownlint + link check) green; links resolve.

### T046 — Close design-readiness item 7
- Edit `docs/plans/design-readiness.md`: locate the Markua design-readiness item (item 7 per the
  plan) and mark it **closed/satisfied**, pointing at `docs/adr/0030-markua-preprocess-to-directive.md`
  (the ratified approach) and `docs/architecture/markua.md` (the shipped surface). Keep the edit
  minimal and consistent with how other closed items are marked in that file.
- **Files**: `docs/plans/design-readiness.md`.
- **Validation**: `doc-sanity` green; the item reads as closed with working links.

### T047 — Reconcile docs of record + doc-sanity + FR-014/SC-006 close
- Reconcile the docs of record with the **shipped** design: ensure `markua.md`, the ADR, and the
  contracts agree (no doc claims a construct or a mapping the code does not ship; if WP06 adopted
  the non-ATX-heading fallback, reflect that limit). Cross-check the C-006 limits list against the
  spec.
- **FR-014 "documents every in-scope construct + its limits" — the NAMED REVIEWER CHECK (this
  WP owns it; it is human judgment, not a build gate)**: WP10's machine gate only checks the
  showcase page's **publication** (`doc_status: active` + in-sidebar + `doc-sanity`). The
  substantive FR-014 obligation — that the author-facing surface actually **documents every
  in-scope construct and its limits** — is **reviewer-verified here**: walk the coverage-matrix
  construct list (`data-model.md`) against the showcase page (WP10) **and** `markua.md`, and
  confirm each construct **and each C-006 limit** is documented in prose. Record this named check
  (pass/fail per construct + limits) in the WP completion; a construct or limit missing from the
  author-facing docs is a finding **this WP** raises, not a build failure.
- **FR-014 / SC-006 close**: FR-014 is closed by the showcase page's **publication** hook (WP10)
  **plus** the named reviewer check above (this WP); SC-006 by the ADR (WP01) **plus** `markua.md`
  recording the subset + limits + decision alongside ADR-0030.
- Run the full `doc-sanity` gate; confirm **no `src/**`/`example/**` change** (this WP is content
  only; `ci-ok` build/a11y unaffected).
- **Files**: `docs/architecture/markua.md`, `docs/plans/design-readiness.md` (refinements).
- **Validation**: `doc-sanity` green; `git diff --stat` shows only the two owned files.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**Depends on WP01** (the ADR is on record; this doc links it). Runs in parallel with the render
concerns. Implement with `spec-kitty agent action implement WP11 --agent claude`.

## Definition of Done

- `docs/architecture/markua.md` documents the supported subset, the callout mapping + attribute
  tradeoff, the build-time pipeline, the preset-opt-in model, and the **limits** (C-006), linking
  ADR-0030 and the contracts.
- `docs/plans/design-readiness.md` item 7 is marked **closed**, pointing at ADR-0030 + `markua.md`.
- Docs of record agree with the shipped design (incl. any WP06 fallback); the **named FR-014
  reviewer check** (every construct + every C-006 limit is documented in the author-facing
  surface — this WP's judgment, recorded pass/fail) is done; FR-014 is closed by the WP10 showcase
  **publication** hook **plus** that reviewer check; SC-006 by the ADR **plus** this doc.
- `doc-sanity` green; **no code/rendering change** (`git diff --stat` shows only the two owned
  files); `ci-ok` unaffected.

## Risks / Reviewer guidance

- **Content-only** — no `src/**`/`example/**` diff; a code change here is a finding.
- **Document the limits, not just the features** — FR-014 requires the **limits** (C-006 Won't);
  a doc that lists only what renders is incomplete.
- **Agree with the shipped design** — do not document a construct/mapping the code does not ship;
  if WP06 adopted the non-ATX-heading fallback, the doc must say so (living-documentation).
- **FR-014 author page is the showcase (WP10); the "documents every construct + limits" check is
  THIS WP's named reviewer judgment** — WP10 gates only publication (link-checkable); the
  substantive-coverage obligation is not a build gate and lives here (T047). This WP does not
  own/edit the showcase; it documents the subset in `markua.md`, confirms publication, and runs
  the construct-by-construct + limits reviewer check. Do not duplicate or fork the showcase, and
  do not push the coverage obligation back to WP10 as a brittle build gate.
- **Number consistency** — link the actual ADR number WP01 landed (if it shifted from `0030`).

## Activity Log

- 2026-08-29T11:18:59Z – claude – shell_pid=3616367 – Blocked: move-task WP11->for_review rejected. Lane branch carries kitty-specs/markua-syntax-support-01M167JG/status.json and acceptance-matrix.json, which do not exist on the planning branch feat/markua-syntax-support at all (only status.events.jsonl does). Performed the prescribed ONE reset (git restore --source feat/markua-syntax-support --staged --worktree -- status.events.jsonl; commit) and retried once; move-task still rejects on status.json + acceptance-matrix.json, which have no source on feat/markua-syntax-support to restore from (git restore errors: pathspec did not match). Stopping per lane-hygiene guidance rather than deleting these coordination files unilaterally. Implementation work itself is complete and committed (90d476c docs(WP11): author-facing supported-Markua-subset page + limits) on lane-k: docs/architecture/markua.md (new) + docs/plans/design-readiness.md item 7 closed. T045/T046/T047 marked done.
