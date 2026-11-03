---
work_package_id: WP08
title: Real allowlist CI lane and workflow services inventory test
dependencies:
- WP11
requirement_refs:
- FR-012
- FR-014
- NFR-001
- NFR-002
- C-001
- C-004
- C-005
- SC-001
- SC-004
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-plantuml-external-opt-in-01M6F052
base_commit: 649dfbd6fef5f90753cacbf97dbfba3b5e46a8a8
created_at: '2026-11-02T23:12:05.735957+00:00'
subtasks:
- T038
- T039
- T040
- T041
- T042
- T043
history:
- timestamp: '2026-11-02T22:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: .github/workflows/ci.yml
create_intent:
- src/tests/plantuml-workflow-services.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- .github/workflows/ci.yml
- .github/scripts/ci-ok-decision.mjs
- .github/scripts/ci-ok-decision.test.mjs
- src/tests/plantuml-workflow-services.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP08 – Real allowlist CI lane and workflow services inventory test

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `implementer-ivan`, or run
  `spec-kitty agent profile show implementer-ivan`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

1. Add an unconditional CI job `plantuml-allowlist` to `.github/workflows/ci.yml` that runs the digest-pinned PlantUML image in ALLOWLIST mode (configured with exactly the guide's allowlist block, canary-host entries only) and runs the include check in declared allowlist mode against it, grepping the stable verdict line (FR-012, SC-001, SC-004, NFR-001, NFR-002, C-005).
2. Wire it into `ci-ok` (`needs`, `PLANTUML_ALLOWLIST_RESULT`, `REQUIRED_LANES`, the `node:test` suite).
3. Add `src/tests/plantuml-workflow-services.test.ts`: every PlantUML service in every workflow, found by image, must be SANDBOX except this lane's (ALLOWLIST, pinned, canary-host entries only, never INTERNET); lane vacuity checks; no `plantuml.com` (FR-014, C-001, C-004, NFR-001 static half).

The existing build-example job, its SANDBOX service and its include-check step stay **byte-identical** (C-001). `src/tests/plantuml-service-hardening.test.ts` stays **unmodified** (SC-003).

## Context

- WP01 spike addendum in research.md: decision **GO** (the `services:` block with `options: --add-host dk-canary:host-gateway`; fallback (a) not taken), the exact service block that worked (identical to the one in T038), wall time **38 s** for the whole job. **Use the block from the addendum.** The canary must listen on `0.0.0.0:18091` (the include check's canary does).
- research.md R5 (job, service block, guard, step, verdict grep, `ci-ok`), R6 (inventory test design, lane vacuity list).
- `.github/workflows/ci.yml`: build-example (`:185-264`; readiness loop; include-check step at `:254-264`), `ci-ok` (`:405-429`), header comment listing lanes; `detect-changes` job outputs (`paused`).
- `.github/scripts/ci-ok-decision.mjs` (`REQUIRED_LANES` at `:25`, env mapping) and `.github/scripts/ci-ok-decision.test.mjs` (`node --test`).
- `src/tests/plantuml-service-hardening.test.ts` — copy its pinned-image regex and block parser; do not import from or edit it.
- Pinned image: `plantuml/plantuml-server:jetty-v1.2026.9@sha256:065c66adc6728ba6dd353a29d4ada73f8358b68549a0f710c4bf46b43c103618`.

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; work in the worktree `spec-kitty agent action implement` gives you.
- The lane only proves itself on GitHub; T043 is satisfied by the mission PR's CI run (the orchestrator pushes; do not push yourself unless the runtime instructs it).

## Subtasks

### T041 – Inventory test first

**Purpose**: the test is the lane's structural guard; write it red first.

**Steps**: create `src/tests/plantuml-workflow-services.test.ts`:
1. Glob every `*.yml` / `*.yaml` in `.github/workflows/` (use `node:fs` `readdirSync`; no YAML dependency).
2. Find every service block whose `image:` starts with `plantuml/plantuml-server` — by image, not by key name, and **all** of them, not the first (FR-014; DIRECTIVE_043). Record `{ file, job, envLines }` per block. A text parser is acceptable: locate `services:` under a job, then each service's indented block; copy the approach from `plantuml-service-hardening.test.ts`.
3. Fail on any `docker run … plantuml-server` outside a service block (spike GO: fallback (a) not taken, so no exception).
4. Per service:
   - in `ci.yml` job `plantuml-allowlist`: `PLANTUML_SECURITY_PROFILE: ALLOWLIST`; image equals the shared pin; `PLANTUML_ALLOWLIST_URL` present and every `;`-split entry starts with `http://dk-canary:` (NFR-001 static);
   - everywhere else: `PLANTUML_SECURITY_PROFILE: SANDBOX` (C-001; build-example, deploy, update-a11y-baselines, consumption-test if it has one) and the shared pin (C-005).
5. No workflow file contains `INTERNET` as a profile value, and none contains `plantuml.com` (C-004).
6. Sanity: the test finds at least as many services as there are workflow files with `plantuml-server` in them (so a parser bug that finds zero cannot pass), and at least one ALLOWLIST service.

### T042 – Lane vacuity assertions

**Steps** (same test file, `describe('plantuml-allowlist lane is not vacuous')`, post-plan N1):
1. Job `plantuml-allowlist` exists with `if: needs.detect-changes.outputs.paused != 'true'` exactly, `needs: detect-changes` (only), `timeout-minutes: 5`.
2. Its check step contains: `DK_PLANTUML_ALLOW_EXTERNAL=`, `--canary-host dk-canary`, `--canary-port 18091`, `--service-container "${{ job.services.plantuml.id }}"`, `set -o pipefail` (or `shell: bash` with pipefail), and `grep -F 'verdict: declared allowlist, observed allowlist'`.
3. The step runs `node src/scripts/assert-plantuml-no-remote-include.mjs` (not `pnpm exec`), and the job has no `pnpm install` step (C-006: proves the check runs pre-install).
4. `ci-ok`'s `needs` lists `plantuml-allowlist`; its env threads `PLANTUML_ALLOWLIST_RESULT: ${{ needs.plantuml-allowlist.result }}`.
5. `REQUIRED_LANES` in `.github/scripts/ci-ok-decision.mjs` contains the lane (import the module and read the export, or parse the text).
6. The build-example job's service still has `SANDBOX` and its include-check step text is unchanged (compare to a substring copied from today's `ci.yml:254-264`).

### T038 – The job

**Steps**:
1. Add to `ci.yml`, after build-example:
   ```yaml
   plantuml-allowlist:
     name: PlantUML allowlist opt-in (real service)
     needs: detect-changes
     if: needs.detect-changes.outputs.paused != 'true'
     runs-on: ubuntu-latest
     timeout-minutes: 5
     services:
       plantuml:
         image: plantuml/plantuml-server:jetty-v1.2026.9@sha256:065c66adc6728ba6dd353a29d4ada73f8358b68549a0f710c4bf46b43c103618
         ports:
           - 8091:8080
         options: --add-host dk-canary:host-gateway
         env:
           PLANTUML_SECURITY_PROFILE: ALLOWLIST
           PLANTUML_ALLOWLIST_URL: "http://dk-canary:18091/dk-declared/;http://dk-canary:18091/dk-canary/allowed/"
     steps:
       - uses: actions/checkout@<same pinned SHA as other jobs>
       - uses: actions/setup-node@<same pinned SHA> with the repo's Node version (no pnpm install)
       - name: Wait for PlantUML
         run: <same readiness loop as build-example>
       - name: Include check in declared allowlist mode
         shell: bash
         run: |
           set -o pipefail
           DK_PLANTUML_ALLOW_EXTERNAL=http://dk-canary:18091/dk-declared/ \
             node src/scripts/assert-plantuml-no-remote-include.mjs \
               --server http://localhost:8091/svg/ \
               --canary-host dk-canary --canary-port 18091 \
               --service-container "${{ job.services.plantuml.id }}" | tee check.log
           grep -F 'verdict: declared allowlist, observed allowlist' check.log
   ```
   Copy action pins and Node setup from existing jobs exactly; do not introduce a new action (DIRECTIVE_051).
2. Add a comment above the job naming #268, ADR-0074, FR-012, and that the guide's allowlist block must equal this service block (WP10's test asserts it).
3. Spike decision GO: keep the `services:` form; do not add a `docker run` variant.

### T039 – `ci-ok` wiring

**Steps**:
1. `ci.yml` `ci-ok` job: add `plantuml-allowlist` to `needs`; add `PLANTUML_ALLOWLIST_RESULT: ${{ needs.plantuml-allowlist.result }}` to the decision step's env.
2. `.github/scripts/ci-ok-decision.mjs`: add the lane to `REQUIRED_LANES` with its env name, following the existing entries' shape.
3. `.github/scripts/ci-ok-decision.test.mjs`: cases — lane `success` → ok; lane `failure` → not ok naming the lane; lane `skipped` when paused → follow the existing paused semantics; env missing → fails closed (existing behaviour, assert it covers the new lane).
4. Run `node --test .github/scripts/ci-ok-decision.test.mjs`.

### T040 – Header comment and lane count

**Steps**: update the `ci.yml` header comment that lists lanes / counts lanes to include `plantuml-allowlist`. Docs pages that list lanes (`docs/architecture/ci-cd-pipeline.md`, `docs/ops/ci-cd.md`) are WP10's; leave them.

### T043 – Prove it on CI

**Ownership**: the lane-green-on-CI proof (SC-001, SC-004, NFR-002 wall time) is a **mission-review / PR-check item owned by the orchestrator**: lane agents cannot push or read PR checks. This WP is done when everything verifiable locally is green; the orchestrator confirms the CI run at mission review and records the run URL.

**Steps** (for the orchestrator, or the implementer if given push access):
1. After local tests pass, the lane runs on the mission PR's CI (or the orchestrator's push). Confirm in the run log: the verdict line, `OK — declared allowlist matches the service`, and wall time under 5 minutes (NFR-002).
2. Record the run URL and wall time in the WP's completion notes.
3. If the lane fails on CI for an environmental reason the spike did not see, do not loosen any assertion; hand back with the log.

