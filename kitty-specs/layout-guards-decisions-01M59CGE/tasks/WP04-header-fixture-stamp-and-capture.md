---
work_package_id: WP04
title: Header fixture stamp and carrier-free capture
dependencies:
- WP03
requirement_refs:
- FR-002
- FR-003
- FR-015
- NFR-003
- SC-003
planning_base_branch: feat/layout-guards-decisions
merge_target_branch: feat/layout-guards-decisions
branch_strategy: Planning artifacts for this mission were generated on feat/layout-guards-decisions. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/layout-guards-decisions unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-layout-guards-decisions-01M59CGE
base_commit: a507c3a7fb1d52d7c5e7c97004ab0c7fce31cccc
created_at: '2026-10-19T08:03:21.836655+00:00'
subtasks:
- T018
- T019
- T020
- T021
phase: Phase 2 - Reader-visible changes
history:
- at: '2026-10-19T06:40:32Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/tests/fixtures/header-theme/
create_intent:
- src/scripts/capture-stock-header.mjs
- src/tests/stock-header-stamp.test.ts
- src/tests/fixtures/header-theme/stock-header.meta.json
execution_mode: code_change
model: ''
owned_files:
- src/scripts/capture-stock-header.mjs
- src/tests/stock-header-stamp.test.ts
- src/tests/fixtures/header-theme/stock-header.html
- src/tests/fixtures/header-theme/stock-header.meta.json
- src/tests/fixtures/header-theme/README.txt
- src/tests/header-carrier.test.ts
- package.json
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP04 – Header fixture stamp and carrier-free capture

## ⚡ Do This First: Load Agent Profile

Use the `/spk-charter-profile-load` skill to load the agent profile specified in the frontmatter (or any user-defined profile), and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `claude`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## ⚠️ IMPORTANT: Review Feedback

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_ref` field in the event log (via `spec-kitty agent tasks status`).
- **You must address all feedback** before your work is complete. Feedback items are your implementation TODO list.
- **Report progress**: As you address each feedback item, record what you changed with `spec-kitty agent tasks add-history <WPID> --note "..."` (stored in the status event log).

---

## Review Feedback

*[If this WP was returned from review, the reviewer feedback reference appears in the status event log.]*

---

## Markdown Formatting

Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````python`,````bash`

---

## Objectives & Success Criteria

Make `src/tests/fixtures/header-theme/stock-header.html` real stock-Starlight output
again, and make a Starlight or Astro upgrade fail fast with a message that says how
to fix it (#207). When this WP is done:

- One script captures the fixture from a build of the real example with the `Header`
  carrier switched off (`DK_INTERNAL_STOCK_HEADER=on`, added in WP03). It writes the
  fixture and a stamp sidecar together.
- The stamp records the Starlight version, the Astro version, `compressHTML`,
  `carrier: "disabled"` and the captured page
  (`kitty-specs/layout-guards-decisions-01M59CGE/contracts/stock-header-stamp.schema.json`).
- A fast test (no build, at most 1 s, NFR-003) fails when the installed or
  configured values differ from the stamp. It names the field and the command
  `pnpm fixture:stock-header`.
- The provenance comments in `header-carrier.test.ts` and `README.txt` tell the
  truth.
- `pnpm fixture:stock-header` exists at the repository root.

Requirements: FR-002, FR-003, FR-015 (provenance comments), NFR-003, SC-003.

## Context & Constraints

- **Research**, #207 in `docs/architecture/research/layout-guards-and-decisions.md`.
  The fixture is not stale; it matches 0.42.6 exactly. #212 recaptured it twice,
  from normal builds that carry the `Header` carrier, so the neutrality check now
  partly compares the carrier with itself. The fixture also embeds a Vite asset hash
  and `compressHTML` whitespace, so a Starlight-only stamp would miss some breaking
  upgrades.
- **The neutrality test**: `src/tests/header-carrier.test.ts`.
  - Its header comment (lines 1 to 40) says the fixture was captured from 2ffe856,
    before the carrier existed. That is false since #212.
  - It normalises only `astro-[a-z0-9]{8}` to `astro-HASH` (`SCOPE_HASH`,
    `normaliseScopeHashes`, around line 60).
  - `runBuild` (around line 90) shows how a child `astro build` must be spawned. Copy
    its environment hygiene, especially the note that Vitest leaks
    `NODE_ENV=test`, `MODE`, `DEV` and `BASE_URL` into the env.
- **Fixture README**: `src/tests/fixtures/header-theme/README.txt` gives today's
  manual steps. The header block is the `<header …>…</header>` of
  `example/dist/index.html`, without a trailing newline.
- **Switch**: WP03 added `DK_INTERNAL_STOCK_HEADER=on` in `src/lib/config.ts`.
  Only exactly `on` drops `Header`.
- **compressHTML**: the toolkit pins `compressHTML: true` (#145). Find where
  (`grep -rn compressHTML src/lib`) and read the value from that source in the stamp
  test. If it is a constant, import it; do not duplicate the literal.
- **Version resolution**: resolve `@astrojs/starlight/package.json` and
  `astro/package.json` with `createRequire` from `example/package.json`, so the
  versions are the ones the example builds with.
- Builds share `example/.astro`. The capture script runs on its own, not inside
  Vitest, so it does not need the serialized `build` project.

## Branch Strategy

- **Strategy**: Planning artifacts were generated on feat/layout-guards-decisions; completed changes must merge back into feat/layout-guards-decisions.
- **Planning base branch**: feat/layout-guards-decisions
- **Merge target branch**: feat/layout-guards-decisions

```bash
spec-kitty agent action implement WP04 --agent claude --mission layout-guards-decisions-01M59CGE
```

## Subtasks & Detailed Guidance

### Subtask T018 – Write the stock-header capture script

- **Steps**:
  1. Create `src/scripts/capture-stock-header.mjs` in the style of the other scripts
     in `src/scripts/`: a header doc comment, plain ESM and Node built-ins only.
  2. Behaviour:
     1. Build the example with `DK_PUBLISH_DRAFTS=off`, `DK_INTERNAL_STOCK_HEADER=on`
        and its own `DK_OUTDIR`, for example `dist-stock-header-capture`. Remove that
        dir first and again at the end. Spawn
        `pnpm --filter example build` or the same command `header-carrier.test.ts`
        uses; read it and reuse it.
     2. Read `<outdir>/index.html` and extract the first `<header …>…</header>`
        block, using the same extraction `header-carrier.test.ts` uses. If that is a
        helper, import it; otherwise write the same regex once and note it.
     3. Replace every `astro-[a-z0-9]{8}` with `astro-HASH`.
     4. Write the block to `src/tests/fixtures/header-theme/stock-header.html` with
        no trailing newline.
     5. Write `stock-header.meta.json` (2-space JSON, trailing newline) with
        `starlight`, `astro` (resolved as in Context), `compressHTML` (from the
        toolkit source), `carrier: "disabled"` and
        `capturedFrom: "example/dist/index.html"`.
     6. Print what changed: "fixture unchanged" or a unified-diff summary of
        old vs new, plus the stamp values.
  3. Exit non-zero if the build fails, if no header block is found, or if the
     captured block still shows the carrier is active. That is a guard against a
     broken switch. Find a marker that only the carrier path can add; if there is
     none, because the carrier is markup-neutral by design, say so in a comment and
     rely on the build env.
- **Files**: `src/scripts/capture-stock-header.mjs` (new, about 100 to 150 lines)

### Subtask T019 – Capture the fixture and its stamp without the carrier

- **Steps**:
  1. Run the script.
  2. **If the fixture is unchanged**, the carrier was neutral; record that.
  3. **If the fixture changed**, the carrier was not perfectly neutral, or the old
     capture carried something. That is a finding: stop, put the diff in your history
     note, and flag it for the reviewer and the orchestrator. Do not paper over it.
     If the difference is the carrier's fault, `header-carrier.test.ts` will now fail
     on the normal build, which is exactly what the guard is for. Report it rather
     than changing the carrier, which is outside your files.
  4. Commit `stock-header.html` (only if changed) and the new `stock-header.meta.json`.
- **Validation**: `pnpm test` with the `build` project including
  `header-carrier.test.ts` is green. If it is red because of a real non-neutrality,
  see step 3.

### Subtask T020 – Add the fast stamp test with the regeneration hint

- **Steps**:
  1. Create `src/tests/stock-header-stamp.test.ts`. It must land in the fast Vitest
     project: check `src/vitest.workspace.ts`; anything not listed in the build
     suites is fast.
  2. Read the stamp. Validate its shape against the contract's fields with plain
     assertions; no JSON-schema library.
  3. Compare each field with what is installed and configured now. One failing
     assertion per field, each with a message like:
     `stock-header fixture was captured with @astrojs/starlight 0.42.6, but 0.43.0 is installed — run \`pnpm fixture:stock-header\` and review the diff`.
  4. Assert that the fixture file exists, is non-empty and has no trailing newline.
  5. **Positive control.** A test feeds a doctored stamp object (another
     `starlight` version) through the same comparison function and expects the
     message. Factor the comparison into a pure function.
  6. Time it: the file must run in well under 1 s.
