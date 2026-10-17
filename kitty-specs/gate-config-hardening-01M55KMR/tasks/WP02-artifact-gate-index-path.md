---
work_package_id: WP02
title: --index-path on the artifact gate (#172)
dependencies:
- WP01
requirement_refs:
- FR-006
- FR-007
- FR-008
- SC-003
planning_base_branch: fix/gate-config-hardening
merge_target_branch: fix/gate-config-hardening
branch_strategy: Planning artifacts for this mission were generated on fix/gate-config-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/gate-config-hardening unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gate-config-hardening-01M55KMR
base_commit: 1b6d1dd49dc9687d4219d6ecb5fd00ad5447decc
created_at: '2026-10-17T19:40:29.115351+00:00'
subtasks:
- T006
- T007
- T008
- T009
history:
- at: '2026-10-17T19:30:00Z'
  event: created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/routes/
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/routes/agent-index.ts
- src/lib/routes/agent-page.ts
- src/tests/agent-links-gating.test.ts
- src/tests/example-adopter.test.ts
role: implementer
tags: []
tracker_refs: []
---

# WP02 — `--index-path` on the artifact gate (#172)

## ⚡ Do This First: Load Agent Profile

Load the `node-norris` profile with the `/spk-charter-profile-load` skill before you read anything else. Then run `spec-kitty charter context --action implement --json`.

## Objective

A site that mounts the agent-API index at a custom `indexPath` can pass `assert:artifacts` by passing `--index-path <dist-relative path>`. **The flag is the only source** (operator decision: no discovery from built output, no config reading). Without the flag, behaviour is exactly as today (`api/index.json`). Spec: FR-006, FR-007, part of FR-008, and data-model.md "Base derivation".

## Branch strategy

- Planning branch and merge target: `fix/gate-config-hardening`. The lane comes from `lanes.json`.
- `spec-kitty agent action implement WP02 --agent claude --mission gate-config-hardening-01M55KMR`. It depends on WP01, which edits the env block of the same file. Rebase onto WP01's result; don't touch that block.

## Test economy (read first)

Follow DIRECTIVE_041 and `development-assist-test-cleanup`. Strengthen existing tests and add at most one focused case per change. Red-first evidence goes in your report. **Report a table of every test you added, changed or removed.**

## Subtasks

### T006 — Parse `--index-path`

- In `src/scripts/assert-build-artifacts.mjs`, `INDEX_RELPATH = 'api/index.json'` is at ~:479. The flag value is relative to `dist/`, because `dist/` never nests the site base.
- Strip one leading `/`. Refuse with exit 2 a value that contains a `..` segment, is filesystem-absolute (such as `C:\` or `//`), or is empty. The message names the flag and the value.

### T007 — Move every index check to the flag path

- The index path feeds:
  - the pinned page count (~:2112-2114);
  - the Specification cross-check (~:2291);
  - the `_links` walk in `assertAgentLinksResolve` (~:373-397, and the `dist/api` scan at ~:2121).
- All three use the flag path.
- The `_links` walk derives the base as `new URL(index._links.self.href).pathname` with the trailing `/<index-path>` removed. Today it requires `self` to end in `/api/index.json`; generalise that to `/<index-path>`.
- If `self` isn't an absolute URL, or doesn't end in `/<index-path>`, fail. The message suggests dropping a site-base prefix from the flag.
- A flag path whose file doesn't exist fails, and the message names the path.
- The per-page JSON scan currently looks under `dist/api/`. Decide between:
  - (a) following the index's `pages[].\_links.self` hrefs, preferred because it is independent of directory layout;
  - (b) scanning `dirname(indexPath)`.

  Justify your choice in the report. The check that fails when no page carries links (added in PR #171) must still hold.

### T008 — Tests

- In `src/tests/agent-links-gating.test.ts` or `example-adopter.test.ts`, whichever already builds the example with a dedicated outDir and runs the real gate, add ONE custom-path case:
  - build the example with the index mounted at a custom path, or copy `dist/api/index.json` to `dist/v2/data/index.json` and rewrite its `self` (cheaper);
  - assert that `--index-path v2/data/index.json` passes;
  - assert that one planted dangling href fails;
  - assert that a `..` value exits 2.
- The `example-adopter` #103 case that asserts the PR #171 behaviour (a mismatched indexPath fails) must be updated, not deleted. Without the flag a custom index still fails; with the flag it passes.

### T009 — Route JSDoc

- In `src/lib/routes/agent-index.ts` (~:32-37, :49) and `agent-page.ts` (~:38-42, :47), remove "keep it ending in `/api/index.json`" and say: "pass the same path, relative to the site base, to `assert-build-artifacts --index-path`".

## Definition of Done

- FR-006 and FR-007 are demonstrated, with red-first evidence for the custom-path pass in the report.
- The default run on the example is unchanged: `node src/scripts/assert-build-artifacts.mjs` passes, and so does `--index-path api/index.json`.
- Conventional commits: `feat(gates): …` / `test(gates): …`, with the orchestrator's trailer lines.

## Risks / reviewer guidance

- A base derivation that is off by a slash.
- A flag path given with the site base included (it must fail with a helpful message, not pass by accident).
- Losing the "no page carries links" floor when the scan strategy changes.

## Addenda from the post-tasks and brownfield squads (binding)

- **Ownership:** `src/scripts/assert-build-artifacts.mjs` is owned by WP01. WP02 edits it AFTER WP01, in the same sequential dependency chain. **Scope is index-path only.** Declare this in the commit message: `out-of-map: assert-build-artifacts index-path (WP01 owns; sequential)`.
- **Correct pointers** (against a76c5563; re-locate them on WP01's head):
  - `INDEX_RELPATH` is defined at :479 but first used at :380 (`indexRel`).
  - The hard-coded `path.join(distDir, 'api')` scan is at **:398**.
  - The labels `'agent index (api/index.json)'` at :2113-2114 and the `api/index.json` text at :2291 must be derived from the flag value.
  - **Leave `SCENARIO_INDEX_RELPATH` (:203) alone**, and say so in the report.
- **Argument parsing:** consume `--index-path <v>` before the positional `rest[0]`. `package.json:27` `assert:artifacts` already passes `example/dist`, and CI :213 appends it again. Only `rest[0]` is used, so do not start rejecting extra positionals. Pin that `pnpm assert:artifacts example/dist` still passes.
- **T008:** make the refusal case one table-driven case over `['../x', 'C:\\x', '', '//x']` → exit 2, plus a case where `self` includes the base, asserting the message contains "base".
- **The red-first DoD is concrete:** on WP01's head, the T008 custom-path case fails with the current "must end in /api/index.json" message. Paste it.
