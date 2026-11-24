---
work_package_id: WP07
title: Snapshot, hub page and --check CLI
dependencies:
- WP06
requirement_refs:
- FR-009
- FR-010
- FR-004
- NFR-004
- NFR-005
- C-001
- C-002
- C-003
- SC-002
- SC-005
planning_base_branch: feat/401-tom-annex-export
merge_target_branch: feat/401-tom-annex-export
branch_strategy: Planning artifacts for this mission were generated on feat/401-tom-annex-export. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/401-tom-annex-export unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-tom-annex-export-01M84YDP
base_commit: 4d433e4ee3491a63c383f7ab8f9e20c63fe5e179
created_at: '2026-11-24T17:23:24.046200+00:00'
subtasks:
- T030
- T031
- T032
- T033
- T034
agent: claude
history:
- timestamp: '2026-11-23T21:18:04Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/scripts/tom-annex.mjs
create_intent:
- src/scripts/tom-annex.mjs
- src/lib/tom-annex/hub-page.mjs
- src/lib/tom-annex/check.mjs
- src/tests/tom-annex-hub-page.test.ts
- src/tests/tom-annex-check.test.ts
- src/tests/tom-annex-cli.test.ts
- example/docs/_meta/tom-annex.snapshot.json
- example/docs/context/evidence-index/index.md
execution_mode: code_change
owned_files:
- src/scripts/tom-annex.mjs
- src/lib/tom-annex/hub-page.mjs
- src/lib/tom-annex/check.mjs
- src/tests/tom-annex-hub-page.test.ts
- src/tests/tom-annex-check.test.ts
- src/tests/tom-annex-cli.test.ts
- example/docs/_meta/tom-annex.snapshot.json
- example/docs/context/evidence-index/index.md
- package.json
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP07 - Snapshot, hub page and `--check` CLI

> **GATE (C-002): do not claim until PR #445 (ADR-0087) has merged, and WP06 is
> approved.**

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

A bare-Node CLI, `src/scripts/tom-annex.mjs`, which reads the **built**
`<dist>/api/tom-annex.json`. It never evaluates site config or Astro, and runs no
other repository's code (C-003). It can:

- `--snapshot <path>`: write an opt-in committed snapshot, the exact bytes of the
  built artifact (FR-009, User Story 4).
- `--hub <path>`: write an opt-in rendered hub page that groups measures by
  nature, then scope, stamped by `doc-kitty-tom-annex` (FR-010, User Story 5).
- `--check`: write nothing, and report each configured file with the ADR-0087 D3
  verdicts. Exit 0 when clean, 1 on drift, 2 on a usage or input error.

> **Evidence index, not the contractual annex.** ⚖ Counsel decides whether a DPA
> may cite the living index or needs a dated snapshot; this WP makes both possible.

Requirements: FR-009, FR-010, FR-004, NFR-004, NFR-005, C-001, C-003, SC-005.
Depends on: WP06.

## Branch strategy

- The planning branch and final merge target are both `feat/401-tom-annex-export`.
- The worktree comes from `lanes.json`.
- Run `spec-kitty agent action implement WP07 --agent claude --mission tom-annex-export-01M84YDP`.

## Context

- ADR-0087 D3 defines the verdicts, the output line `<producer> <verdict> <path>`
  followed by the registry's regenerate hint, and the exit codes.
- Bare-Node CLI precedents: `src/scripts/generate-feature-pages.mjs` (`--check`
  at line 167), `generate-adr-index.mjs` and `export-okf.mjs`. Copy their argument
  parsing, `--help`, and exit-2 handling for missing paths.
- Producer helpers: `isProducerOwnedPage` and `scanProducerOutput`
  (`src/lib/producer-output.mjs`), and `serializeStamp` (`generator-stamp.mjs`)
  for the Markdown frontmatter stamp.
- The example opt-in lives under `example/docs/context/`, an existing section.
  The hub is `context/evidence-index/index.md`, with `kind: Hub`.

## Subtasks

### T030 — `hub-page.mjs` (FR-010)

**Steps**:
1. A pure `renderHubPage(annex) -> string`, producing Markdown with:
   - frontmatter that fully satisfies the metadata contract:
     - `title: "Evidence index (TOM)"`;
     - a `description` that includes the label;
     - `doc_status: active`, `type: Reference`, `kind: Hub`;
     - `updated` set to the annex `generated.at` when present, and omitted otherwise. **Never** use the clock;
     - the `generated` block via `serializeStamp`, with `by` and `at` from the annex, `content_hash` over the rendered body, and `source_digest` copied from the annex;
   - a `> [!CAUTION]` block with `TOM_ANNEX_LABEL`, `TOM_ANNEX_NOTICE` and the ⚖ items;
   - sections per nature in the fixed order `technical`, `organisational`, `legal`, `physical`, each with a "System" and an "Organisation" sub-list. Each measure shows its label, framework references and the links to its evidence pages, with notes;
   - an "Uncovered measures" section.
