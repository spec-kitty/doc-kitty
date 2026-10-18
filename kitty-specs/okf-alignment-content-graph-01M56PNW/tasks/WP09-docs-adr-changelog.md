---
work_package_id: WP09
title: Docs, ADR-0059 addendum and changelog
dependencies:
- WP04
- WP08
requirement_refs:
- FR-008
- FR-020
- FR-024
- C-001
- C-006
- C-008
planning_base_branch: feat/okf-alignment-content-graph
merge_target_branch: feat/okf-alignment-content-graph
branch_strategy: Planning artifacts for this mission were generated on feat/okf-alignment-content-graph. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/okf-alignment-content-graph unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-okf-alignment-content-graph-01M56PNW
base_commit: c69f3a6fcabec957b1d4922e057b300ff264f1ba
created_at: '2026-10-18T07:30:36.824681+00:00'
subtasks:
- T039
- T040
- T041
phase: Phase 4 - Living documentation
agent: claude
history:
- at: '2026-10-18T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: CHANGELOG.md
create_intent: []
execution_mode: code_change
lane: planned
model: sonnet
owned_files:
- CHANGELOG.md
role: implementer
task_type: implement
---

# Work Package Prompt: WP09 – Docs, ADR-0059 addendum and changelog

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `implementer-ivan` (documentation; apply the writing doctrine: audience-oriented, no AI writing tics)
- **Role**: `implementer`
- **Agent/tool**: `claude` (model `sonnet`)

---

## ⚠️ IMPORTANT: Review Feedback

- Check `review_ref` in the event log. Address all feedback before completing.

---

## Review Feedback

*[If this WP was returned from review, the reviewer feedback reference appears in the Activity Log below or in the status event log.]*

---

## Markdown Formatting

Wrap HTML/XML tags in backticks. Use language identifiers in code blocks.

---

## Objectives & Success Criteria

Living documentation for the shipped behaviour, plus FR-020 evidence.

Done when:

- A how-to guide `docs/guides/export-okf-bundle.md` explains: `dockitty-export-okf` usage and `--check`, the `dist/okf/` layout, `_index.meta.yaml` sidecars, link form, catalog/persona handling, drafts excluded, and the OKF reference-viewer gap (it skips `/`-prefixed links) with the upstream issue URL (FR-020). Frontmatter valid; `description` 50–180 chars (C-006); `updated` UTC; `human:` author.
- ADR-0059 gains a dated `## Implementation notes (2026-10-xx)` addendum (ADRs are immutable; addendum only): the glossary generator is now stamped (overrides glossary C-003), plan decisions 1–6, agent-index version `3`.
- Root `CHANGELOG.md` (canonical; `docs/changelog/CHANGELOG.md` does not exist) has one entry ≤ 1,200 chars covering #177/#176/#178, including the agent-index version bump (FR-024). A dated entry `docs/changelog/2026-10-18-okf-alignment-content-graph.md` (rename the date at implement time only if the orchestrator asks) follows the existing dated-entry pattern.
- Generated indexes regenerated per repo conventions (Hub section indexes from metadata; `generate-adr-index.mjs` if ADR metadata changed). Never hand-maintain an index.

## Context & Constraints

- Plan IC-08. The upstream issue is filed by the operator (manual evidence): if no URL is available when you run, leave a clearly marked `TODO(operator): upstream issue URL` and report it to the orchestrator; do not invent a URL.
- **Ownership**: `docs/**` is owned by WP04 (migration). The new guide, the dated changelog entry, the ADR-0059 addendum and any regenerated index are justified (they sit under WP04's `docs/**` glob, so they cannot be listed here without a lane overlap) out-of-map edits sequenced after WP04 — record each in the Activity Log. `docs/architecture/metadata-model.md` was already updated in WP04; only touch it to add a link to the new guide.

## Branch Strategy

- **Planning base branch**: feat/okf-alignment-content-graph
- **Merge target branch**: feat/okf-alignment-content-graph

## Subtasks & Detailed Guidance

### Subtask T039 – Export guide [P]

- Model the frontmatter on an existing guide in `docs/guides/`. Include a quickstart drawn from `kitty-specs/.../quickstart.md` (copy the commands, not a link into `kitty-specs/`).

### Subtask T040 – ADR-0059 addendum [P]

- Append only; do not rewrite accepted text.
- Charter note (analysis A1): ADR-0059 is not yet on `main`; its sole commit (f6efd4c0) rides this mission's PR. Adding an "Implementation notes" section (glossary pages now carry a `generated` stamp, overriding the generator's old C-003 rule; plan decisions 1–6) before first merge is completing the ADR, not amending an accepted-on-main ADR, so no superseding ADR is needed. Say so in the PR body.

### Subtask T041 – Changelog and indexes

- Write the entry; count characters (`wc -m`). Regenerate indexes; run `pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:adr-index`, Vale if configured.

## Test Strategy

- Doc-sanity, links, ADR index check, Vale. No code tests.

## Risks & Mitigations

- New page breaks pinned "pages list" tests in the docs site: if a docs-site baseline enumerates pages, update it here and note it.

## Review Guidance

- Reviewer runs on `opus`. Check description length, changelog length, ADR immutability (addendum only), and that every claim in the guide matches shipped behaviour (run the CLI once).

## Activity Log

- 2026-10-18T12:00:00Z – system – Prompt created.


## Brownfield scout notes

_paula-patterns scout, 2026-10-18, against a6e15e66._

- The ADR addendum must also record the `generated.at` meaning change (hash → instant, hash moves to `content_hash`) and the scenarios API `generated_from` value if WP02 changes it. Both are adopter-visible.
