# Tasks: Packs reader, charter contract snapshot and producer registry

**Mission**: `packs-reader-producer-registry-01M81KGE` · **Issue**: #330 (epic #328) · **Lands on**: `feat/330-packs-reader-producer-registry`
**Inputs**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

## Subtask Index

| ID | Description | WP | Parallel |
|---|---|---|---|
| T001 | Red tests for the registry, scopes and a directories-scoped positive control | WP01 | |
| T002 | `src/lib/producers.mjs`: registry, scopes, `ownerOfPage` | WP01 | |
| T003 | `generator-stamp.mjs` reads producers, retired stamps and hints from the registry | WP01 | |
| T004 | `isGeneratedPage` and `validate()` through the registry, with `producerScopes` | WP01 | |
| T005 | `src/lib/producer-output.mjs`; Gherkin `scanOutputDir` delegates to it | WP01 | |
| T006 | Vendor the snapshot files at `69ec326` with `.gitattributes` `-text` | WP02 | |
| T007 | `contract.lock.json` and the red-first lock test (byte change, added, removed file) | WP02 | |
| T008 | `loadContract(dir)`: lock check, parse, unknown key and content-form warnings | WP02 | |
| T009 | `packs-sync-contract.mjs` and `pnpm packs:sync-contract`, tested on a temp git repo | WP02 | |
| T010 | Glob compiler with the contract's segment rules | WP03 | |
| T011 | Five-step classification with the retired and root-case-variant rules | WP03 | |
| T012 | Conformance test over every vendored case, plus a rule-coverage check | WP03 | |
| T013 | Fixture trees: with manifest, no manifest, retired file, stale manifest | WP04 | [P] |
| T014 | README parser (`readme.mjs`) | WP04 | [P] |
| T015 | Descriptor, presets and policy reading | WP04 | |
| T016 | Walk, classification problems, symlinks, inventory from the walk | WP04 | |
| T017 | Manifest verification (hashes, membership, unknown kind) and inventory source | WP04 | |
| T018 | `charterLock` comparison, `contract` commits, deterministic problem order | WP04 | |
| T019 | `readPack` public surface (`index.mjs`) and the model tests | WP04 | |
| T020 | `resolvePacksOptions` and the `packs` option in `config.ts` | WP05 | |
| T021 | `dockitty-read-pack` CLI and `bin` entry | WP05 | |
| T022 | `packs-corpus` vitest project, open-packs pin, corpus test | WP05 | |
| T023 | CI step in `code-quality` that fetches the pinned open-packs and runs the corpus | WP05 | |
| T024 | ADR-0083: the producer registry and ownership scopes (extends ADR-0079) | WP06 | [P] |
| T025 | `docs/architecture/packs.md` and `generators.md` describe what is built | WP06 | [P] |
| T026 | Consumer setup: `packs.charterLock`, `packs.contract`, `dockitty-read-pack` | WP06 | [P] |
| T027 | Changelog fragment | WP06 | [P] |

## Phase 1: Foundations (parallel lanes)

### WP01 — Producer registry and ownership scopes

**Prompt**: [tasks/WP01-producer-registry.md](tasks/WP01-producer-registry.md) · **Priority**: P1 · **Depends on**: none
**Goal**: one registry behind every gate that recognises a generated page, with no behaviour change for existing sites.
**Independent test**: the registry tests pass, and every existing Gherkin, glossary and stamp test passes unedited.

T001 Red tests for the registry, scopes and a directories-scoped positive control (WP01)
T002 `src/lib/producers.mjs`: registry, scopes, `ownerOfPage` (WP01)
T003 `generator-stamp.mjs` reads producers, retired stamps and hints from the registry (WP01)
T004 `isGeneratedPage` and `validate()` through the registry, with `producerScopes` (WP01)
T005 `src/lib/producer-output.mjs`; Gherkin `scanOutputDir` delegates to it (WP01)

Risks: #410 touches `makeStamp`; keep edits to the lookups. Do not edit existing tests.

### WP02 — Contract snapshot, lock and sync

**Prompt**: [tasks/WP02-contract-snapshot.md](tasks/WP02-contract-snapshot.md) · **Priority**: P1 · **Depends on**: none
**Goal**: a byte-exact, lock-checked snapshot of the packs contract at `contract-packs-v0.1.0-rc.1`, and a script to refresh it.
**Independent test**: the lock test passes, and fails on a changed, added or removed file.

T006 Vendor the snapshot files at `69ec326` with `.gitattributes` `-text` (WP02)
T007 `contract.lock.json` and the red-first lock test (WP02)
T008 `loadContract(dir)` (WP02)
T009 `packs-sync-contract.mjs` and `pnpm packs:sync-contract` (WP02)

## Phase 2: Reader

### WP03 — Classifier held to the conformance cases

**Prompt**: [tasks/WP03-classifier.md](tasks/WP03-classifier.md) · **Priority**: P1 · **Depends on**: WP02
**Goal**: classification exactly as the charter's cases state it.
**Independent test**: every vendored case passes; every rule in `file-kinds.yaml` has a case.

T010 Glob compiler with the contract's segment rules (WP03)
T011 Five-step classification (WP03)
T012 Conformance test and rule coverage (WP03)

### WP04 — `readPack` and `PackModel`

**Prompt**: [tasks/WP04-pack-reader.md](tasks/WP04-pack-reader.md) · **Priority**: P1 · **Depends on**: WP03
**Goal**: the tolerant reader of ADR-0079 D3 and D4.
**Independent test**: the four fixtures read into the documented model with the expected problems and `verified` flags.

T013 Fixture trees (WP04)
T014 README parser (WP04)
T015 Descriptor, presets and policy (WP04)
T016 Walk, classification problems, symlinks, walk inventory (WP04)
T017 Manifest verification and inventory source (WP04)
T018 `charterLock`, contract commits, deterministic order (WP04)
T019 Public surface and model tests (WP04)

## Phase 3: Surfaces

### WP05 — `packs` option, CLI and the open-packs corpus

**Prompt**: [tasks/WP05-option-cli-corpus.md](tasks/WP05-option-cli-corpus.md) · **Priority**: P2 · **Depends on**: WP04
**Goal**: consumers and maintainers can use the reader, and CI proves it on every open-packs pack.

T020 `resolvePacksOptions` and the `packs` option (WP05)
T021 `dockitty-read-pack` CLI and `bin` entry (WP05)
T022 `packs-corpus` project, pin, corpus test (WP05)
T023 CI corpus step (WP05)

### WP06 — ADR-0083, docs and changelog

**Prompt**: [tasks/WP06-adr-docs-changelog.md](tasks/WP06-adr-docs-changelog.md) · **Priority**: P2 · **Depends on**: WP01, WP05
**Goal**: the decision record and living docs for the registry, the reader, the option and the CLI.

T024 ADR-0083 (WP06)
T025 Architecture docs (WP06)
T026 Consumer setup (WP06)
T027 Changelog fragment (WP06)

## Dependency graph

```
WP01 ─────────────────────────────┐
WP02 → WP03 → WP04 → WP05 ────────┴→ WP06
```

MVP: WP01 (unblocks #359 and #413's registry entries) and WP02 to WP04 (unblocks #338).