2. Red tests: golden output for the WP01 canonical fixture; empty natures are
   omitted; label present; no clock (faked `Date` unused).

### T031 — `check.mjs`: ADR-0087 verdicts

**Steps**:
1. A pure `checkSnapshot({committedText, builtText})` returns a verdict:
   - `missing` when there is no committed text;
   - `hand-edited` when the committed body's recomputed `content_hash` differs
     from its own `generated.content_hash`;
   - `stale-source` when the `source_digest` differs from the built one;
   - `stale-render` when the digests are equal but the bytes differ with `at`
     masked (substitute the committed `at` before comparing; ADR-0087 D5);
   - `ok` otherwise.
   Evaluate in that order and document why: a hand edit is the most actionable.
2. `checkHub({committedText, builtAnnex})` does the same for the hub page. Render
   the expected page from the built annex and compare under the same rules, using
   the stamp in the page frontmatter.
3. Red tests, one per verdict, each on a variant of **one** base fixture (shared
   fixture, per the non-vacuity tactic).

### T032 — The CLI

**Steps**:
1. Arguments:
   - `--dist <dir>` (required);
   - `--snapshot <path>` and `--hub <path>`: at least one is required, else exit 2 with usage;
   - `--check`;
   - `--help`.
2. Missing `<dist>/api/tom-annex.json`:
   - with `--check`, that is the `missing` verdict for the source. Exit 1 and say
     "the build produced no evidence index (no published classified pages?)";
   - when writing, exit 2.
3. Write mode:
   - write the snapshot bytes verbatim, and the hub via `renderHubPage`;
   - create parent directories;
   - refuse to overwrite a file that is **authored**, meaning not stamped by this
     producer (`isProducerOwnedPage` for the hub; for the snapshot, the JSON lacks
     `format: doc-kitty/tom-annex` or `generated.by` with this producer). Exit 1
     naming it.
4. Check mode: print one line per non-`ok` file as
   `doc-kitty-tom-annex <verdict> <path>`, then the regenerate hint, and exit 1 if
   any line was printed.
5. **Out of map, one line, record the rationale**: add `"dockitty-tom-annex": "./scripts/tom-annex.mjs"`
   to `src/package.json` `bin`. WP03 owns that file; the bin target exists only
   now.

### T033 — Example opt-in

**Steps**:
1. Root `package.json` scripts, following the `generate:features` /
   `validate:features` pair:
   - `"generate:tom-annex": "node src/scripts/tom-annex.mjs --dist example/dist --snapshot example/docs/_meta/tom-annex.snapshot.json --hub example/docs/context/evidence-index/index.md"`;
   - `"validate:tom-annex"`: the same command with `--check`.
2. Build the example, run `generate:tom-annex`, and commit both files.
3. **Existing example goldens will shift**, because a new page changes the
   sitemap, `llms.txt`, page counts and the sidebar. Update each deliberately, and
   list every changed golden in the hand-off.
4. CI wiring is **not** in this WP: a check that needs a build belongs after
   `build-example`. Propose the step in the hand-off for the operator to place.
   Do not edit `.github/workflows`.

### T034 — CLI tests

**Steps**: `src/tests/tom-annex-cli.test.ts` runs the script with `execFileSync`
on a temp `dist` holding a built annex fixture (use the WP01 serialiser with the
WP06 stamp). Cases:
- write, then check gives `ok` (exit 0);
- change the built annex digest gives `stale-source` (exit 1);
- edit the committed snapshot body gives `hand-edited`;
- the same digest with different rendering gives `stale-render`;
- no committed file gives `missing`;
- no flags gives exit 2;
- an authored file at the target is refused.

## Definition of Done

- [ ] The CLI writes and checks both files, with the ADR-0087 verdicts, output line and exit codes.
- [ ] The hub page passes `pnpm validate:example` and carries the label and the ⚖ items.
- [ ] The example has both opt-ins committed, and its goldens are updated with a listed rationale.
- [ ] `pnpm test` passes in full, and `pnpm validate:tom-annex` is clean after `pnpm --filter example build`.

## Risks

- **Ordering between a build and the hub page**: the hub is committed Markdown
  rendered from the previous build's annex. After a content change the check is
  red until it is regenerated. That is the drift gate working; document it in the
  guide (WP08).
- **The hub page itself is classified?** It must **not** carry
  `tom_classification`, or it would evidence itself. Add a test.

## Reviewer guidance

- Run every verdict path by hand once.
- Confirm there is no `Date` use in `hub-page.mjs` or `check.mjs`.