## Test Strategy

The inventory test is written first and fails until the job exists (build label). `ci-ok-decision.test.mjs` cases cover the new lane. The lane itself is the integration test (SC-004); its verdict grep makes a silent unset-path run fail. The existing hardening test must pass unmodified.

Run: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/plantuml-workflow-services.test.ts src/tests/plantuml-service-hardening.test.ts`, `node --test .github/scripts/ci-ok-decision.test.mjs`, then `pnpm test`, `pnpm lint`. If `actionlint` is available locally, run it on `ci.yml`.

## Definition of Done

- [ ] Job `plantuml-allowlist` has exactly `if: needs.detect-changes.outputs.paused != 'true'`, `needs: detect-changes` (only), `timeout-minutes: 5`, the shared pinned image, `options: --add-host dk-canary:host-gateway`, `PLANTUML_SECURITY_PROFILE: ALLOWLIST`, and `PLANTUML_ALLOWLIST_URL` entries all starting `http://dk-canary:`.
- [ ] Its check step has `set -o pipefail`, `DK_PLANTUML_ALLOW_EXTERNAL=`, `--canary-host dk-canary`, `--canary-port 18091`, `--service-container "${{ job.services.plantuml.id }}"`, runs `node src/scripts/assert-plantuml-no-remote-include.mjs`, and ends with `grep -F 'verdict: declared allowlist, observed allowlist' check.log`.
- [ ] The job has **no** `pnpm install` step.
- [ ] `ci-ok` `needs` lists `plantuml-allowlist`; its decision step env has `PLANTUML_ALLOWLIST_RESULT: ${{ needs.plantuml-allowlist.result }}`; `REQUIRED_LANES` and `ci-ok-decision.test.mjs` updated together; `node --test` green.
- [ ] Inventory test (`plantuml-workflow-services.test.ts`) asserts every item above and is green; existing hardening test unmodified.
- [ ] **Neutered-lane mutation check, recorded** in the completion notes: locally remove (one at a time) the `grep -F` line, the `--service-container` flag, the `--canary-port` flag, `plantuml-allowlist` from `ci-ok` `needs`, and `PLANTUML_ALLOWLIST_RESULT`; each removal turns the inventory test (or `ci-ok-decision.test.mjs`) red; revert.
- [ ] Build-example job unchanged (`git diff` shows additions only outside it, plus `ci-ok` and the header comment).
- [ ] CI run proof (SC-001, SC-004, NFR-002): **orchestrator-owned**, confirmed at mission review / PR checks, not a blocker for this WP's local DoD.

