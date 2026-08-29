---
work_package_id: WP01
title: Land ADR-0030 (preprocess-to-directive) into docs of record
dependencies: []
requirement_refs:
- FR-013
- C-001
planning_base_branch: feat/markua-syntax-support
merge_target_branch: feat/markua-syntax-support
branch_strategy: Planning artifacts for this mission were generated on feat/markua-syntax-support. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-syntax-support unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
history:
- '2026-08-29: authored by /spec-kitty.tasks'
authoritative_surface: docs/adr/
create_intent:
- docs/adr/0030-markua-preprocess-to-directive.md
execution_mode: code_change
owned_files:
- docs/adr/0030-markua-preprocess-to-directive.md
agent_profile: curator-carla
agent: claude
model: sonnet
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load curator-carla` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (FR-013,
C-001, SC-006), [../plan.md](../plan.md) (concern map IC-00 — the pinned landing obligations),
the drafted ADR [../contracts/adr-0030-markua-preprocess-to-directive.md](../contracts/adr-0030-markua-preprocess-to-directive.md),
and the pinned rules it references [../contracts/normaliser-block-detection.md](../contracts/normaliser-block-detection.md).
For placement + frontmatter conventions, read an existing landed ADR
(`docs/adr/0029-sidebar-autogenerate-content-root-coupling.md`).

## Objective

Land the **already-drafted** ADR-0030 from the mission `contracts/` directory into the
repository docs of record at `docs/adr/0030-markua-preprocess-to-directive.md`, so the
preprocess-to-directive approach and the **pinned block-detection rules** are recorded before
any code lands (FR-013, SC-006, charter seam-ADR discipline). This WP **adds no code** and
changes **no rendering** — it is pure content that passes through review. The two IC-00
landing obligations pinned by the plan are load-bearing and MUST both happen here:

1. **Flip the ADR Status from `Proposed` to `Accepted`** on landing (spec C-001/FR-013/SC-006
   say the mission *ratifies* the approach), and set `doc_status: draft → active`.
2. **Update the back-link** in `contracts/normaliser-block-detection.md` — which currently
   links the ADR as a `contracts/` sibling — to the new `docs/adr/0030-…` path.

Nothing about this WP touches the build pipeline; the ADR number `0030` is the next after
`0029` and may shift only if another ADR lands first (spec assumption) — the **block-detection
rules are the load-bearing content, not the number**. Precedes every other WP; nothing depends
on code here, only on the decision being on record.

## Subtasks

### T001 — Land the ADR at `docs/adr/0030-markua-preprocess-to-directive.md`
- Copy the drafted ADR body from `contracts/adr-0030-markua-preprocess-to-directive.md` to
  `docs/adr/0030-markua-preprocess-to-directive.md` **verbatim except** for the changes below.
- **Flip Status**: change the `## Status` section from `Proposed. *(…flips to Accepted on
  merge…)*` to `**Accepted** — 2026-08-29.` Keep a one-line note that it ratifies option (b)
  per the mission. Update the frontmatter `doc_status: draft` → `doc_status: active`.
- **Remove the "Draft placement" admonition** block at the top (the `> **Draft placement.**`
  note) — it described the draft's temporary home in `contracts/` and is obsolete once landed.
- **Fix relative links now that the file lives in `docs/adr/`**:
  - the sibling-ADR links `./0008-swappable-theme-layer.md` and
    `./0009-finalize-metadata-contract.md` are now **correct** as `docs/adr/` siblings —
    verify they resolve (files exist under `docs/adr/`).
  - the back-link *into* the pinned rules currently reads
    `../../kitty-specs/markua-syntax-support-01M167JG/contracts/normaliser-block-detection.md`;
    from `docs/adr/` that resolves to `<repo-root>/kitty-specs/…` — **verify it resolves** and
    fix the depth if markdownlink-check flags it.
  - the research links `../architecture/research/markua-syntax-support.md` etc. resolve from
    `docs/adr/` as `docs/architecture/research/…` — **verify** those targets exist; if the
    research docs are not present under `docs/architecture/research/`, keep the link but note it
    (do not invent files).
- **Files**: `docs/adr/0030-markua-preprocess-to-directive.md` (new).
- **Validation**: `doc-sanity` (markdownlint + link check) clean on the new file (T003).

### T002 — Update the back-link in the pinned block-detection contract
- Edit `kitty-specs/markua-syntax-support-01M167JG/contracts/normaliser-block-detection.md`:
  - The opening paragraph links `[ADR-0030](./adr-0030-markua-preprocess-to-directive.md)` as a
    `contracts/` sibling. Repoint it to the landed path. From
    `kitty-specs/markua-syntax-support-01M167JG/contracts/` to `docs/adr/` the relative path is
    `../../../docs/adr/0030-markua-preprocess-to-directive.md` — **compute and verify the exact
    depth** (three `../` to repo root, then `docs/adr/…`).
  - Update the `> **Back-link note (for the ADR landing WP).**` blockquote: mark the move done
    (the ADR now lives at `docs/adr/0030-…`), keeping the sentence readable as a historical note
    rather than a future instruction.
- Leave the *rules themselves* byte-identical — only the two link references change. This file
  is a mission planning artifact; the edit is a link-reconciliation, not a rule change.
- **Out-of-map note**: this contract lives under `kitty-specs/` and is intentionally NOT in this
  WP's `owned_files` (the finalizer forbids owned paths under `kitty-specs/`). This is a small,
  justified out-of-map edit — a pure link reconciliation with no rule change — recorded here per
  the ownership rules.
- **Files**: `kitty-specs/markua-syntax-support-01M167JG/contracts/normaliser-block-detection.md`.
- **Validation**: the repointed link resolves (T003 link-check); the rule text is unchanged
  (a `git diff` shows only the two link lines).

### T003 — Doc-sanity gate + no-code guarantee
- Run the repo doc gate (`doc-sanity` — markdownlint + the link checker) and confirm both the
  new `docs/adr/0030-…` and the edited contract pass with **zero** new violations.
- **Confirm this WP added no code and changed no rendering**: `git status`/`git diff --stat`
  shows only **the one owned file (the ADR at `docs/adr/0030-…`) plus the one declared
  out-of-map link edit (the `contracts/normaliser-block-detection.md` back-link, T002)**;
  `src/**`, `example/**`, and `config.ts` are untouched, so `ci-ok` (build-example, a11y,
  code-quality) is unaffected and stays green.
- **Edge case**: if a *different* ADR number has landed since planning (making `0030` taken),
  bump to the next free number **consistently** — the file name, the `# ADR-00xx` heading, the
  frontmatter title, and the T002 back-link must all agree. Record the actual number in the WP
  history line on completion.
- **Files**: none new. **Validation**: `doc-sanity` green; `git diff --stat` shows only the ADR
  (the one owned deliverable) plus the declared out-of-map back-link edit — nothing else.

## Branch Strategy

Planning branch: `feat/markua-syntax-support`. Final merge target: `feat/markua-syntax-support`.
**No dependencies** — this is the gating decision record and precedes IC-01. Implement with
`spec-kitty agent action implement WP01 --agent claude`.

## Definition of Done

- `docs/adr/0030-markua-preprocess-to-directive.md` exists, Status is **Accepted**,
  `doc_status: active`, the draft-placement admonition removed, all relative links resolve.
- `contracts/normaliser-block-detection.md` back-link repointed to the `docs/adr/` path; the
  pinned rules themselves are byte-identical.
- `doc-sanity` green; no `src/**`/`example/**`/`config.ts` change; `ci-ok` unaffected.
- The actual ADR number is recorded in the history line if it shifted from `0030`.

## Risks / Reviewer guidance

- **Both landing obligations are load-bearing** — a landed ADR still marked `Proposed`, or a
  stale `contracts/`-sibling back-link, is the exact miss the plan (IC-00) pins against.
  Reviewer: confirm Status = Accepted **and** the back-link points at `docs/adr/`.
- **Content-only** — this WP must not touch code or rendering. A diff outside the two owned
  files is a finding.
- **Number consistency** — if `0030` shifted, every reference (filename, heading, title,
  back-link) must use the same new number; a split number is a finding.
- **Links resolve from the new depth** — the ADR's `../../kitty-specs/…` back-reference and the
  `./0008`/`./0009` sibling links must resolve from `docs/adr/`; a broken link fails doc-sanity.
