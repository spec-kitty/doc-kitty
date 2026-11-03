---
work_package_id: WP05
title: 'Canary redesign: fixed port, allowed and denied paths, request log'
dependencies:
- WP02
requirement_refs:
- FR-007
- NFR-001
- SC-003
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: 261a2ec21f5fcebc90b7057b7f81cf51a1ad1d1b
created_at: '2026-11-02T22:27:36.748789+00:00'
subtasks:
- T022
- T023
- T024
- T025
history:
- timestamp: '2026-11-02T22:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/scripts/plantuml-include-guard.mjs
create_intent:
- src/tests/plantuml-canary.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/scripts/plantuml-include-guard.mjs
- src/tests/plantuml-canary.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP05 – Canary redesign: fixed port, allowed and denied paths, request log

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Redesign the canary in `src/scripts/plantuml-include-guard.mjs` so the declared-mode check (WP06, WP11) can use it, while the unset path stays byte-identical (FR-007):

- An **exported** `startCanary({ port })` serving two path prefixes on one host and port: allowed `/dk-canary/allowed/` (marker `DK-CANARY-FETCHED`) and denied `/dk-canary/denied/` (marker `DK-CANARY-DENIED-FETCHED`), plus `/dk-canary/allowed/redirect/<fixture>` → `302` to `/dk-canary/denied/redirected/<fixture>`, and a **request log** of every path in order.
- The unset path (`checkRemoteIncludesRefused`) moves its fixture includes to `<base>/dk-canary/allowed/include/<fixture>`, **keeps** its reachability probe at `<base>/reachability`, keeps its signature, result shape and messages, and gains only an optional `canaryPort` (default `0`, random).

## Context

- `src/scripts/plantuml-include-guard.mjs`: private `startCanary()` (`:86-100`, port 0, one body for every path), `checkRemoteIncludesRefused` (`:113-184`), reachability probe (`:149-164`), fixture renders (`:166-181`).
- research.md R3 (canary design, paths, port rules, why `/reachability` stays: the probe-failure message embeds the probe URL, post-plan A4); data-model.md §2.
- `src/tests/plantuml-include-guard.test.ts` pins the fixture directory (`:77`) and message texts (`:97-99`) — it must pass **unmodified**.
- WP02's goldens (`src/tests/plantuml-include-check-golden.test.ts`) must pass **unmodified**.

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.
- This WP depends on WP02: the goldens are already committed on the base when you start. Run them before your first edit to confirm they are green.

## Subtasks

### T024 – Canary tests first

**Purpose**: specify the canary's HTTP contract before changing it.

**Steps**: create `src/tests/plantuml-canary.test.ts`, importing `startCanary`, `CANARY_MARKER` and a new `CANARY_DENIED_MARKER` from `../scripts/plantuml-include-guard.mjs`; use `freePort()` from `src/tests/helpers/plantuml-check-harness.ts` (WP02):
1. `startCanary({ port })` listens on exactly that port; `canary.port === port`.
2. `GET /dk-canary/allowed/include/x.puml` → 200, body contains `DK-CANARY-FETCHED` and is valid PlantUML (`@startuml … @enduml`).
3. `GET /dk-canary/denied/include/x.puml` → 200, body contains `DK-CANARY-DENIED-FETCHED` (the name from data-model.md). `DK-CANARY-FETCHED` is not a substring of `DK-CANARY-DENIED-FETCHED`, so the two markers are distinguishable by `includes`; assert that explicitly (denied body does not include `DK-CANARY-FETCHED`; allowed body does not include `DENIED`).
4. `GET /dk-canary/allowed/probe` and `/dk-canary/denied/probe` → 200.
5. `GET /dk-canary/allowed/redirect/x.puml` with `redirect: 'manual'` → 302, `location` ends with `/dk-canary/denied/redirected/x.puml` and is absolute on the canary's own base (`http://<host>:<port>`; accept a `baseUrl` option for the host the service sees).
6. `GET /reachability` → 200 (unset-path probe).
7. `GET /somewhere/else` → logged; respond 404.
8. `canary.log` is the ordered list of all request paths, including the 404 and the redirect; repeated requests are each logged (the real image requests every include twice, spike F4 — the log must keep both, and no consumer may assume one entry per fetch).
9. Busy port: start a server on a port, then `startCanary({ port })` rejects with an error whose message contains `cannot listen on canary port <n>` (WP06 / WP11 map this to exit 2).
10. `startCanary()` with no port still works (random), for the unset path.
11. `close()` resolves and frees the port.

### T022 – Exported `startCanary({ port, baseUrl? })`

**Steps**:
1. Replace the private function with:
   ```js
   export const CANARY_ALLOWED_PREFIX = '/dk-canary/allowed/';
   export const CANARY_DENIED_PREFIX = '/dk-canary/denied/';
   export const CANARY_DENIED_MARKER = 'DK-CANARY-DENIED-FETCHED';
   /** @returns {Promise<{ port: number, log: string[], hits: string[], close: () => Promise<void> }>} */
   export function startCanary({ port = 0, redirectBase } = {}) { … }
   ```
   Keep `hits` as an alias of `log` if the unset path uses it, so the unset code changes minimally.