**Mission-level PR-check gate (orchestrator-owned; analyze A9)**: before accept / mission review passes, the orchestrator records in the mission-review notes the `plantuml-allowlist` run URL on the mission PR, the presence of `verdict: declared allowlist, observed allowlist` in its log, and its wall time (≤ 5 min). Without that record SC-001, SC-004 and NFR-002 are not met and the mission is not accepted.

## Risks

- A `REQUIRED_LANES` entry without its `*_RESULT` env fails `ci-ok` closed on every PR; change both together.
- Path filtering: do not gate the job on `run_build_example` or any filter output (FR-012, SC-004).
- `host-gateway` behaving differently from the spike: hand back with logs; the fallback decision belongs to the operator.

## Reviewer Guidance

- Diff the service block against the WP01 addendum and against the quickstart's block (only the declared entry differs).
- Delete the `grep -F` line locally and confirm the inventory test goes red.
- Confirm `plantuml-service-hardening.test.ts` is untouched.

## Requirement trace

| Requirement | Subtask |
|---|---|
| FR-012 real allowlist lane, not path-filtered, feeds `ci-ok` | T038, T039, T042 |
| FR-014 every service inspected | T041 |
| NFR-001 canary-host entries only | T041.4 |
| NFR-002 5-minute bound | T038 (`timeout-minutes: 5`), T043 |
| C-001 existing lane unchanged | T042.6 |
| C-004 no plantuml.com | T041.5 |
| C-005 pinned image | T041.4 |
| SC-001, SC-004 | T043 |

## Implement command

```bash
spec-kitty agent action implement WP08 --agent claude --mission plantuml-external-opt-in-01M6F052
```
