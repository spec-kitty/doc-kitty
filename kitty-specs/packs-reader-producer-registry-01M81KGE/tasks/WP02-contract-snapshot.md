---
work_package_id: WP02
title: Contract snapshot, lock and sync
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- C-001
planning_base_branch: feat/330-packs-reader-producer-registry
merge_target_branch: feat/330-packs-reader-producer-registry
branch_strategy: Planning artifacts for this mission were generated on feat/330-packs-reader-producer-registry. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/330-packs-reader-producer-registry unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-packs-reader-producer-registry-01M81KGE
base_commit: b344daacaf062b01e2f5d977ac0a1075b38514bf
created_at: '2026-11-22T12:44:32.645064+00:00'
subtasks:
- T006
- T007
- T008
- T009
agent: claude
history:
- timestamp: '2026-11-22T12:40:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/packs/contract/
create_intent:
- src/lib/packs/contract/file-kinds.yaml
- src/lib/packs/contract/contract.lock.json
- src/lib/packs/contract/conformance/classifier-cases.yaml
- src/lib/packs/contract/schemas/pack-descriptor.schema.json
- src/lib/packs/contract/schemas/pack-manifest.schema.json
- src/lib/packs/contract/schemas/policy.schema.json
- src/lib/packs/contract/schemas/pack-document.schema.json
- src/lib/packs/contract/schemas/preset.schema.json
- src/lib/packs/contract.mjs
- src/scripts/packs-sync-contract.mjs
- src/tests/packs-contract.test.ts
- src/tests/packs-sync-contract.test.ts
execution_mode: code_change
owned_files:
- src/lib/packs/contract/**
- src/lib/packs/contract.mjs
- src/scripts/packs-sync-contract.mjs
- src/tests/packs-contract.test.ts
- src/tests/packs-sync-contract.test.ts
- src/tests/fixtures/packs-contract/**
- .gitattributes
- package.json
role: implementer
---

# WP02 — Contract snapshot, lock and sync

## ⚡ Do This First: Load Agent Profile

Load the assigned profile before reading anything else: run `/spk-charter-profile-load node-norris`.

## Objective

Vendor a byte-exact snapshot of the charter's packs contract at tag
`contract-packs-v0.1.0-rc.1` (commit `69ec326179246c9a79eca1ba1d424f059f5153e2`),
with `contract.lock.json`, a loader that verifies the lock, and a maintainer
script that refreshes it (FR-001, FR-002, FR-003, the lock half of FR-012,
FR-010's unknown-key and content-form warnings).

## Branch strategy

Planning branch and final merge target: `feat/330-packs-reader-producer-registry`.
Run `spec-kitty agent action implement WP02 --agent claude --mission packs-reader-producer-registry-01M81KGE`
and work in the lane worktree it prints.

## Context

- Charter checkout: `git clone --depth 1 --branch contract-packs-v0.1.0-rc.1 https://github.com/spec-kitty/spec-kitty-charter`
  (public; the session proxy serves anonymous reads). Contract root: `contracts/packs/`.
- ADR-0079 D1 and D2; `research.md` R1 to R3; `data-model.md` ContractSnapshot;
  `contracts/contract-lock.schema.json`.

## Subtasks

### T006 — Vendor the files

Copy, byte for byte, into `src/lib/packs/contract/`:

- `file-kinds.yaml`
- `conformance/classifier-cases.yaml`
- `schemas/pack-descriptor.schema.json`, `pack-manifest.schema.json`,
  `policy.schema.json`, `pack-document.schema.json`, `preset.schema.json`

Add to `.gitattributes`: `src/lib/packs/contract/** -text` so git never
normalises line endings in the snapshot, and `src/tests/fixtures/packs/** -text`
so WP04's CRLF fixture keeps its bytes. Check that no formatter or linter
rewrites these files (eslint lints JS only; markdownlint lints docs only).
Add a short `src/lib/packs/contract/README.md`? **No**: the lock test requires
the directory to hold only locked files. Explain the snapshot in the
`contract.mjs` module header instead.

### T007 — Lock and lock test (red first)

`contract.lock.json`:

```json
{
  "source": "https://github.com/spec-kitty/spec-kitty-charter",
  "contractPath": "contracts/packs",
  "tag": "contract-packs-v0.1.0-rc.1",
  "commit": "69ec326179246c9a79eca1ba1d424f059f5153e2",
  "files": { "conformance/classifier-cases.yaml": "<sha256>", "file-kinds.yaml": "<sha256>", "schemas/…": "<sha256>" }
}
```

Keys sorted, two-space indent, trailing newline. `files` keys are POSIX paths
relative to the snapshot directory.

`src/tests/packs-contract.test.ts` (write before the loader exists):

1. The vendored snapshot verifies (`verifyContractLock(dir)` returns no problems).
2. Copy the snapshot to a temp dir and flip one byte of `file-kinds.yaml`:
   verification fails and the message names `file-kinds.yaml`.
3. Add an extra file: fails, naming it ("not in the lock"). Remove a locked file:
   fails, naming it ("missing").
4. The lock's `commit` is 40 lower-hex characters and `tag` is the pinned tag.
5. Independent of `contract.mjs`, recompute each sha256 in the test itself, so
   the test does not trust the code under test.

### T008 — `src/lib/packs/contract.mjs`

```js
export const VENDORED_CONTRACT_DIR // URL/path of src/lib/packs/contract
export function verifyContractLock(dir) → string[]   // problems; [] when the lock holds
export function loadContract(dir = VENDORED_CONTRACT_DIR) → {
  dir, lock, fileKinds, schemas: Record<name, object>, warnings: {code, message}[]
}
```

- `loadContract` throws `Error('[dk-packs] contract snapshot <dir> ...')` when the
  lock is missing, unreadable, or `verifyContractLock` reports any problem.
  This is the one place the packs code throws: a broken snapshot is a
  configuration error, not pack content.
- Parse `file-kinds.yaml` with `yaml` (`parse`). Known top-level keys:
  `node_kinds`, `artifact_kinds`, `fragment_kinds`, `files`, `exclusions`,
  `retired`, `payloads`, `ignored`. Any other key → warning
  `contract-unknown-key`. A rule `content_form` outside `yaml`, `markdown`,
  `bytes` (and `text`) → warning `contract-unknown-content-form`, and the rule
  is kept.
- `schemas`: parse each `schemas/*.schema.json` keyed by name without
  `.schema.json`.
- Resolve paths with `fileURLToPath(new URL('./contract/', import.meta.url))`
  so it works from the published package.
- Cache loaded snapshots per absolute dir.

### T009 — Sync script

`src/scripts/packs-sync-contract.mjs` and root `package.json` script
`"packs:sync-contract": "node src/scripts/packs-sync-contract.mjs"`.

```
packs-sync-contract --ref <tag|sha> [--from <charter checkout>] [--to <snapshot dir>]
```

- `--from` defaults to cloning `https://github.com/spec-kitty/spec-kitty-charter`
  shallow at `--ref` into a temp directory (`git clone --depth 1 --branch <ref>`;
  for a bare sha, `git init` + `git fetch --depth 1 origin <sha>`).
- Resolve the commit: `git -C <from> rev-parse <ref>^{commit}`. Record `tag`
  only when `--ref` is not the commit itself.
- The file list is the current lock's keys (the default list above when no lock
  exists). For each, `git -C <from> show <commit>:contracts/packs/<path>` →
  write bytes. Then rewrite `contract.lock.json`.
- Print what changed (`updated`, `unchanged` per file) and remind the maintainer
  to rerun the conformance tests.
- `src/tests/packs-sync-contract.test.ts`: create a temp git repo with
  `contracts/packs/...` files, tag it, run the script (`node` child process)
  with `--from` and `--to` a temp snapshot dir seeded with a lock listing two
  files; assert files and lock (commit, tag, hashes). Never touch the network.

## Definition of Done

- Lock test red before the lock and loader exist, green after; flipping a byte
  makes it fail.
- `pnpm lint`, `pnpm typecheck`, `cd src && npx vitest run` clean.
- `pnpm packs:sync-contract --ref contract-packs-v0.1.0-rc.1 --from <checkout>`
  is a no-op on the committed snapshot.

## Risks

- `.gitattributes` must cover the snapshot before the files are committed, or the
  hashes will differ across platforms.
