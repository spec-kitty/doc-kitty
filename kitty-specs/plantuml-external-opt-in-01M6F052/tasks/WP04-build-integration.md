---
work_package_id: WP04
title: 'Build integration: option, handoff, notice, config evaluation'
dependencies:
- WP03
requirement_refs:
- FR-001
- FR-003
- FR-013
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: 24fca0114fe289fea6fb8c0b96b9b5a8e3126a5e
created_at: '2026-11-02T22:29:07.071905+00:00'
subtasks:
- T017
- T018
- T019
- T020
- T021
history:
- timestamp: '2026-11-02T22:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/config.ts
create_intent:
- src/tests/plantuml-allow-external-config.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/config.ts
- src/lib/internal-env.mjs
- src/scripts/site-config-eval.mjs
- src/tests/plantuml-allow-external-config.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP04 – Build integration: option, handoff, notice, config evaluation

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Wire the opt-in setting into the build:

1. `DocKittyOptions.plantumlAllowExternal?: readonly string[] | 'internet'` (a top-level sibling of `diagrams`; `diagrams` stays a boolean, R1).
2. `defineDocKittyIntegrations` resolves it **eagerly** through WP03's `resolvePlantumlAllowExternal`, so an invalid value throws at config time (edge case 1).
3. It **always** publishes the resolution as JSON in the new internal handoff `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` (sandbox included), so a config evaluation can tell "resolved to sandbox" from "never called `defineDocKittyIntegrations`" (post-plan A2a).
4. It prints the FR-003 notice to stderr only when the mode is not sandbox; nothing when unset (FR-007, US4 AS3).
5. `src/scripts/site-config-eval.mjs` deletes any inherited handoff before evaluating and returns the handoff as `plantumlAllowExternal` (a resolution object, or `null`).

## Context

- `src/lib/config.ts`: `DocKittyOptions` (`:145-210`), eager validation and `setInternalEnv` handoffs (`:507-583`, e.g. `indexBasename` at `:542`, `gherkin` near `:528`), `[dk-config]` warning precedent (`:392`), `diagrams === true` reads (`:771`, `:776`).
- `src/lib/internal-env.mjs`: every handoff name (`DK_*_ENV` constants), `INTERNAL_ENV_NAMES` (`:52`), `setInternalEnv` (refuses unknown names, `:68`), `clearInternalEnv`; there may be a documentation table in the header comment — add the new name there too.
- `src/scripts/site-config-eval.mjs`: child evaluation (`:184-200`) prints `{ ok, names, envDir, exclude, docsRoot }`; the parent caches per config path; inherited `DK_INDEX_BASENAME` is deleted before evaluation (`:84-87`) — copy that pattern.
- contracts/opt-in-setting.md "Build notice (FR-003)" (exact text), research.md R2, R10; data-model.md §1 child-answer table.
- `src/tests/helpers/restore-internal-env.ts`: use `restoreInternalEnv()` in the new test file.

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.

## Subtasks

### T021 – Tests first

**Purpose**: pin the build-side behaviour before changing `config.ts`.

**Steps**: create `src/tests/plantuml-allow-external-config.test.ts` (call `restoreInternalEnv()` at the top; save and restore `process.env.DK_PLANTUML_ALLOW_EXTERNAL` yourself, since it is not an internal name; spy on `console.warn`):
1. Invalid site value (`plantumlAllowExternal: []`, `['http://host']`) → `defineDocKittyIntegrations(...)` throws `PlantumlAllowExternalError` with `invalid plantumlAllowExternal (site configuration)`.
2. Invalid env (`DK_PLANTUML_ALLOW_EXTERNAL=INTERNET`) → throws with `use lowercase "internet"`.
3. Unset → `process.env.DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` parses to `{ mode: 'sandbox', entries: [], source: 'default' }`, and `console.warn` was **not** called with anything starting `[dk-plantuml]`.
4. Allowlist from site → handoff JSON matches; exactly one `[dk-plantuml] declared PlantUML allowlist mode (from site configuration): …` warn call per `defineDocKittyIntegrations` call, containing the literal `--astro-config <path>` and `--service-container`.
5. Internet from env → `[dk-plantuml] WARNING: declared PlantUML internet mode (from environment DK_PLANTUML_ALLOW_EXTERNAL): the service may fetch any URL, including internal networks and cloud metadata endpoints.` plus the verify command, which **includes** `--service-container <container>` (internet mode needs the container, decision `01M6F4BRKQ4E9H9Z41BYZH37MC`; analyze A1) — assert its presence.
6. `diagrams: false` with allowlist → notice ends with ` (diagrams are off, so nothing is rendered)`.
7. `clearInternalEnv()` removes `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED`; `INTERNAL_ENV_NAMES` contains it.
8. Existing behaviour untouched: `diagrams: true` still adds the diagram integrations (use whatever existing assertion style `config-invariants.test.ts` uses).

