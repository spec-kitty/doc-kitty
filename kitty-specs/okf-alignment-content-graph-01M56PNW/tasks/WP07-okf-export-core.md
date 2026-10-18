---
work_package_id: WP07
title: OKF export core and conformance checker (#178)
dependencies:
- WP05
requirement_refs:
- FR-015
- FR-016
- FR-017
- FR-019
- FR-021
- FR-022
- FR-025
- FR-026
- C-003
- C-010
- SC-002
- SC-003
planning_base_branch: feat/okf-alignment-content-graph
merge_target_branch: feat/okf-alignment-content-graph
branch_strategy: Planning artifacts for this mission were generated on feat/okf-alignment-content-graph. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/okf-alignment-content-graph unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-okf-alignment-content-graph-01M56PNW
base_commit: cc058e2b90ee77279d3efd30a7b8b116cf80b0fb
created_at: '2026-10-18T06:23:44.556836+00:00'
subtasks:
- T030
- T031
- T032
- T033
- T034
phase: Phase 3 - OKF export (#178)
agent: claude
history:
- at: '2026-10-18T12:00:00Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/okf-export/
create_intent:
- src/lib/okf-export/core.mjs
- src/lib/okf-export/conformance.mjs
- src/tests/okf-export.test.ts
- src/tests/fixtures/okf-export/
execution_mode: code_change
lane: planned
model: sonnet
owned_files:
- src/lib/okf-export/core.mjs
- src/lib/okf-export/conformance.mjs
- src/tests/okf-export.test.ts
- src/tests/fixtures/okf-export/**
role: implementer
task_type: implement
---

# Work Package Prompt: WP07 – OKF export core and conformance checker (#178)

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
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

A pure export `(graph, sourceFiles) → Map<path, bytes>` turns a built content graph plus the source tree into a plain OKF v0.2 bundle (FR-015..FR-017, FR-019, FR-025), and an in-repo checker asserts §11 rules 1–3 (FR-026).

Done when:

- `src/lib/okf-export/core.mjs` exports `exportOkfBundle(graph, sourceFiles, options)` — no I/O, no relation re-resolution (C-010): it reads edges from the graph only. Source files are filtered to graph node membership (drafts absent).
- Concept documents: frontmatter with non-empty `type`; `status` via `okfStatusOf`; `generated` complete per FR-025 (`by` = existing `generated.by` → first `authors` actor → `process:dockitty-export`; `at` = existing `generated.at` → `updated`); remaining authors kept as `authors`; `content_hash` kept as producer extension; email authors → `human:<local-part>`; `sources` ids where the body cites them; `verified` as list; `stale_after` passed through.
- Relations: generated section(s) with `/`-prefixed links (`/B-path.md`) under labelled headings (Related, Audience, Cites (in-bundle targets; external catalog URL when it has one; else omitted and kept in `sources`), Derived from). `in-section` is not rendered (index entry lists express it). A page with no rendered relations gets **no** heading.
- Indexes: every `index.md` is a §8 entry list with descriptions; non-root `index.md` has no frontmatter; root `index.md` (from DocKitty's root `README.md`) frontmatter is exactly `okf_version: "0.2"`; original non-root index frontmatter preserved in sibling `_index.meta.yaml` (sorted keys).
- `log.md` is reserved: copied as-is, never given `type`.
- Output keys sorted with `compareCodeUnit`; two runs byte-identical.
- `src/lib/okf-export/conformance.mjs` exports `checkOkfBundle(fileMap|dir)` → `violations[]` for §11 rules 1–3 and §8 entry-list bodies; reserved names exempt.

## Context & Constraints

- Contract: `kitty-specs/okf-alignment-content-graph-01M56PNW/contracts/okf-export.md` (read it fully; it is the field-level authority). Plan IC-06, decisions 1–3, 6. Spec rules "Rendering each `rel`" and "The root index".
- Use `okfStatusOf`, `parseActor`, `normaliseInstant`, `compareCodeUnit` from `vocabulary-core.mjs` (WP01). Do not edit that file.
- Reading/writing files is WP08's job (CLI and build hook). Keep this core pure so both callers share it.

## Branch Strategy

- **Planning base branch**: feat/okf-alignment-content-graph
- **Merge target branch**: feat/okf-alignment-content-graph

## Subtasks & Detailed Guidance

### Subtask T030 – Red-first focused test

- Create `src/tests/okf-export.test.ts` (the one new focused test) with tiny fixtures under `src/tests/fixtures/okf-export/` (a graph JSON + 4–6 source pages: root README, a section README with rich frontmatter, A related to B, a page with no relations, a page with email author and `doc_status: active`).
- Cases: Spec US3 scenarios 1–5; empty-relations page has no heading; sidecar contents; conformance positive control (a fixture concept missing `type` → violation); SC-003 equality (body-link page→page edges for rendered rels == graph page→page edges for the same rels); determinism (two runs equal).

### Subtask T031 – Concept frontmatter mapping

- Implement per the contract. Serialise YAML deterministically (sorted or contract-specified key order). Map ids to paths: node id + `.md`.

### Subtask T032 – Relations sections

- Append a generated section after the body, clearly delimited (heading text from the contract). Sort links per heading by target id. Absolute catalog URLs for `cites` where present.

### Subtask T033 – Index files and sidecars

- Build §8 entry lists from graph `in-section` edges (children of each index), each entry `- [Title](/path.md) — description`. Write `_index.meta.yaml` for non-root indexes. Root: `okf_version: "0.2"` only. Handle `log.md` as reserved.

### Subtask T034 – Conformance checker [P]

- Parse frontmatter for every `.md`; rule 1 non-empty `type` on non-reserved files; rule 2 no frontmatter on non-root `index.md`; rule 3 root frontmatter exactly `okf_version: "0.2"`; index bodies are entry lists. Return structured violations (path, rule, message).

### Post-tasks adversarial additions (must do)

- **FR-025 needs all three fallback branches** asserted in `okf-export.test.ts`: (a) page with `generated.by` keeps it; (b) page with no `generated` but `authors: [human:jane, human:joe]` → `generated.by: human:jane`, `authors: [human:joe]`; (c) no `generated`, no authors → `generated.by: process:dockitty-export`. Plus `at` fallback to `updated`. One case per branch; "US3 scenarios 1-5" alone is not enough.
- **FR-026 positive control is two-sided**: the missing-`type` fixture yields exactly one violation with `rule: 1`, and the clean fixture bundle yields `[]`. A checker returning `[]` always would pass a one-sided test; one returning violations always would pass the other. Add one fixture per rule (2: non-root `index.md` with frontmatter; 3: root with an extra key).
- **Drafts**: include a source file that is not a graph node and assert it is absent from the output map (FR-018 drafts excluded is enforced here, by membership).

## Test Strategy

- `pnpm --filter @spec-kitty/doc-toolkit test -- okf-export`
- `.mjs` with JSDoc: ensure the toolkit typecheck (allowJs) passes.

## Risks & Mitigations

- Re-resolving relations "for convenience" violates C-010 — reviewers will reject. Everything comes from `graph.edges`.
- Title/description for index entries: take from graph node fields, not by re-parsing frontmatter.

## Review Guidance

- Reviewer runs on `opus`. Diff exported output for the fixture by eye; verify SC-003 test compares sets both ways (0 missing, 0 extra); verify no `fs` import in `core.mjs`.

## Activity Log

- 2026-10-18T12:00:00Z – system – Prompt created.


## Brownfield scout notes

_paula-patterns scout, 2026-10-18, against a6e15e66._

- Read stamps through the WP02 `stampHash`/`isGeneratedStamp` helpers, never `generated.at` directly. `at` means something different on legacy pages.
- `authors` is read in `agent-page.ts:92` and `Persona.astro:111`. If export maps `authors` onto OKF fields, keep that mapping consistent with the agent page projection.
