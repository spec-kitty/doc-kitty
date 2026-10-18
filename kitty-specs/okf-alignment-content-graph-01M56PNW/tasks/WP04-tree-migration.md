---
work_package_id: WP04
title: Tree migration and metadata-model doc (#177)
dependencies:
- WP02
- WP03
requirement_refs:
- FR-003
- FR-007
- FR-008
- NFR-003
- NFR-004
- C-006
- C-007
planning_base_branch: feat/okf-alignment-content-graph
merge_target_branch: feat/okf-alignment-content-graph
branch_strategy: Planning artifacts for this mission were generated on feat/okf-alignment-content-graph. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/okf-alignment-content-graph unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-okf-alignment-content-graph-01M56PNW
base_commit: f94a54cc0d18d9b0eed687918c9f06f3b5dd5e30
created_at: '2026-10-18T06:06:49.429580+00:00'
subtasks:
- T017
- T018
- T019
- T020
phase: Phase 1 - Metadata alignment (#177)
agent: claude
history:
- at: '2026-10-18T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/scripts/oneoff/
create_intent:
- src/scripts/oneoff/migrate-okf-metadata.mjs
execution_mode: code_change
model: sonnet
owned_files:
- src/scripts/oneoff/migrate-okf-metadata.mjs
- docs/**
- example/docs/README.md
- example/docs/adr/**
- example/docs/architecture/**
- example/docs/changelog/**
- example/docs/context/**
- example/docs/glossary/**
- example/docs/glossary-demo/**
- example/docs/guides/**
- example/docs/_meta/**
- example/docs/plans/**
- example/docs/presentations/**
- example/docs/rhetoric/**
role: implementer
task_type: implement
---

# Work Package Prompt: WP04 – Tree migration and metadata-model doc (#177)

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `implementer-ivan`
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

Our own trees pass with zero new warnings (NFR-003): `docs/` and `example/docs` have UTC `updated`, `human:` authors and `okf_version: "0.2"` on every index file.

Done when:

- `node src/scripts/validate-frontmatter.mjs docs` and `... example/docs` report 0 date-only, 0 email-author and 0 missing-`okf_version` warnings, and exit 0.
- `docs/architecture/metadata-model.md` documents the `doc_status` → OKF `status` table (FR-008), the actor grammar and the instant rule, with a link to ADR-0059.
- The migration script is committed under `src/scripts/oneoff/` (audit trail, not a bin, not in `src/package.json` `files`).

## Context & Constraints

- Plan IC-04; decisions 01M56PPSV0616KQ36E8VVK6XDG (date-only → midnight UTC, trees migrated) and 01M56PPX06MDWYMBGNBYB4TAVK (email → `human:<local-part>`).
- **This is a value-shape migration, not a rename.** Do NOT set a bulk-edit `change_mode` and do NOT use `occurrence_map.yaml` (known split-goal guardrail hazard in this repo). The script performs plain text edits.
- Must run after WP02 and WP03 so generators already emit the new forms (otherwise regeneration reverts the change).
- `example/docs/behaviour/**` is owned by WP02 (generated); do not touch it here.

## Branch Strategy

- **Planning base branch**: feat/okf-alignment-content-graph
- **Merge target branch**: feat/okf-alignment-content-graph

## Subtasks & Detailed Guidance

### Subtask T017 – One-off migration script

- **Steps**:
  1. Create `src/scripts/oneoff/migrate-okf-metadata.mjs`: args `<root>...`, flags `--dry-run` (default) and `--write`.
  2. Walk `.md` files (skip `node_modules`, `dist`, `.astro`). Extract the leading frontmatter block by text (between the first two `---` lines). Edit only inside that block, line-based regex, so key order, comments and quoting are kept:
     - `^updated:\s*(\d{4}-\d{2}-\d{2})\s*$` → `updated: $1T00:00:00Z`; same for `stale_after:` and nested `at:` under `verified`.
     - authors list items / inline arrays with an email → `human:<local-part>` (lowercase not forced; keep the local part verbatim).
     - index files (basename in `normalizeIndexBasenames(indexBasename)` from `vocabulary-core.mjs`; read the site's configured index basename as `site-index-names.mjs` does) without `okf_version` → insert `okf_version: "0.2"` as the first key.
  3. Print a per-file summary; `--dry-run` writes nothing.
- **Notes**: Use the WP01 `isIndexFile`/`normalizeIndexBasenames` helper; do not re-implement the index rule.

### Subtask T018 – Run the migration

- **Steps**:
  1. Dry-run both trees, review the summary.
  2. `--write` on `docs` and the non-behaviour `example/docs` subdirectories listed in `owned_files`.
  3. Regenerate indexes per repo convention (`node src/scripts/generate-adr-index.mjs` then `pnpm validate:adr-index`; Hub section indexes are generated from metadata, never hand-edited).
  4. Keep the tree diff in its own commit, separate from the script commit.

### Subtask T019 – Metadata-model doc [P]

- Edit `docs/architecture/metadata-model.md`: add the mapping table from `data-model.md`, actor forms, instant rule, generated-stamp shape, `okf_version` per index. Keep its `description` 50–180 chars (C-006).

### Subtask T020 – Gates and ripple

- Run `pnpm validate:docs`, `pnpm validate:example`, `pnpm validate:links`, `pnpm validate:adr-index`, `pnpm validate:features --check` (behaviour pages must stay untouched).
- Build the example and refresh pinned example baselines that the migration shifts (RSS dates, agent records) in this same WP (C-007). Never regenerate a timing census. Baselines outside `owned_files` → justified out-of-map, noted in the Activity Log.

## Test Strategy

- No new test (C-005). The doc-sanity gate on both trees is the oracle.
- `pnpm test` toolkit suite still green.

## Risks & Mitigations

- YAML edge cases (quoted dates, block-scalar authors): the dry-run summary is reviewed before write; anything the regex skips is listed and fixed by hand.
- Large diff: isolate it in one commit.

## Review Guidance

- Reviewer runs on `opus`. Spot-check 10 random diffs for key-order and comment preservation; confirm 0 warnings on both trees; confirm no edits under `example/docs/behaviour/`.

## Activity Log

- 2026-10-18T12:00:00Z – system – Prompt created.


## Brownfield scout notes

_paula-patterns scout, 2026-10-18, against a6e15e66._

- The nested `at:` regex must be scoped to `verified` blocks ONLY. Generated pages carry `generated.at: "sha256:..."` (a hash, quoted). A loose indented-`at:` rule must not touch those.
- `stale_after` also lives in the validator twin (`validate-frontmatter.mjs:224`). Run both validators after the migration.
- Test fixtures with date-only `updated` (`hub-adr-card.test.ts:56`, `type-registry-authority.test.ts:142`) are inline strings and are not migrated. They stay valid only if WP01 keeps date-only as accepted plus a warning.
