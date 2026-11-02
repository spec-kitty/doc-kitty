---
work_package_id: WP06
title: Packaging, supply-chain audit, clean-room consumption
dependencies:
- WP03
- WP05
- WP08
requirement_refs:
- NFR-003
- SC-001
- C-002
- C-005
planning_base_branch: feat/doc-kitty-mcp-server
merge_target_branch: feat/doc-kitty-mcp-server
branch_strategy: Planning artifacts for this mission were generated on feat/doc-kitty-mcp-server. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/doc-kitty-mcp-server unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-doc-kitty-mcp-server-01M6BAQX
base_commit: cde68fe2a6b5108019a56825da26aedad2f10fba
created_at: '2026-11-01T20:46:16.110045+00:00'
subtasks:
- T024
- T025
- T026
history:
- '2026-11-01 planned: created from IC-03 of plan.md; publishing deferred per operator ruling C-002'
authoritative_surface: tests/consumption/
create_intent:
- tests/consumption/mcp-package.test.ts
- mcp/README.md
- mcp/scripts/audit-closure.mjs
execution_mode: code_change
mission_slug: doc-kitty-mcp-server-01M6BAQX
owned_files:
- tests/consumption/mcp-package.test.ts
- tests/consumption/fixtures/**
- mcp/README.md
- mcp/scripts/**
tags: []
tracker_refs: []
---

# WP06 - Packaging, supply-chain audit, clean-room consumption

## Objective

Prove the deliverable is consumable as packed, and hard-gate its supply chain:

1. A closure audit script `mcp/scripts/audit-closure.mjs` enforcing NFR-003 mechanically: exactly one declared runtime dependency, at most 5 new lockfile entries total from this package, zero install scripts in the closure. (Call sites were pre-wired: root `assert:supply-chain` script in WP02, lane invocation in WP08's workflow file - this task ships ONLY the script.)
2. A clean-room consumption test: `pnpm pack` -> install the tarball into a throwaway fixture project (pattern: `tests/consumption/charter-cleanroom.test.ts`) -> launch over stdio -> `get_site_info` + `get_page` smoke against a served example build.
3. README + quickstart truths: supported MCP spec revision named, tarball-first wiring documented, registry form marked post-ruling (R1 fix).

Squad context you must respect:

- **V5/NFR-003**: the closure budget is now the budget of record: <= 5 new lockfile entries (`@modelcontextprotocol/server` + `@modelcontextprotocol/core` + zod, which dedupes against the toolkit's zod ^4.6.6 -> count what pnpm actually adds; if reality exceeds 5, stop and raise it, do not silently widen).
- **D8**: package stays `private: true` (WP02 set it); the consumption proof works on the tarball, publishing is out (C-002).
- **R6 evidence**: GitHub Packages npm needs a token even for public installs; the README must not advertise it as a public channel (document it as beta/internal only).
- Repo rules: changelog fragment obligation is WP07; do not edit docs/adr/README.md (bot-owned).

## Subtask guidance

### T024 - Closure audit

- Script (e.g. `mcp/scripts/audit-closure.mjs`) that runs after `pnpm install`: computes the set of lockfile entries attributable to the mcp package (everything reachable from its declared deps, minus entries already required by other workspace members), asserts count <= 5, asserts zero install scripts (`postinstall`/`preinstall`/`install`) across that set, and prints the audited count.
- Wire as a CI assertion in the mcp filter group (the lane added in WP05's workflow file or here - coordinate: workflow yaml lives in WP05's owned files; add the invocation into the existing consumption/build lane via an npm script instead, e.g. root `assert:supply-chain` called from the lane).

### T025 - Clean-room consumption test

- Follow the `tests/consumption` `installFixture` machinery (consumption-gap.test.ts precedent: pnpm, own workspace + own lockfile, `--prefer-offline` so the pinned SDK resolves from the shared store - a live-registry `npm i` is flaky and impossible offline). The charter-cleanroom precedent is pack+extract WITHOUT install - do not copy that half.
- Steps: build mcp (`tsc`), `pnpm pack` the tarball, install the tarball into the fixture, spawn the bin DIRECTLY at least once (`execFile(node_modules/.bin/doc-kitty-mcp)` / `npx --no-install ...` - proves the shebang path, not only `node ...`) over stdio, drive an SDK client: `get_site_info` then `get_page` for a known page; assert the markdown equals the fixture artifact.
- Budget: match the existing consumption lane's runtime pattern (<= ~8 min).

### T026 - README + quickstart sync

- `mcp/README.md`: what it is, the supported MCP spec revision + SDK major (NFR-004), tarball install + client config snippets (incl. the Windows `cmd /c` note), error taxonomy table, development notes (build/test), publishing status ("not published; see mission C-002").
- (Quickstart sync moved to WP07 T028 - planner lens: mission-dir writes belong to the planning lane. The local-build section of quickstart.md currently advertises the unpublished npx form; flag it for T028.)
- Pointer e2e (closes US-3/SC-001 within C-002): a doc-kitty example build with `links.mcp` enabled advertises a snippet whose command form was just proven by T025 (tarball path) - assert the emitted snippet installs+launches in the clean room.

## Definition of Done

- [ ] Closure audit green and fails when a second dependency is seeded (demonstrate once in the PR).
- [ ] Clean-room test green on CI; runtime within the lane budget.
- [ ] README states revision support and honest publishing status.
- [ ] US-3 acceptance scenario executable exactly as specced (tarball form).

## Risks / reviewer guidance

- Reject any widening of the closure budget without an operator-visible note in the PR.
- Reject registry-publish wiring (tokens, release jobs) - C-002 forbids it in this mission.
- Reviewer: the clean room must not see workspace hoisting; verify lockfile isolation.

## Branch strategy

Planning base branch: `feat/doc-kitty-mcp-server`; merge target: `main`. Depends on WP03 (server exists) and WP05 (conformance green first).

Implementation command: `spec-kitty agent action implement WP06 --agent <name> --mission doc-kitty-mcp-server-01M6BAQX`
