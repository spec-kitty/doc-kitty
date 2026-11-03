---
work_package_id: WP03
title: Shared resolver and validation for the opt-in setting
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-013
- C-003
- C-006
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: 7d3943835904623d2d0a5bd0cbb6fbed9220b101
created_at: '2026-11-02T22:18:00.879061+00:00'
subtasks:
- T012
- T013
- T014
- T015
- T016
history:
- timestamp: '2026-11-02T22:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/plantuml-external.mjs
create_intent:
- src/lib/plantuml-external.mjs
- src/tests/plantuml-external-setting.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/plantuml-external.mjs
- src/tests/plantuml-external-setting.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP03 – Shared resolver and validation for the opt-in setting

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Create `src/lib/plantuml-external.mjs`: one pure ESM module with **no imports at all**, the single owner of the opt-in setting's rules. Both the build (`src/lib/config.ts`, WP04) and the include check (`src/scripts/assert-plantuml-no-remote-include.mjs`, WP11) import it, so they resolve the identical value and source (FR-013). It exports exactly:

- `PLANTUML_ALLOW_EXTERNAL_ENV` (`'DK_PLANTUML_ALLOW_EXTERNAL'`)
- `PlantumlAllowExternalError` (class)
- `parseAllowExternalEnv(text)`
- `validateAllowExternal(siteValue)`
- `resolvePlantumlAllowExternal({ env, siteValue })` → `{ mode, entries, source }`
- `describeDeclared(resolution)`

Nothing else: canary entry and allowlist comparison belong to the check (`plantuml-mode-check.mjs`, WP06; post-plan R2).

## Context

- data-model.md §1 (Resolution type, validation rules E1–E7, precedence; E7 = `@`, from the CI spike F5).
- contracts/opt-in-setting.md (names, accepted shapes, precedence, error message shape, stable reason substrings).
- research.md R1 (setting surface; `sandbox` is not an accepted word; lowercase `internet` only; no env off-switch), R2 (module boundaries).
- Precedent for a dependency-free `.mjs` shared by TypeScript and bare Node: `src/lib/draft-publication.mjs` (JSDoc types) and `src/lib/vocabulary-core.mjs`.
- C-006: the include check runs before `pnpm install`, so this module must load with Node built-ins only; it needs none (`URL` is global).

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.

## Subtasks

### T016 – Write the tests first

**Purpose**: the tables in data-model.md are the specification; encode them before the code (DIRECTIVE_034).

**Steps**:
1. Create `src/tests/plantuml-external-setting.test.ts`.
2. `describe('resolves env, site, default')` (FR-001), table rows:
   - `{ env: undefined, site: undefined }` → `{ mode: 'sandbox', entries: [], source: 'default' }`
   - `{ env: '', site: ['https://a.example/x/'] }` → allowlist, `['https://a.example/x/']`, `site configuration` (E5)
   - `{ env: '   ', site: undefined }` → sandbox default (E5)
   - `{ env: 'https://a.example/x/', site: undefined }` → allowlist, environment
   - `{ env: 'https://a.example/x/; https://b.example/y/;', site: undefined }` → two entries, trimmed, trailing `;` harmless
   - `{ env: 'internet', site: ['https://b.example/'] }` → internet, environment (E6)
   - `{ env: 'https://a.example/x/', site: 'internet' }` → allowlist, environment (E6)
   - `{ env: undefined, site: 'internet' }` → internet, site configuration
   - entries kept in declared order, not normalized (`https://A.example/x/` stays as written).