- **Files**: `src/tests/stock-header-stamp.test.ts` (new, about 80 to 120 lines)

### Subtask T021 – Correct the fixture provenance and add the package script

- **Steps**:
  1. In `header-carrier.test.ts`, rewrite the header comment's "captured from a build
     of the commit BEFORE the carrier existed (2ffe856)" and the "Regenerating the
     fixture" paragraph. The fixture is now captured by
     `pnpm fixture:stock-header` from the example built without the `Header`
     carrier, and `stock-header.meta.json` stamps it. Fix the `STOCK_HEADER` doc
     comment ("Captured from the pre-carrier build") the same way. Change no test
     logic.
  2. Rewrite `README.txt` to point at the script and the stamp, and keep the
     normalisation explanation.
  3. Add `"fixture:stock-header": "node src/scripts/capture-stock-header.mjs"` to the
     root `package.json` scripts, in alphabetical or adjacent order with the others.
     Touch nothing else in that file.
- **Validation**: `pnpm fixture:stock-header` runs from the root.

## Test Strategy

```bash
pnpm fixture:stock-header
pnpm test -- tests/stock-header-stamp.test.ts
pnpm --filter @spec-kitty/doc-toolkit exec vitest run --project build tests/header-carrier.test.ts
pnpm --filter @spec-kitty/doc-toolkit typecheck
pnpm lint
```

Fail-first proof: edit `starlight` in the stamp to `0.0.0`, run the stamp test, and
paste the red message into your history. Then revert.

## Risks & Mitigations

- **A broken switch** makes the "stock" fixture a carrier capture again. The script's
  guard in T018 step 3, plus the fact that WP03's unit test proves the switch drops
  `Header`, cover it.
- **Environment leaks from Vitest into child builds** are not a problem here, because
  the script runs outside Vitest. Still sanitise `NODE_ENV` and `BASE_URL` as
  `runBuild` does, in case someone calls it from a test.
- **A temp outdir left behind.** Clean it up in a `finally`.

## Review Guidance

- The fixture and the stamp were written by the script. Check that the stamp matches
  the installed versions.
- Any fixture diff is explained in the history.
- The stamp test is fast-project, build-free, and has a positive control.
- Provenance comments no longer claim a pre-carrier capture.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP04 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP04 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
