---
work_package_id: WP03
title: Template set and renderer
dependencies:
- WP02
requirement_refs:
- FR-005
- FR-006
- FR-011
- FR-012
- NFR-001
- NFR-003
- NFR-004
- C-001
planning_base_branch: feat/402-operating-model-templates
merge_target_branch: feat/402-operating-model-templates
branch_strategy: Planning artifacts for this mission were generated on feat/402-operating-model-templates. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/402-operating-model-templates unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-operating-model-templates-01M84X0R
base_commit: f9ddf59584a0c521de47b2a9852fd66bf9f4f2d7
created_at: '2026-11-24T00:39:58.762323+00:00'
subtasks:
- T008
- T009
- T010
- T011
- T012
history:
- timestamp: '2026-11-23T22:30:23Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/operating-model-templates.mjs
create_intent:
- src/lib/operating-model-templates.mjs
- src/tests/operating-model-templates.test.ts
- src/lib/templates/operating-model/organisation.md
- src/lib/templates/operating-model/role.md
- src/lib/templates/operating-model/governance-forums.md
- src/lib/templates/operating-model/policy-index.md
- src/lib/templates/operating-model/access-management.md
- src/lib/templates/operating-model/change-management.md
- src/lib/templates/operating-model/incident-response.md
- src/lib/templates/operating-model/business-continuity.md
- src/lib/templates/operating-model/supplier-management.md
- src/lib/templates/operating-model/people.md
- src/lib/templates/operating-model/data-lifecycle.md
- src/lib/templates/operating-model/assurance-audits.md
execution_mode: code_change
owned_files:
- src/lib/operating-model-templates.mjs
- src/lib/templates/operating-model/*.md
- src/tests/operating-model-templates.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP03 - Template set and renderer

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Ship the 12 operating-model templates and a pure renderer. Each template is a manifest record plus a Markdown body. Every rendered page must pass the frontmatter gate with 0 errors, and its measures must resolve against the default catalog. Template bodies must hold only headings and HTML-comment prompts.

Requirements: FR-005, FR-006, FR-011, FR-012; NFR-001, NFR-003, NFR-004; C-001. Depends on WP02, because the `Role` kind must exist.

## Branch strategy

- Planning branch and final merge target: `feat/402-operating-model-templates`.
- Run `spec-kitty agent action implement WP03 --agent claude --mission operating-model-templates-01M84X0R`.

## Context

- Design: `kitty-specs/operating-model-templates-01M84X0R/research.md`, decisions D2, D3, D4, D6, D7 and D8.
- The records table, with ids, paths, kinds and measures, is in `kitty-specs/operating-model-templates-01M84X0R/data-model.md`.
- `scaffoldMeta()` in `src/scripts/scaffold-meta.mjs` returns the shared `updated`, `authors` and `generated` lines. Reuse it, and do not duplicate the generator stamp.
- `expectedDocType(relPath)` in `src/lib/vocabulary-core.mjs` derives `Runbook` for `operations/runbooks/*` and `null` for an unknown section.
- Default measure ids are in `src/lib/measures-default.mjs`. Import the catalog to check ids; do not hard-code a second list.
- The `tom_classification` object shape is `{ measure, scope: organisation }` (ADR-0080; fixture `src/tests/fixtures/valid/tom-classification.md`).
- The `yaml` package is already a dependency, so use it to stringify frontmatter values.

## Subtasks

### T008 — Red tests (`src/tests/operating-model-templates.test.ts`)

Write tests for:

- There are exactly 12 records, and their ids are unique.
- Every `kind` is in `KINDS`, every `defaultType` is in `DOC_TYPES`, and every measure id exists in the default catalog.
- The record table matches `data-model.md` exactly (ids, paths, kinds, measures). Write it inline as the expected value.
- `renderTemplatePage(templateById('role'), { title: 'Data Protection Officer', now })` contains:
  - `kind: Role`;
  - a non-empty `role`;
  - a non-empty `responsibilities` list;
  - `tom_classification` with `measure: accountability` and `scope: organisation`.
- A title containing a colon, `People: onboarding`, round-trips through a YAML parse.
- The incident-response page gets `type: Runbook`. The organisation page gets `type: Operations`.

Commit them failing first.

### T009 — Manifest (`src/lib/operating-model-templates.mjs`)

```js
// @ts-check
export const OPERATING_MODEL_TEMPLATES = Object.freeze([
  { id: 'organisation', title: 'Organisation and teams', kind: 'Explanation',
    path: 'operating-model/organisation', defaultType: 'Operations',
    measures: ['it-security-governance'], body: 'organisation.md' },
  // … 11 more, exactly as in data-model.md
]);
export function templateById(id) { … }
export const TEMPLATE_IDS = …;
```

Freeze each record deeply.

### T010 — Renderer

`renderTemplatePage(record, { title = record.title, type, now = new Date() })` works like this:

- `type` resolves to `type ?? expectedDocType(record.path + '.md') ?? record.defaultType`.
- It builds the frontmatter object in this order:
  1. `title`;
  2. `description`, a TODO prompt;
  3. `doc_status: draft`;
  4. `type`;
  5. `kind`;
  6. for Role only, `role: TODO name the accountable function` and `responsibilities: [TODO list one duty per entry]`;
  7. `tom_classification`.
- It stringifies that object with `yaml`, then appends the `scaffoldMeta(now)` lines, so the key order matches the existing stubs.
- The body is read with `readFileSync(new URL('./templates/operating-model/' + record.body, import.meta.url))`.
- The result is `---\n<frontmatter>\n---\n\n# <title>\n\n<body>`.
- Output is deterministic for a fixed `now`.

### T011 — 12 template bodies

Each body is `src/lib/templates/operating-model/<id>.md` and holds only:

- `##` heading lines (the skeleton);
- HTML comments `<!-- … -->` with authoring prompts, such as "Name the forum, its cadence and who decides." Each prompt asks a question or gives an instruction. It never states a policy;
- blank lines.

The first comment must say: "Structure and prompts only. This template does not state policy and is not legal advice. Replace each prompt with your organisation's facts."

The Role body has sections Purpose, Responsibilities, Decision rights, Escalation and "Processes this role takes part in", and its prompt says to list the process pages in `related`.

Suggested skeletons:

- **organisation**: Structure, Teams and ownership, How teams work together.
- **governance-forums**: Forums (one subsection prompt each: purpose, cadence, members, decides), Decision rights, Records.
- **policy-index**: Policies (a list prompt: title, owner, review date, link), Review cycle.
- **access-management**: Scope, Granting access, Reviewing access, Removing access, Privileged access.
- **change-management**: Scope, Requesting a change, Testing and approval, Release, Rollback.
- **incident-response**: Triggers, Roles, Steps (Detect, Contain, Assess, Notify, Recover, Review), Records.
- **business-continuity**: Scope and objectives (RTO/RPO prompts), Scenarios, Recovery steps, Testing the plan.
- **supplier-management**: Selecting suppliers, Assessing sub-processors, Contracts and reviews, Offboarding a supplier.
- **people**: Onboarding, Training, Confidentiality commitments, Offboarding.
- **data-lifecycle**: Data categories, Retention periods, Deletion, Portability and access requests.
- **assurance-audits**: Assurance activities, Audit schedule, Findings and follow-up, Evidence.

### T012 — Gate and NFR-004 checks

In the same test file, add:

1. For each of the 12 records, render the page into a temp docs tree at `record.path + '.md'`, then run the real gate over the tree (the same entry point `validate-frontmatter` uses). Expect 0 errors. If the gate surfaces measure resolution, also expect 0 measure warnings.
2. NFR-004: for each body file, remove `<!--[\s\S]*?-->`, drop lines that match `^#{1,6} ` and blank lines, then assert that nothing remains. Non-vacuity: assert that each body has at least 2 headings and at least 2 comments.

## Definition of Done

- The red commit precedes the green commit.
- 12 of 12 rendered pages pass the gate.
- The NFR-004 check passes, and so does its non-vacuity guard.
- `pnpm test` passes fully; report the counts.

## Risks and reviewer guidance

- Watch for policy wording sneaking into prompts. A prompt must ask; it must not assert. For example, "Who approves a change?" is fine, but "Changes must be approved by the CAB" is not.
- Check that the body read works from the installed package path (`import.meta.url`), not from the cwd.