3. `describe('rejects each shape')` (FR-002, edge cases 1–4 and 9; E1–E4 and E7), each row asserts `toThrow(PlantumlAllowExternalError)` **and** two substrings: the source label (`invalid DK_PLANTUML_ALLOW_EXTERNAL (environment)` or `invalid plantumlAllowExternal (site configuration)`) and the stable reason:
   - env `sandbox`, `yes` → `unknown value "sandbox"` / `"yes"`
   - env `INTERNET`, `Internet` → `use lowercase "internet"`
   - site `true`, `'sandbox'`, `{}`, `42` → `unknown value`
   - site `[]`, env `;`, env `; ;` → `an empty allowlist is not sandbox`
   - `ftp://a.example/x/`, `not a url`, `https://user@a.example/x/`, `https://a.example/x/?q=1`, `https://a.example/x/#f`, `https://a.example/x y/` → `is not an http(s) URL`
   - `http://host`, `http://host:8080`, `https://host/path` → `must end with "/"` **and** `also allows "http://host.evil.com"`
   - site `['https://a.example/x/;https://b.example/']` → `contains ";"`
   - `https://a.example/a@b/` (site and env), `https://a.example/@/` → `contains "@"` (edge case 9, data-model E7; spike F5: PlantUML never matches an entry containing `@`). Userinfo forms (`https://user@a.example/x/`) may report either reason; assert the `@` reason is checked **before** URL parsing so the message is stable.
   - every message contains `accepted:`.
4. `describe('describeDeclared')`: allowlist → `allowlist (from environment DK_PLANTUML_ALLOW_EXTERNAL): https://a.example/x/, https://b.example/y/`; internet from site → `internet (from site configuration)`; sandbox → `sandbox (default)`.
5. `it('has no imports (C-006)')`: read the module source with `node:fs` and assert it matches neither `/^\s*import\s/m` nor `/\bimport\(/` nor `/\brequire\(/`.
6. `it('exports only the contract surface')`: `Object.keys(await import(...)).sort()` equals the six names.

**Validation**: the file runs and fails (module missing) before T012.

### T012 – Module skeleton

**Steps**:
1. Create `src/lib/plantuml-external.mjs` with a header comment naming #268, ADR-0074 (to be written in WP10), and the rule "this module owns the setting's rules; do not duplicate them".
2. JSDoc typedef `Resolution` exactly as data-model.md §1.
3. `export const PLANTUML_ALLOW_EXTERNAL_ENV = 'DK_PLANTUML_ALLOW_EXTERNAL';`
4. `export class PlantumlAllowExternalError extends Error` with `name`, and properties `source` (`'environment' | 'site configuration'`) and `reason` (the stable reason text).
5. One private `fail(source, reason)` building: `invalid <label>: <reason>. accepted: leave unset for sandbox, "internet", or a list of http(s) URL prefixes ending in "/" (environment: joined by ";").` where label is `DK_PLANTUML_ALLOW_EXTERNAL (environment)` or `plantumlAllowExternal (site configuration)`.

### T013 – Parsing and validation

**Steps**:
1. Private `validateEntry(entry, source)`:
   - must be a string without whitespace anywhere (check before `URL` parsing, since `URL` percent-encodes spaces);
   - in the site value, `;` → `"<entry>" contains ";"` (env splits on `;` first, so it never sees one);
   - any `@` → `"<entry>" contains "@"; PlantUML never matches an allowlist entry containing "@"` (E7, both sources; checked before URL parsing);
   - `new URL(entry)` must not throw; protocol `http:` or `https:`; `username`/`password` empty; `search` and `hash` empty, and the raw text contains no `?` or `#` → otherwise `"<entry>" is not an http(s) URL`;
   - the text after `scheme://authority` must start with `/` and the entry must end with `/` → otherwise `"<entry>" must end with "/". PlantUML matches raw prefixes, so "http://host" also allows "http://host.evil.com"`. Determine the authority from the raw string (`/^https?:\/\/[^/]+/`), not from `URL` (which adds a `/`).
   - keep the entry exactly as written (no normalization).
2. `parseAllowExternalEnv(text)`: returns `undefined` for undefined / blank (E5); `'internet'` for exactly `internet` after trim; `INTERNET`-like case variants → `use lowercase "internet"`; a text without `://` that is not `internet` → `unknown value "<v>"`; otherwise split on `;`, trim items, drop empties, empty result → `an empty allowlist is not sandbox`, validate each entry with source `environment`; return the array.
3. `validateAllowExternal(siteValue)`: `undefined` → `undefined`; `'internet'` → `'internet'`; an array → non-empty (else empty-allowlist reason) and each entry validated with source `site configuration`, return a copy; anything else → `unknown value <JSON>`.

