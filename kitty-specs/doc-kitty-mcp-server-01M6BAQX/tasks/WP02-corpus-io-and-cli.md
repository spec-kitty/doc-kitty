---
work_package_id: WP02
title: Corpus IO, snapshot loader, launch CLI
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-002
- FR-005
- FR-006
- FR-007
- NFR-001
- NFR-005
planning_base_branch: feat/doc-kitty-mcp-server
merge_target_branch: feat/doc-kitty-mcp-server
branch_strategy: Planning artifacts for this mission were generated on feat/doc-kitty-mcp-server. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/doc-kitty-mcp-server unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-doc-kitty-mcp-server-01M6BAQX
base_commit: 9c61ab1a19c330ffce2b2b7ea3381b07716992a2
created_at: '2026-11-01T18:22:56.695292+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
history:
- '2026-11-01 planned: created from IC-02 of plan.md after post-plan squad amendments'
authoritative_surface: mcp/
create_intent:
- mcp/package.json
- mcp/tsconfig.json
- mcp/src/cli.ts
- mcp/src/errors.ts
- mcp/src/corpus/source.ts
- mcp/src/corpus/http-source.ts
- mcp/src/corpus/fs-source.ts
- mcp/src/corpus/snapshot.ts
execution_mode: code_change
mission_slug: doc-kitty-mcp-server-01M6BAQX
owned_files:
- mcp/package.json
- mcp/tsconfig.json
- mcp/src/corpus/**
- mcp/src/cli.ts
- mcp/src/errors.ts
- mcp/tests/corpus/**
- pnpm-workspace.yaml
- .github/filters.yml
- package.json
tags: []
tracker_refs: []
---

# WP02 - Corpus IO, snapshot loader, launch CLI

## Objective

Stand up the `mcp/` workspace package that turns doc-kitty machine artifacts into an in-memory corpus:

1. Package scaffolding wired into the workspace, CI path filters and root scripts.
2. Named error taxonomy.
3. `CorpusSource` port with two adapters: HTTPS and filesystem.
4. Launch-time snapshot loader with contract handshake, per-artifact buildId comparison, gating detection.
5. CLI (`--site` / `--dir`, `--link-base`, `--resource-threshold`) with documented exit codes.

The server itself (tools/resources) is WP03; this WP stops at a validated `CorpusSnapshot` the server will consume.

Squad context you must respect:

- **Snapshot-at-start is load-bearing** (`research.md` R2): full corpus loaded once at launch, pinned in memory; lazy per-request fetch is a rejected trap (latency + torn corpora under GitHub Pages' `max-age=600`).
- **buildId compare-all** (A3/D3): every fetched artifact's `buildId` must equal the index's; mismatch -> `BUILD_IDENTITY_MISMATCH`, refuse to become ready. Corpora WITHOUT any `buildId` (pre-WP01) load with a warning, not a refusal (migration allowance in contracts/mcp-surface.md).
- **Identity from records, never slug arithmetic** (`research.md` R4 note): home page has `slug: ""` and maps to `api/pages/home.json`; naive joining provably 404s. Use each index record's `_links`/artifact reference verbatim.
- **No schema library import** (NFR-003 + D7): hand-rolled presence/shape guards only.
- **Hand-rolled sections tolerance** (V2 fix): pre-WP01 corpora have no `sections[]`; also tolerate the legacy home-record empty `section` value by mapping it to the site root section.

## Context

- Mission: `kitty-specs/doc-kitty-mcp-server-01M6BAQX/` - read `spec.md` (FR-001/002/005/006/007, NFR-001, NFR-005), `contracts/mcp-surface.md` (handshake, carve-out, CLI), `data-model.md`.
- Fixtures for unit tests: `example/dist/api/**` exists in the repo after an example build; the WP06 clean-room test builds it fresh, but unit tests use committed fixtures: mint with `pnpm --filter example build` (fresh clones have no example/dist - gitignored) and copy into `mcp/tests/corpus/fixtures/` (inside this WP's write scope; WP05 owns `mcp/tests/fixtures/**` separately and owns build-lane freshness anchoring).
- Toolchain: TypeScript ESM, Node >= 22.22. This package is the first in the workspace that needs `tsc` EMIT (the toolkit ships raw TS): `mcp/tsconfig.json` compiles `src/` to `dist/` (declaration + js), `compilerOptions.types: ["node"]` (SDK .d.mts references Buffer; TS >= 6 stops auto-including @types).
- NFR-001: start-to-ready <= 5 s (fs) / <= 15 s (HTTPS) on the 68-page example; <= 60 s HTTPS at 1000 pages with bounded parallelism >= 8.

## Subtask guidance

### T006 - Package scaffold + wiring

- `mcp/package.json`: name `@spec-kitty/doc-kitty-mcp`, `private: true` (enforces C-002 by construction - D8), `type: "module"`, `engines.node >= 22.22.0`, `bin: { "doc-kitty-mcp": "./dist/cli.js" }`, `files: ["dist"]`, scripts `build` (tsc) and `test` (vitest run).
- Dependencies: exactly one runtime dep entry `@modelcontextprotocol/server` pinned `2.4.0` (re-check `npm view @modelcontextprotocol/server version` first - re-pin to then-current 2.x and say so in the PR); devDeps for typescript/vitest/@types/node per repo conventions.
- `pnpm-workspace.yaml`: add `mcp`. Root `package.json`: widen `test`/`lint`/`typecheck` so mcp runs in CI (follow existing `--filter` style).
- `.github/filters.yml`: add groups for `mcp/**` and `tests/consumption/**` (A4: `ci-ok` is fail-closed; a PR touching only unclassified paths stalls CI).
- Root `package.json`: also add the `assert:supply-chain` script entry calling `node mcp/scripts/audit-closure.mjs` (land the call site here; the script itself ships in WP06; WP05's lane invokes it - this keeps root package.json single-owner).

### T007 - errors.ts

Seven named errors exactly as specced (`contracts/mcp-surface.md` / data-model.md): `UNKNOWN_CONTRACT_MAJOR`, `UNREACHABLE_ENDPOINT`, `MALFORMED_CORPUS`, `PAGES_LINKS_GATED`, `BUILD_IDENTITY_MISMATCH`, `PAGE_NOT_FOUND`, and `UNSUPPORTED_CLIENT_REVISION` (NFR-004 requires it - the post-tasks reviewer caught that a six-entry freeze contradicted the spec). Class with stable `code` field; carrying cause for diagnostics. No other error names may appear in later WPs.

### T008 - HTTPS adapter (`http-source.ts`)

- `HttpCorpusSource implements CorpusSource`: fetch index first; on success fetch per-page artifacts and (if linked) scenarios.json; bounded parallelism (c=8); one documented retry (immediate, once) then `UNREACHABLE_ENDPOINT`.
- Timeouts: per-request 15 s; total budget instrumentation via logger callback so T023 can measure against NFR-001.
- Guard every payload with hand-rolled shape checks -> `MALFORMED_CORPUS` on violation (message includes path + offending key).

### T009 - Filesystem adapter (`fs-source.ts`)

- `FsCorpusSource` reads the same artifact set from a directory (expected layout `api/index.json`, `api/pages/*.json`, optionally `api/scenarios.json`).
- Re-origining (FR-007): rewrite ONLY the link fields enumerated in the contract carve-out (`links`, `source`, `url`, `_links`) from the baked origin to the effective link base: explicit `--link-base`, else the site's declared origin from the index title metadata; never rewrite `markdown` or any content field.
- No sockets: fs mode must perform zero network access (WP05 tests this with network blocked).

### T010 - Snapshot loader (`snapshot.ts`) + CLI (`cli.ts`) + tests

- `loadSnapshot(source)`: fetch all artifacts; version handshake on index `version` string major (`"3"` today; unknown or non-numeric -> `UNKNOWN_CONTRACT_MAJOR`); buildId compare-all over every artifact that carries the field; missing everywhere -> warn-and-load (migration allowance); pages-gating detection rule (pinned): gated := index records lack `_links.self`; identity/fetch uses `_links.self.href` verbatim when present; never fetch `source` (emitted unconditionally, dangles in gated mode). Page `id` derivation (pinned): artifact path relative to `api/pages/` minus `.json` (home => `home`; nested keeps slashes). Pages-gated snapshot -> marked pages-gated (`PAGES_LINKS_GATED` surfaced via capabilities later; load continues degraded).
- `cli.ts` (owned here per D9): FIRST LINE is `#!/usr/bin/env node` - tsc PRESERVES but never creates a shebang; without it `npx <tarball>` dies on POSIX with ENOEXEC/shell-fallback syntax errors while `node .bin/...` stays green (WP06 T025 asserts direct execution to close this). Parse args, resolve source, load snapshot, on success hand the snapshot to the server module (WP03 wires it), exit 0 on clean shutdown, exit 2 on launch failure printing the named error.
- Unit tests under `mcp/tests/corpus/`: fixtures for happy path (fs + http via local static server), unknown-major fixture, non-numeric-version fixture, torn buildId fixture (buildId enabled), gated-pages fixture, dead-origin fs fixture.

## Definition of Done

- [ ] `pnpm install` clean; `pnpm --filter @spec-kitty/doc-kitty-mcp build && test` green.
- [ ] Snapshot over example fixture (both adapters) materializes all 68 pages with metadata; fs mode rewrites only link fields.
- [ ] Unknown major -> exit 2 + UNKNOWN_CONTRACT_MAJOR; torn buildId -> exit 2 + BUILD_IDENTITY_MISMATCH; pre-buildId fixture loads with warning.
- [ ] No `import` of zod/ajv or any schema library; no new runtime dep beyond the pinned SDK.
- [ ] CI: `mcp/**` PR triggers mcp lanes and does not stall `ci-ok`.

## Risks / reviewer guidance

- Reject lazy fetching or per-request revalidation (kills R2).
- Reject slug-derived artifact paths (must use record `_links`).
- Reject any artifact interpretation beyond the documented projection (C-006).
- Reviewer: verify the guards reject malformed fixtures with path-precise messages, and that fs mode opens no sockets.

## Branch strategy

Planning base branch: `feat/doc-kitty-mcp-server`; merge target: `main`. Lane/worktree from `lanes.json`; depends on WP01 lane's completion (contract types) - see `dependencies` in frontmatter.

Implementation command: `spec-kitty agent action implement WP02 --agent <name> --mission doc-kitty-mcp-server-01M6BAQX`
