---
work_package_id: WP04
title: Stub-tool flags
dependencies:
- WP03
requirement_refs:
- FR-007
- FR-008
- FR-009
- FR-014
- NFR-001
- NFR-002
- C-005
planning_base_branch: feat/402-operating-model-templates
merge_target_branch: feat/402-operating-model-templates
branch_strategy: Planning artifacts for this mission were generated on feat/402-operating-model-templates. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/402-operating-model-templates unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
- T016
history:
- timestamp: '2026-11-23T22:30:23Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/scripts/
create_intent:
- src/tests/stub-tools-templates.test.ts
execution_mode: code_change
owned_files:
- src/scripts/new-doc.mjs
- src/scripts/scaffold.mjs
- src/tests/stub-tools-templates.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP04 - Stub-tool flags

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Add `new-doc.mjs --template <id>` and `scaffold.mjs --preset operating-model`, using WP03's manifest and renderer. Both tools must keep their never-overwrite behaviour, and runs with neither flag must stay byte-identical.

Requirements: FR-007, FR-008, FR-009, FR-014; NFR-001, NFR-002; C-005. Depends on WP03. The contract is `kitty-specs/operating-model-templates-01M84X0R/contracts/cli.md`.

## Branch strategy

- Planning branch and final merge target: `feat/402-operating-model-templates`.
- Run `spec-kitty agent action implement WP04 --agent claude --mission operating-model-templates-01M84X0R`.

## Context

- `src/scripts/new-doc.mjs` parses `--key value` flags with a small `parseArgs`. It refuses to overwrite with exit 1, using the message `✖ refusing to overwrite existing file: <target>`.
- `src/scripts/scaffold.mjs` uses `write(relPath, content)`, which skips existing files, and prints `✓ scaffolded N file(s) under <base>/` plus `(skipped N existing file(s))`.
- Both scripts resolve the index basename from the site config (`resolveSiteIndexBasenames`). The preset's section index must use that resolved basename too.
- Both scripts compute `meta` once with `scaffoldMeta()`. A test pinning bytes must control the clock. Check whether either tool accepts an injected clock; if not, compare outputs with the `updated` and `at` lines masked.

## Subtasks

### T013 — Pin and red tests (`src/tests/stub-tools-templates.test.ts`)

Spawn the real scripts (`node src/scripts/new-doc.mjs …`) in temp directories. First, pin FR-014: a run of `new-doc guides/x` and a default `scaffold` run produce the same file set and the same content, with timestamps masked, as on the branch base. Capture the expected output in the test as literal strings.

Red tests, following the contract table:

- `new-doc --template incident-response --base <tmp>/docs` writes `operations/runbooks/incident-response.md` with `kind: How-To`, `type: Runbook` and the two measures, and exits 0.
- `new-doc --template role operating-model/roles/dpo --title "Data Protection Officer"` writes `operating-model/roles/dpo.md`.
- Never overwrite: pre-create the target with sentinel bytes. The run exits 1, and the bytes are unchanged. Positive control: in the same fixture, a missing sibling target is written.
- `scaffold <tmp>/docs --preset operating-model` writes 13 files: the index plus 12. A second run writes 0 files, reports 13 skipped and changes no bytes.
- Partial tree: pre-create 2 of the 13 files with sentinels. Those stay byte-identical, and the other 11 are written.

Commit them failing first.

### T014 — `new-doc --template <id>`

- When `flags.template` is set, look the template up with `templateById`. The target is `<base>/<slug ?? record.path>.md`.
- Render with `renderTemplatePage(record, { title: flags.title, type: flags.type })`.
- Keep the same existence check, message and exit 1, and the same `✓ created … (type: …, kind: …)` output line.

### T015 — `scaffold --preset operating-model`

- Parse `--preset <id>`. Only `operating-model` is known.
- Write `operating-model/<index>.md` as a Hub with `type: Operations`, reusing `indexFrontmatter` but with the type set explicitly, since the frozen map has no such section. Then write all 12 template pages through the existing `write()`, so skip-existing applies.
- Do not write the default tree when `--preset` is given.

### T016 — Conflicts and unknown ids

These cases print a message to stderr, write nothing and exit 2:

- `--template` combined with `--kind`;
- `--template` combined with `--section`;
- an unknown template id (also list the known ids);
- `--preset` combined with `--sections`;
- an unknown preset (also list the known presets).

Add a test for each.

## Definition of Done

- The red commit precedes the green commit.
- The FR-014 pin passes unchanged.
- `pnpm test` passes fully; report the counts.
- Update the usage headers in both scripts to show the new flags.

## Reviewer guidance

- Run the quickstart (`kitty-specs/operating-model-templates-01M84X0R/quickstart.md`), steps 1 to 4, in a temp directory.
- Mutation check: removing the existence check must turn the no-overwrite test red.