2. Routing: allowed prefix → allowed body; denied prefix → denied body; `<allowed>redirect/<rest>` → 302 to `${redirectBase ?? 'http://127.0.0.1:' + port}/dk-canary/denied/redirected/<rest>`; `/reachability` → allowed body (as today); anything else → 404 (logged). The redirect target must use the host the **service** uses (`canaryHost`), so the caller passes `redirectBase`.
3. Listen on `0.0.0.0` as today. On `EADDRINUSE`, reject with `new Error(\`cannot listen on canary port ${port}: in use\`)`.
4. Bodies: `@startuml\nAlice -> Bob : ${marker}\n@enduml\n`.
5. Update the module's header comment (steps 1–4) to describe the two prefixes and the log, without changing anything it says about the unset check's guarantees.

### T023 – Retarget the unset path

**Steps**:
1. `checkRemoteIncludesRefused({ …, canaryPort = 0 })`: `startCanary({ port: canaryPort, redirectBase: base })` (compute `base` from `canaryHost` and the bound port; since the port is known only after listen when `0`, build the redirect base lazily or pass the host and let the canary append its own port).
2. `includePath` becomes `` `${CANARY_ALLOWED_PREFIX}include/${encodeURIComponent(fixture.name)}` ``; `fetched` counts log entries starting with that path (unchanged logic).
3. The reachability probe stays `` `${base}/reachability` `` and its check stays `hits.some(h => h.startsWith('/reachability'))`.
4. Printed text: fixture **names** only, as today; no path appears in any message. Verify by reading every `messages.push` in the function.
5. Do not add any new message, field or line on this path.

**Why**: moving the fixtures onto the allowed path makes the "unset declared × allowlist observed" cell detectable when the operator runs with `--canary-host dk-canary --canary-port 18091` (research R3, post-plan N6), without changing output.

### T025 – Prove nothing visible changed

**Steps**:
1. Run `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-include-guard.test.ts src/tests/plantuml-include-check-golden.test.ts src/tests/plantuml-canary.test.ts`.
2. `git diff --stat` must show no change to either existing test file or to any golden file.
3. Run the CLI by hand against a refusing fake once with `--service-container` and the fake docker, and diff against the golden.

**Validation**:
- [ ] `plantuml-include-guard.test.ts` unmodified and green.
- [ ] All five goldens green.
- [ ] `src/scripts/fixtures/plantuml-remote-include/` unchanged (still exactly two files).

## Test Strategy

Test-first for the new canary contract (T024); ratchet for the unset path (WP02's goldens and the existing guard test, both untouched). A failing golden here is a real FR-007 regression, never a reason to regenerate the golden.

## Definition of Done

- [ ] `startCanary` exported with the documented routes, markers, log and busy-port error.
- [ ] Unset path retargeted with byte-identical output.
- [ ] New canary test green; existing guard test and goldens unmodified and green.
- [ ] `git diff --stat <base>..HEAD` shows **no** change to `src/tests/fixtures/plantuml-include-check*` or `src/tests/plantuml-include-guard.test.ts`.
- [ ] Marker-overlap case green (T024 case 3: denied body lacks `DK-CANARY-FETCHED`, allowed body lacks `DENIED`).
- [ ] Redirect case green (T024 case 5: 302 with `location` on the caller's `redirectBase`, ending `/dk-canary/denied/redirected/<fixture>`).
- [ ] `pnpm test` and `pnpm lint` pass.

## Risks

- Moving `/reachability` would change the probe-failure message (embeds the URL) → golden `canary-unreachable` fails. Keep it.
- Spike F3: the pinned image does not follow the 302 and renders HTTP 200 with an empty diagram; the canary's job is only to log `/dk-canary/denied/redirected/…` if it is ever requested. Do not add status-based logic here.
- A redirect target built from `127.0.0.1` when the service reaches the canary as `dk-canary` would make the redirect test meaningless on the real lane; take the base from the caller.
- Marker substring overlap would make "denied fetched" look like "allowed fetched"; test it.

## Reviewer Guidance

- Confirm no golden or existing test changed in this WP's diff.
- Confirm the unset path has no new output, by reading every `console.*` / `messages.push` on it.
- Confirm the busy-port message text matches contracts/include-check-cli.md (`cannot listen on canary port <n>`).

## Requirement trace

| Requirement | Where in this WP | Proven by |
|---|---|---|
| FR-007 unset output unchanged | T023 | WP02 goldens, `plantuml-include-guard.test.ts` (both unmodified) |
| NFR-001 request log | T022 | T024 case 8; WP12 NFR-001 stray row |
| Edge case 8 infrastructure (redirect path) | T022 | T024 case 5; WP12 edge case 8 |
| Unset × allowlist cell detectable | T023 (fixtures on the allowed path) | WP07 matrix row M2 |
| SC-003 existing tests unmodified | T025 | `git diff` of test files empty |

## Files at a glance

| File | Action |
|---|---|
| `src/scripts/plantuml-include-guard.mjs` | modify: exported `startCanary`, retargeted unset path |
| `src/tests/plantuml-canary.test.ts` | create |
| `src/tests/plantuml-include-guard.test.ts` | **do not edit** |
| `src/tests/plantuml-include-check-golden.test.ts` and goldens | **do not edit** (WP02) |
| `src/scripts/fixtures/plantuml-remote-include/` | **do not edit** |

## Implement command

```bash
spec-kitty agent action implement WP05 --agent claude --mission plantuml-external-opt-in-01M6F052
```