Use the minimal option set other config tests use to call `defineDocKittyIntegrations` (look at `src/tests/config-invariants.test.ts` or `gherkin-options.test.ts`).

### T017 – The option

**Steps**:
1. Add to `DocKittyOptions` in `src/lib/config.ts`:
   ```ts
   /**
    * Declares whether the PlantUML service may make external connections for
    * URL includes (#268, ADR-0074). Unset: sandbox (the default). A non-empty
    * list of http(s) URL prefixes ending in "/": allowlist mode. 'internet':
    * internet mode. DK_PLANTUML_ALLOW_EXTERNAL overrides it. The toolkit never
    * configures the service; it declares and the include check verifies.
    */
   plantumlAllowExternal?: readonly string[] | 'internet';
   ```
2. Import from `./plantuml-external.mjs` (same import style as other `.mjs` imports in `config.ts`, e.g. `./internal-env.mjs`). If TypeScript needs types for the `.mjs`, follow how `draft-publication.mjs` is typed (JSDoc + `allowJs`/`checkJs` or an adjacent declaration); do not add a dependency.
3. If present: a list of known top-level option keys (a guard that rejects unknown keys) — add the new key there. If no such guard exists, add nothing.

### T018 – Eager resolution and the handoff

**Steps**:
1. In `src/lib/internal-env.mjs`: `export const DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED_ENV = 'DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED';`, add it to `INTERNAL_ENV_NAMES` and to any documentation table in the file.
2. In `defineDocKittyIntegrations`, next to the other eager validations (before anything that could print), call:
   ```ts
   const plantumlExternal = resolvePlantumlAllowExternal({
     env: process.env[PLANTUML_ALLOW_EXTERNAL_ENV],
     siteValue: options.plantumlAllowExternal,
   });
   setInternalEnv(DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED_ENV, JSON.stringify(plantumlExternal));
   ```
   Always, including sandbox. Publishing prints nothing.
3. Do not read `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` anywhere in the build; it is only an outbound handoff to `site-config-eval`.

### T019 – The build notice (FR-003)

**Steps**:
1. When `mode !== 'sandbox'`, `console.warn` exactly one line built from `describeDeclared`:
   - allowlist: `[dk-plantuml] declared PlantUML allowlist mode (from <source>): <entries joined ", ">. The build cannot see the service; verify it with: dockitty-assert-plantuml-no-remote-include --astro-config <path> --server <url> --canary-host <host> --canary-port 18091 --service-container <container>`
   - internet: `[dk-plantuml] WARNING: declared PlantUML internet mode (from <source>): the service may fetch any URL, including internal networks and cloud metadata endpoints. Verify it with: dockitty-assert-plantuml-no-remote-include --astro-config <path> --server <url> --canary-host <host> --canary-port 18091 --service-container <container>`
   - `<source>` is `environment DK_PLANTUML_ALLOW_EXTERNAL` or `site configuration` (reuse the label from `describeDeclared`; do not re-derive).
   - `<path>`: `config.ts` does not know the config file's path at definition time, so print the **literal placeholder `<path>`** (decision `01M6F21BY4VJVWE4VY889F80CP`). Do not guess a path. T021 asserts the literal `--astro-config <path>` in the notice.
   - **Accepted behaviour, stated in a code comment**: the notice prints once per `defineDocKittyIntegrations` call, so it can appear more than once per session (dev-server config reloads, and the `site-config-eval` child used by gates and the include check). This is intended: every evaluation that declares an opening says so.
   - If `options.diagrams !== true`, append ` (diagrams are off, so nothing is rendered)`.