**Edge cases**: `'Internet'` or `'INTERNET'` in the **site** value gets the same `use lowercase "internet"` hint as the env, because the literal is shared (post-plan A6). Test both sources.

### T014 – Resolution and precedence

**Steps**:
1. `resolvePlantumlAllowExternal({ env, siteValue })`: `env` is the **raw env value** (string or undefined), not `process.env` (the caller passes `process.env[PLANTUML_ALLOW_EXTERNAL_ENV]`); this keeps the module free of globals and testable.
2. Parse env; if it yields a value, `source: 'environment'` (env wins, E6) — note the site value is **still validated** so an invalid site value fails even when the env overrides it (a broken config must not hide behind an env var); decide and test this explicitly.
3. Else validate site; if defined, `source: 'site configuration'`.
4. Else `{ mode: 'sandbox', entries: [], source: 'default' }`.
5. Return fresh arrays; freeze the result object.

### T015 – `describeDeclared`

**Steps**:
1. allowlist: `allowlist (from environment DK_PLANTUML_ALLOW_EXTERNAL): <entries joined by ", ">` or `allowlist (from site configuration): …`.
2. internet: `internet (from <source label>)`.
3. sandbox: `sandbox (default)` (used only in diagnostics; unset mode prints nothing, FR-007).
4. This exact text is reused by the build notice (WP04) and the check's `declared:` line (WP11); keep it free of trailing punctuation.

## Test Strategy

Unit tests at the module boundary only; the module is pure, so no mocks. Table-driven, one row per edge-case shape, each asserting the error class plus source label plus reason substring (DIRECTIVE_041: fails exactly when the contract is violated). The no-imports test is the C-006 guard.

Run: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-external-setting.test.ts`.

## Definition of Done

- [ ] Module exports exactly the six names; no `import`, `require` or dynamic `import()`.
- [ ] Every row of data-model.md E1–E7 has a test row, and each rejecting row asserts the **expected message** (the source label `invalid … (environment|site configuration)`, the stable reason substring from contracts/opt-in-setting.md, and `accepted:`), not merely that something throws; E5 / E6 rows assert the exact resolved `{ mode, entries, source }`.
- [ ] `pnpm test`, `pnpm lint` and the toolkit typecheck pass.
- [ ] `node -e "import('./src/lib/plantuml-external.mjs').then(m=>console.log(Object.keys(m)))"` runs from a directory without `node_modules` (copy the file to `/tmp` and import it there).

## Risks

- Normalizing entries (adding `/`, lowercasing) would hide PlantUML's raw-prefix behaviour; keep raw.
- Accepting `sandbox` as a word would create an env "off-switch" the spec rejects (R1).
- `URL` parsing quirks (it accepts `http:host`); the raw-prefix regex check catches them.

## Reviewer Guidance

- Compare the rejection table to data-model.md E1–E7 line by line.
- Check the module has no knowledge of canaries, docker or Astro.
- Check the site value is validated even when the env wins.

## Requirement trace

| Requirement | Where in this WP | Proven by |
|---|---|---|
| FR-001 one setting, env override | T014 precedence | `resolves env, site, default` table |
| FR-002 three values, edge cases 1–4 and 9 | T013 | `rejects each shape` table |
| FR-013 one resolver for build and check | the module itself; WP04 and WP11 import it | WP09 parity (later) |
| C-003 declare and verify only | the module never touches the service | review |
| C-006 runs before install | no imports | `has no imports (C-006)` |

## Files at a glance

| File | Action |
|---|---|
| `src/lib/plantuml-external.mjs` | create |
| `src/tests/plantuml-external-setting.test.ts` | create |

Consumers that will import it later (do not edit here): `src/lib/config.ts` (WP04), `src/scripts/assert-plantuml-no-remote-include.mjs` (WP11).

## Implement command

```bash
spec-kitty agent action implement WP03 --agent claude --mission plantuml-external-opt-in-01M6F052
```
