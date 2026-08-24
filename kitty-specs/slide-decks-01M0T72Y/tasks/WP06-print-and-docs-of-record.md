---
work_package_id: WP06
title: 'Docs of record: resolve open questions + amend ADR-0012'
dependencies:
- WP04
requirement_refs:
- FR-020
planning_base_branch: feat/slide-decks
merge_target_branch: feat/slide-decks
branch_strategy: Planning artifacts for this mission were generated on feat/slide-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/slide-decks unless the human explicitly redirects the landing branch.
subtasks:
- T026
- T027
history:
- '2026-08-24: authored by /spec-kitty.tasks'
agent_profile: scribe-sally
authoritative_surface: docs/
create_intent: []
execution_mode: code_change
owned_files:
- docs/architecture/slide-decks.md
- docs/adr/0012-slide-decks-static-reveal-from-markdown.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load scribe-sally` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
`docs/adr/0021-deck-routing-seam-out-of-frame-override.md`,
`docs/adr/0022-reveal-integration-and-token-theme.md`,
`docs/architecture/slide-decks.md`, and
`docs/adr/0012-slide-decks-static-reveal-from-markdown.md`.

## Objective

Reconcile the design of record with what M6 actually built: resolve the four Open
Questions in `architecture/slide-decks.md` in place, and record the ADR-0012 "Presentation
anywhere" → **path+kind** amendment as a pointer to ADR-0021 (not a rewrite of ADR-0012's
decision body — ADRs are immutable). The `?print-pdf` gate itself shipped in WP01's
`reveal-init` and its assertion in WP04; this WP is the docs half of FR-020.

## Subtasks

### T026 — Resolve `architecture/slide-decks.md` Open Questions
- In the "Open questions" section, replace the deferred items with their resolutions:
  `###` vertical slides **ship in v1**; the `--dk-*`→reveal-variable mapping is defined
  (ADR-0022) and the per-file `deck:` override is **deferred**; `reveal.js` is pinned at
  **6.0.1** with an upgrade smoke-check cadence (ADR-0022); Pagefind coverage is a
  **build-time assertion** (implemented in WP04).
- Amend the "What a deck is" wording that says a `Presentation` "anywhere" routes to the
  deck renderer → **a `Presentation` under `presentations/`** routes out-of-frame; link
  ADR-0021. Keep the doc's audience/tone; update `updated:` and, if the content shifts,
  keep `doc_status` accurate.

### T027 — ADR-0012 amendment pointer
- Add to `docs/adr/0012-*.md` **Status** a one-line note: "Decision 1 ('anywhere') amended
  by [ADR-0021](./0021-deck-routing-seam-out-of-frame-override.md): the switch is
  path+kind (a `Presentation` under `presentations/`)." Do **not** rewrite the decision
  body — immutable-ADR discipline; the pointer is the correct mechanism (as ADR-0011
  supersedes the `banner` field of ADR-0009).

## Branch Strategy

Planning branch: `feat/slide-decks`. Final merge target: `feat/slide-decks`. Depends on
WP04; runs **parallel to WP05**. Implement with
`spec-kitty agent action implement WP06 --agent claude`.

## Definition of Done

- `architecture/slide-decks.md` Open Questions resolved; "anywhere" corrected to path+kind.
- ADR-0012 carries the amendment pointer to ADR-0021 (Status note only).
- `doc-sanity` green over the edited docs (markdownlint + Vale + links).

## Risks / Reviewer guidance

- Do not rewrite ADR-0012's Decision/Consequences body — a Status pointer only.
- Verify all internal links (ADR-0021/0022, slide-decks.md) still resolve after edits.
