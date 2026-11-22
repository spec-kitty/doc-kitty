---
work_package_id: WP05
title: packs option, CLI and the open-packs corpus
dependencies:
- WP04
requirement_refs:
- FR-012
- FR-013
- FR-014
- NFR-001
- NFR-003
- SC-002
- C-005
planning_base_branch: feat/330-packs-reader-producer-registry
merge_target_branch: feat/330-packs-reader-producer-registry
branch_strategy: Planning artifacts for this mission were generated on feat/330-packs-reader-producer-registry. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/330-packs-reader-producer-registry unless the human explicitly redirects the landing branch.
subtasks:
- T020
- T021
- T022
- T023
agent: claude
history:
- timestamp: '2026-11-22T12:40:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/packs/options.mjs
create_intent:
- src/lib/packs/options.mjs
- src/scripts/read-pack.mjs
- src/tests/packs-options.test.ts
- src/tests/read-pack-cli.test.ts
- src/tests/packs-open-packs.corpus.ts
- src/tests/fixtures/packs-corpus/open-packs.pin.json
execution_mode: code_change
owned_files:
- src/lib/packs/options.mjs
- src/lib/config.ts
- src/scripts/read-pack.mjs
- src/package.json
- src/vitest.workspace.ts
- src/tests/packs-options.test.ts
- src/tests/read-pack-cli.test.ts
- src/tests/packs-open-packs.corpus.ts
- src/tests/fixtures/packs-corpus/**
- .github/workflows/ci.yml
role: implementer
---

# WP05 — `packs` option, CLI and the open-packs corpus

## ⚡ Do This First: Load Agent Profile

Load the assigned profile before reading anything else: run `/spk-charter-profile-load node-norris`.

## Objective

Expose the reader: the `packs` integration option (`charterLock`, `contract`;
FR-011 to FR-013, decision D3), the `dockitty-read-pack` CLI (FR-014), and the
open-packs corpus proof in CI (SC-002, NFR-001, decision D4).

## Branch strategy

Planning branch and final merge target: `feat/330-packs-reader-producer-registry`.
Run `spec-kitty agent action implement WP05 --agent claude --mission packs-reader-producer-registry-01M81KGE`.

## Subtasks

### T020 — `resolvePacksOptions` and the `packs` option

`src/lib/packs/options.mjs`:

```js
export const PACKS_LOG_PREFIX = '[dk-packs]';
/** @returns {{ charterLock?: string, contract?: string }} absolute paths */
export function resolvePacksOptions(value, { cwd = process.cwd() } = {}) {...}
```

- `value` must be a plain object. Unknown keys fail:
  `[dk-packs] unknown key "<k>" in the packs option; this version accepts charterLock and contract (pack pages arrive with #338)`.
- `charterLock` and `contract`: optional non-empty strings, resolved against `cwd`.
- `contract`: must be a directory, and `loadContract(dir)` must succeed (it
  throws a `[dk-packs]` error on a lock mismatch). Check it eagerly.
- `charterLock` is **not** required to exist at config time (the reader warns).
- `src/lib/config.ts`: add `packs?: DocKittyPacksOption` with JSDoc (shape,
  ADR-0079 D2, "#338 adds sources, section, include, exclude"); call
  `resolvePacksOptions` eagerly beside the Gherkin and OpenAPI validation. Store
  nothing else yet. Add the TypeScript type
  `export interface DocKittyPacksOption { charterLock?: string; contract?: string }`.
- `src/tests/packs-options.test.ts`: unknown key, wrong type, empty string, a
  `contract` dir with a bad lock (copy the vendored snapshot, flip a byte), a
  valid `contract` dir, relative paths resolved against `cwd`. Also one test
  that `defineDocKittyIntegrations({ packs: { bogus: 1 } })` throws `[dk-packs]`
  (find how existing tests call `defineDocKittyIntegrations`, e.g.
  `config-invariants*.test.ts`, and follow that pattern).

### T021 — `dockitty-read-pack`

`src/scripts/read-pack.mjs` (`#!/usr/bin/env node`, mode **100755**:
`git update-index --chmod=+x`), `bin` entry in `src/package.json`. Contract in
`contracts/cli-read-pack.md`.

- Args: `<dir>` (required), `--json`, `--charter-lock <file>`, `--contract <dir>`,
  `--repo-root <dir>`, `--help`. Use `node:util` `parseArgs`.
- Exit 2 with a message for a usage error, a dir with no `pack.yaml`, or a
  contract error. Exit 0 otherwise.
- Human output: `name (dir) version level`, `pack_id`, manifest state
  (`verified`/`unverified`/`absent`), inventory per kind with counts and its
  source, then `warning [code] file: message` lines, then a one-line summary.
- `src/tests/read-pack-cli.test.ts`: spawn the script on WP04's `alpha` fixture
  with `--json` and parse; human output contains the inventory source; missing
  dir exits 2; `--charter-lock` with a mismatching commit includes
  `charter-lock-mismatch`.

### T022 — The corpus project

- `src/tests/fixtures/packs-corpus/open-packs.pin.json`:
  `{ "repository": "https://github.com/spec-kitty/spec-kitty-open-packs", "commit": "0be738ac07bc4d7dbaba54011bdb250c806728df" }`.
- `src/vitest.workspace.ts`: a third project `packs-corpus` with
  `include: ['tests/**/*.corpus.ts']`. The `fast` include (`tests/**/*.test.ts`)
  does not match `.corpus.ts`, so `pnpm test` is unchanged.
- `src/package.json` script `"test:packs-corpus": "vitest run --project packs-corpus"`.
- `src/tests/packs-open-packs.corpus.ts`:
  - `DK_OPEN_PACKS_DIR` unset → the suite **fails** with a message telling how
    to fetch the pinned commit (never `skip`).
  - Check the checkout is at the pinned commit (`git -C <dir> rev-parse HEAD`),
    fail otherwise.
  - Every `packs/*/pack.yaml` directory: `readPack` does not throw, `identity.packId`
    is a ULID, `identity.version` non-empty; with
    `charterLock: <dir>/charter.lock.yaml`, `contract.provenAgainst` is set.
  - At least 19 packs.
  - Total time under 5 s (NFR-001), measured with `performance.now()`.
  - Print a one-line summary per pack (problems by code) to the test log; do
    not assert on warning counts (they change with open-packs).

### T023 — CI step

In `.github/workflows/ci.yml` `code-quality`, after `Unit tests`:

```yaml
      - name: Packs corpus (open-packs at the pinned commit)
        run: |
          pin=$(node -p "require('./src/tests/fixtures/packs-corpus/open-packs.pin.json').commit")
          git init -q "$RUNNER_TEMP/open-packs"
          git -C "$RUNNER_TEMP/open-packs" fetch -q --depth 1 https://github.com/spec-kitty/spec-kitty-open-packs "$pin"
          git -C "$RUNNER_TEMP/open-packs" checkout -q FETCH_HEAD
          DK_OPEN_PACKS_DIR="$RUNNER_TEMP/open-packs" pnpm --filter @spec-kitty/doc-toolkit test:packs-corpus
```

Run it locally the same way before pushing.

## Definition of Done

- Tests red first, green after; lint, typecheck, unit suite and the corpus run
  clean; the bin file is `100755`.

## Risks

- `config.ts` is a busy file shared with parallel PRs (#405 adds a `pdf` option);
  keep the hunk small and next to the other eager validations.