2. Print once per `defineDocKittyIntegrations` call, at definition time (R10), not inside an integration hook.
3. Keep the exact text in one helper function so WP09 and WP10 can reference it.

### T020 – `site-config-eval.mjs`

**Steps**:
1. In the child, before evaluating, `delete process.env.DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` (same place and style as `DK_INDEX_BASENAME`, `:84-87`).
2. After evaluating, read the handoff: parse the JSON if present, else `null`. Add `plantumlAllowExternal` to the printed answer and to the parent's returned result object (`:105`) and its JSDoc typedef (`:34`).
3. Do not import `plantuml-external.mjs` here; the child only forwards what `defineDocKittyIntegrations` published. The child inherits `DK_PLANTUML_ALLOW_EXTERNAL`, so "environment wins" is applied by the same resolver inside the config evaluation.
4. A config that throws (including an invalid setting) keeps today's `ok: false` path.
5. Existing callers (`check-links`, gates) ignore the new field; verify they still pass.

**Validation**:
- [ ] Existing tests using `evaluateSiteConfig` / `evaluateGateConfig` pass unchanged.

## Test Strategy

Unit tests through the public entry point `defineDocKittyIntegrations` (black-box at module level). The real child-process evaluation and full parity grid are WP09's job (NFR-003); here only the build half and the handoff are pinned. Unset silence is asserted (US4 AS3, FR-007).

Run: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-allow-external-config.test.ts`, then `pnpm test`, `pnpm typecheck`, `pnpm lint`.

## Definition of Done

- [ ] Option typed and documented; `diagrams` untouched.
- [ ] Invalid values fail at definition time with the WP03 messages.
- [ ] Handoff always published; name registered in `internal-env.mjs`; cleared by `clearInternalEnv`.
- [ ] Notice printed only for allowlist / internet, with the full verify command including `--astro-config`.
- [ ] `site-config-eval.mjs` returns `plantumlAllowExternal` (object or `null`) and drops an inherited value.
- [ ] Notice contains the literal `--astro-config <path>` placeholder (T021 case 4).
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` pass.
- [ ] No new output on the unset path: `pnpm build 2>&1 | grep dk-plantuml` (example site, no opt-in) prints nothing (exit 1 from grep).

## Risks

- Any output on the unset path breaks FR-007; the example site build must print nothing new (compare `pnpm build 2>&1 | grep dk-plantuml` → empty).
- Forgetting `INTERNAL_ENV_NAMES` makes `setInternalEnv` throw.
- Widening `diagrams` to an object (rejected in R1) would change every `diagrams === true` read.

## Reviewer Guidance

- Check the notice text against contracts/opt-in-setting.md character by character.
- Check the handoff is published even for sandbox, and never read by the build.
- Check the child deletes the inherited handoff before evaluation.

## Requirement trace

| Requirement | Where in this WP | Proven by |
|---|---|---|
| FR-001 site setting + env override | T017, T018 | T021 cases 1–5 |
| FR-003 loud build notice | T019 | T021 cases 4–6; WP09 per-source notice |
| FR-013 build half of the shared resolution | T018, T020 | WP09 parity grid |
| FR-007 / US4 AS3 unset prints nothing | T019 guard on `mode !== 'sandbox'` | T021 case 3; WP09 unset cells |

## Files at a glance

| File | Action |
|---|---|
| `src/lib/config.ts` | modify: option, eager resolve, handoff, notice |
| `src/lib/internal-env.mjs` | modify: new handoff name |
| `src/scripts/site-config-eval.mjs` | modify: delete inherited, return `plantumlAllowExternal` |
| `src/tests/plantuml-allow-external-config.test.ts` | create |

## Implement command

```bash
spec-kitty agent action implement WP04 --agent claude --mission plantuml-external-opt-in-01M6F052
```
