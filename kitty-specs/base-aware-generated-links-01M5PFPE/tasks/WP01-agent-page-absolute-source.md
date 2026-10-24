---
work_package_id: WP01
title: Absolute per-page agent source (#236)
dependencies: []
requirement_refs:
- FR-001
- NFR-001
- C-002
- SC-001
planning_base_branch: fix/base-aware-generated-links
merge_target_branch: fix/base-aware-generated-links
branch_strategy: Planning artifacts for this mission were generated on fix/base-aware-generated-links. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/base-aware-generated-links unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-base-aware-generated-links-01M5PFPE
base_commit: 50fea454e18455ef82c1e0a4965fd9831747da6f
created_at: '2026-10-24T14:19:42.116623+00:00'
subtasks:
- T001
- T002
- T003
history:
- '2026-10-24: created by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/routes/agent-page.ts
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/routes/agent-page.ts
- src/tests/agent-page-includes.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load the `implementer-ivan` profile with the `/spk-charter-profile-load` skill before you read anything else.

## Objective

On a site with a `base`, `/api/pages/<id>.json` must emit `source` as the absolute URL with the base included. It must equal `_links.self.href` and the `source` that `/api/index.json` gives for that page. Issue #236, FR-001.

## Context

- `src/lib/metadata.ts:361`: `toAgentRecord` sets a base-less `source`. **Do not change it** (C-002, ADR-0037). The base is added only at the route boundary.
- `src/lib/routes/agent-index.ts:89`: `const source = absolute(site, record.source)`. This is the pattern to copy.
- `src/lib/routes/agent-page.ts:86-107`: the payload spreads `...record`, so `source` stays bare. `_links.self` (`:106`) already wraps it.
- `absolute()` and `withBase` are in `src/lib/routes/shared.ts`, around `:140`. They read the configured base from the environment (`import.meta.env.BASE_URL`).

## Subtasks

### T001: Red-first test with a base set
- In `src/tests/agent-page-includes.test.ts`, add a `describe` that sets a base. Use the pattern from `src/tests/absolute-url-base.test.ts`: `vi.stubEnv('BASE_URL', '/sub/')` inside the `it` block, and `vi.unstubAllEnvs()` in `afterEach`. `withBase` reads the env on every call, so no module reset is needed.
- Use the harness that already exists in that file (`SITE = new URL('https://docs.example/')`, `ctx`).
- Assert all of the following:
  - `payload.source === payload._links.self.href`
  - `payload.source` starts with `https://docs.example/sub/api/pages/`
  - if the index route can be invoked cheaply in the same harness, that `source` also equals the index entry's `source`
- Run the test and confirm it **fails** on the current code. Record the failure output in your hand-off.

### T002: The fix
- In `agent-page.ts`, add `const source = absolute(site, record.source);` next to `url`.
- Put `source` in the payload **after** `...record`, so it overrides the spread value.
- Use `self: { href: source }`.
- Fix the comment at `:103-104`. It currently says hrefs go "like `url`/`source`", which was untrue before this fix. It should say that `source` IS `self`.

### T003: Unbased row
- With no base, assert `source === 'https://docs.example/api/pages/<id>.json'`.
- Assert that the whole payload minus `source` deep-equals the payload produced by the unmodified code. Capture that payload as an inline snapshot **before** T002, then compare after (NFR-002).

## Definition of Done
- The new tests pass, and T001 is shown to fail without T002.
- `pnpm vitest run` passes for the touched test file, and `pnpm tsc --noEmit` (or the repo's typecheck script) shows no new errors.
- `toAgentRecord` and `agent-api.test.ts:33,41` are untouched.
- One commit, message `fix(agent-api): emit absolute per-page source (#236)`, ending with the session's attribution trailer.

## Risks / reviewer notes
- If the env stub doesn't reach `absolute()`, look at how `shared.ts` reads the base. You may need a dynamic `import()` after the stub, or an existing test helper.
- Reviewer: confirm that `source` comes after the spread, and that there is no base-less `source` left anywhere in the payload.

Implement with `spec-kitty agent action implement WP01 --agent claude --mission base-aware-generated-links-01M5PFPE`.
