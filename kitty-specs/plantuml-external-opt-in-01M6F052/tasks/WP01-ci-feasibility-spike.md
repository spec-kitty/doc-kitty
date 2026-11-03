---
work_package_id: WP01
title: CI feasibility spike for the real allowlist lane
dependencies: []
requirement_refs:
- FR-012
- C-005
- NFR-002
planning_base_branch: feat/268-plantuml-external-opt-in
merge_target_branch: feat/268-plantuml-external-opt-in
branch_strategy: Planning artifacts for this mission were generated on feat/268-plantuml-external-opt-in. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/268-plantuml-external-opt-in unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history:
- timestamp: '2026-11-02T22:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: researcher-robbie
authoritative_surface: kitty-specs/plantuml-external-opt-in-01M6F052/spike/
create_intent:
- kitty-specs/plantuml-external-opt-in-01M6F052/spike/inspect-capture.json
- kitty-specs/plantuml-external-opt-in-01M6F052/spike/spike-workflow.yml
execution_mode: planning_artifact
model: opus
owned_files:
- kitty-specs/plantuml-external-opt-in-01M6F052/research.md
- kitty-specs/plantuml-external-opt-in-01M6F052/spike/**
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP01 – CI feasibility spike for the real allowlist lane

> **ORCHESTRATOR-RUN.** This WP needs `git push`, `gh` and a real GitHub runner, which lane agents do not have. The orchestrator (or an agent it runs with push and `gh` rights) executes it in the planning checkout, commits the evidence to `feat/268-plantuml-external-opt-in`, and only then lets the dependent lanes (WP11, WP07, WP10 and their dependents) start, so their worktrees see the evidence.

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `researcher-robbie`, or run
  `spec-kitty agent profile show researcher-robbie`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

Prove on a real GitHub Actions runner, before any production lane is written, that the lane design in research R5 works:

1. A `services:` PlantUML container started with `options: --add-host dk-canary:host-gateway` and a static `PLANTUML_SECURITY_PROFILE: ALLOWLIST` / `PLANTUML_ALLOWLIST_URL` reaches a Node canary running on the runner on a fixed port (18091).
2. Under ALLOWLIST, the allowed prefix `/dk-canary/allowed/` is fetched and the denied prefix `/dk-canary/denied/` is refused.
3. Record what happens to a 302 from the allowed prefix to the denied prefix (edge case 8).
4. Record whether `!import <url>` and `!includesub <url>!X` fetch under ALLOWLIST and INTERNET (R8, squad finding 22).
5. Record whether PlantUML trims allowlist entries and whether it accepts a trailing `;`.
6. Capture the real shape of `docker inspect -f '{{json .Config.Env}}' <service-id>` as a fixture.
7. Record the job's wall time (NFR-002: at most 5 minutes).

This WP produces **evidence and a decision**, not production code. Its outputs are an addendum in `research.md` and files under `kitty-specs/plantuml-external-opt-in-01M6F052/spike/`.

## Context

- Spec: Assumption 3 ("the plan confirms this works on a GitHub runner, starting with a spike; if it cannot, the plan returns to the operator rather than dropping the real-service lane").
- research.md R5 (lane design, spike list, fallbacks a/b/c), R4 (inspect shape), R8 (`!import`), R3 (canary paths).
- post-plan squad A5: `workflow_dispatch` only runs workflows present on the default branch, so the spike **must** use a `push` trigger on a throwaway branch.
- Existing lane for reference: `.github/workflows/ci.yml:185-264` (build-example job, SANDBOX service, readiness loop, `docker inspect` gateway lookup at `:260`).
- Pinned image (C-005): `plantuml/plantuml-server:jetty-v1.2026.9@sha256:065c66adc6728ba6dd353a29d4ada73f8358b68549a0f710c4bf46b43c103618`.

## Branch Strategy

- Planning branch and final merge target: `feat/268-plantuml-external-opt-in`.
- Execution worktrees are allocated per computed lane from `lanes.json`; this is a planning-artifact WP, so its owned files (under `kitty-specs/`) are edited in the planning checkout the runtime gives you.
- The spike workflow runs on a separate throwaway branch `spike/268-allowlist-lane`, created from `feat/268-plantuml-external-opt-in`. That branch is **never merged** and is deleted at the end (T006). Nothing from it lands except the evidence copied into owned files.

## Subtasks

### T001 – Create the throwaway spike branch and a push-triggered workflow

**Purpose**: get a workflow running on a real `ubuntu-latest` runner without merging anything to `main`.

**Steps**:
1. From a scratch clone or a separate worktree (do not switch the planning checkout's branch), create `spike/268-allowlist-lane` from `feat/268-plantuml-external-opt-in`.
2. Add a single workflow `.github/workflows/spike-268.yml` with:
   ```yaml
   on:
     push:
       branches: [spike/268-allowlist-lane]
   ```
   Never `workflow_dispatch` (A5). Never `pull_request` (it would open a PR surface).
3. One job, `runs-on: ubuntu-latest`, `timeout-minutes: 10`, with the services block from research R5 (pinned image, `ports: - 8091:8080`, `options: --add-host dk-canary:host-gateway`, `PLANTUML_SECURITY_PROFILE: ALLOWLIST`, `PLANTUML_ALLOWLIST_URL: "http://dk-canary:18091/dk-declared/;http://dk-canary:18091/dk-canary/allowed/"`).
4. A second job (or a matrix leg) with `PLANTUML_SECURITY_PROFILE: INTERNET` for the `!import` / redirect comparisons only. Allowlist entries in both legs must point only at `dk-canary` (NFR-001 applies to the spike too: no real outbound include).
5. Keep a copy of the final workflow in `kitty-specs/plantuml-external-opt-in-01M6F052/spike/spike-workflow.yml` (owned file) so the evidence survives the branch deletion.
6. Push with the operator's git identity (`GIT_AUTHOR_NAME="Stijn Dejongh"` etc. if no global identity is configured).

**Validation**:
- [ ] The run appears under the branch in the Actions tab (`gh run list --branch spike/268-allowlist-lane`).
- [ ] No other workflow in the repo was edited on the spike branch.

**Edge cases**: if the repository's Actions settings refuse runs on non-default branches, record that and try a fork-free alternative (none expected; `push` triggers run on any branch with the file).

### T002 – Prove host-gateway reachability and allowed / denied behaviour

**Purpose**: the load-bearing question; if this fails, the lane design changes.

**Steps**:
1. In a step, start a small Node canary in the background (`node spike-canary.mjs &`) listening on `0.0.0.0:18091` with:
   - `/dk-canary/allowed/probe`, `/dk-canary/allowed/include/x` → 200, body `@startuml\nAlice -> Bob : DK-CANARY-FETCHED\n@enduml\n`;
   - `/dk-canary/denied/probe`, `/dk-canary/denied/include/x` → 200, body with `DK-CANARY-DENIED-FETCHED`;
   - `/dk-canary/allowed/redirect/x` → `302 Location: http://dk-canary:18091/dk-canary/denied/redirected/x`;
   - every request path appended to a log file printed at the end.
2. Wait for PlantUML readiness with the same loop as `ci.yml` build-example.
3. `docker exec ${{ job.services.plantuml.id }} curl -sf --max-time 5 -o /dev/null http://dk-canary:18091/dk-canary/allowed/probe` and the same for `denied/probe`. Both must succeed (the canary is reachable from the container, independent of PlantUML's profile).
4. Render `@startuml\n!include http://dk-canary:18091/dk-canary/allowed/include/x\n@enduml` and the denied equivalent through `http://localhost:8091/svg/<encoded>` (reuse `encodePlantuml` from `src/scripts/plantuml-include-guard.mjs` via a one-line `node -e`). Record HTTP status, `X-PlantUML-Diagram-Error`, whether the marker appears, and the canary log.
5. Repeat with `!includeurl`.

**Validation**:
- [ ] Both probes reach the canary (log shows `/dk-canary/allowed/probe` and `/dk-canary/denied/probe`).
- [ ] Allowed include: canary hit and marker present.
- [ ] Denied include: no canary hit on `/dk-canary/denied/include/`, render is an error.

**Edge cases**: if `--add-host` is rejected for a service container (the job fails to start the service, or `dk-canary` does not resolve inside it), stop T002 and go to fallback (a) in T005: start the service with `docker run --add-host dk-canary:host-gateway …` in a step and repeat steps 3–5 against it.

### T003 – Redirect, `!import` / `!includesub`, entry trimming, trailing `;`

**Purpose**: answer the open behavioural questions the CLI and docker reader (WP11) and fixtures (R8) depend on.

**Steps**:
1. Redirect: render an include of `/dk-canary/allowed/redirect/x` under ALLOWLIST. Record whether the canary logs `/dk-canary/denied/redirected/x` and whether the denied marker appears. Repeat under INTERNET (expected: followed).
2. `!import http://dk-canary:18091/dk-canary/allowed/include/x.zip` (serve a tiny zip with one `.puml`) and `!includesub http://dk-canary:18091/dk-canary/allowed/include/sub.puml!PART` under ALLOWLIST and INTERNET. Record fetch yes/no per profile.
3. Entry trimming: a third leg (or local Docker, see below) with `PLANTUML_ALLOWLIST_URL: " http://dk-canary:18091/dk-canary/allowed/"` (leading space). Record whether the allowed include is still fetched.
4. Trailing `;`: `PLANTUML_ALLOWLIST_URL: "http://dk-canary:18091/dk-canary/allowed/;"`. Record whether the service starts and fetches normally.
5. Steps 3–4 may run locally with `docker run --add-host dk-canary:host-gateway …` against a local canary instead of on the runner; say which in the addendum.

**Validation**:
- [ ] Each of the four questions has a yes/no answer with the log excerpt that proves it.

**Edge cases**: if the redirect is followed under ALLOWLIST into the denied prefix, that is a real security finding (fallback b). Do not work around it; record it with the exact log and go to T005's return-to-operator path.

### T004 – Capture `docker inspect` and wall time

**Purpose**: the strict fake `docker` (WP02; fixture committed by WP11) must answer with a real recorded shape, not a guessed one (post-plan N2).

**Steps**:
1. Add a step: `docker inspect -f '{{json .Config.Env}}' "${{ job.services.plantuml.id }}" > inspect-capture.json` and upload it with `actions/upload-artifact` (pinned by SHA like other workflows in the repo; check `ci.yml` for the pin in use) or print it to the log between markers.
2. Copy the JSON into `kitty-specs/plantuml-external-opt-in-01M6F052/spike/inspect-capture.json` verbatim (pretty-printing is fine; content identical). It is a JSON array of `KEY=VALUE` strings and must contain `PLANTUML_SECURITY_PROFILE=ALLOWLIST` and `PLANTUML_ALLOWLIST_URL=…`.
3. Record the job's total wall time and the time from job start to PlantUML ready.

**Validation**:
- [ ] `node -e "JSON.parse(require('fs').readFileSync(process.argv[1]))" kitty-specs/plantuml-external-opt-in-01M6F052/spike/inspect-capture.json` succeeds.
- [ ] The file contains no secrets (it is the container's env; GitHub injects none into service env, but check).
- [ ] Wall time recorded; flag it if over 3 minutes (the production lane must stay under 5, NFR-002).

### T005 – Addendum and decision

**Purpose**: turn the evidence into a decision WP11, WP07, WP08 and WP10 can rely on.

**Steps**:
1. Append a section `## Spike addendum (IC-01, WP01)` to `kitty-specs/plantuml-external-opt-in-01M6F052/research.md` with: run URL(s); a table of the seven questions (Objective list) with answer and evidence excerpt; the final service block that worked (exactly as WP08 must write it); the wall time.
2. State one decision, exactly one of:
   - **GO**: R5 as designed (service with `--add-host`).
   - **GO with fallback (a)**: the service is started by `docker run` in a step; WP08 implements that and the FR-014 inventory test parses that step (R6).
   - **RETURN TO OPERATOR**: `host-gateway` fails and fallback (a) fails, or PlantUML follows the redirect across the allowlist so the lane cannot pass by design. In this case **stop**: do not mark the WP done; report the evidence to the orchestrator, who returns it to the operator. The real-service lane is never dropped silently (spec Assumption 3).
3. R8 outcome: list which of `!import` / `!includesub` fetch under which profile. If any fetch, WP11's T031 adds fixtures to `src/scripts/fixtures/plantuml-remote-include-modes/` and a follow-up issue is noted for the unset path; if none, say "no fixture needed".
4. Trimming outcome: if PlantUML does **not** trim, WP06's raw comparison (R4) stands (WP06 itself is not gated on this WP); if it does trim, note it (the comparison still stays raw, since a whitespace difference should fail loudly).

**Validation**:
- [ ] The addendum names exactly one decision.
- [ ] Every claim cites a run log line or a local command output.

### T006 – Delete the throwaway branch

**Steps**:
1. Record the last run URL in the addendum.
2. Delete `spike/268-allowlist-lane` locally and on the remote (`git push origin --delete spike/268-allowlist-lane`).
3. Confirm `git ls-remote --heads origin spike/268-allowlist-lane` is empty.

**Validation**:
- [ ] No spike branch remains; `.github/workflows/` on the mission branch is unchanged by this WP.

## If RETURN TO OPERATOR

If T005 ends in RETURN TO OPERATOR:
- WP02, WP03, WP04, WP05 and WP06 (the pure classifier) **may proceed**; none of them depends on the spike.
- WP11 (CLI routing and the `docker inspect` reader) and everything depending on it (WP07, WP08, WP09, WP10, WP12) are **blocked** until the operator decides. WP11 is gated because the spike can invalidate how the service configuration is read (inspect shape, `services:` vs `docker run` container) and whether R8 fixtures are needed.
- The branch deletion and evidence copy (T006 and the evidence files) are still done **before** reporting.

## Test Strategy

This WP has no unit tests; its evidence **is** the test of spec Assumption 3. The artifacts it produces become test inputs: `spike/inspect-capture.json` is copied by WP11 into `src/tests/fixtures/plantuml-fake-docker/inspect-capture.json`, and the final service block is what WP08's lane and WP10's guide must equal (asserted by WP08's and WP10's tests).

## Definition of Done

- [ ] All seven questions answered in the research.md addendum; the evidence for **each** question is a log excerpt or a run URL.
- [ ] `spike/inspect-capture.json` was captured from a **named run URL** (recorded next to it in the addendum), contains the image's own env (`JAVA_HOME=` and / or `JETTY_*`) and `PLANTUML_SECURITY_PROFILE=ALLOWLIST`.
- [ ] `spike/spike-workflow.yml` committed under the mission directory.
- [ ] One decision stated (GO, GO with fallback (a), or RETURN TO OPERATOR); for the last, the WP stays open and the orchestrator returns it to the operator.
- [ ] **On every outcome, before reporting**: evidence copied into the owned files and committed to `feat/268-plantuml-external-opt-in`; `spike/268-allowlist-lane` deleted locally and remotely, and `git ls-remote --heads origin spike/268-allowlist-lane` prints nothing.
- [ ] No production workflow changed.
- [ ] No real outbound include during the spike: every allowlist entry points at `dk-canary`.

## Risks

- `host-gateway` unsupported in `services.options` → fallback (a).
- Redirect followed under ALLOWLIST → a real hole; the lane would fail by design; return to the operator.
- Runner network policy blocks container → host traffic on 18091 → try fallback (a); if still blocked, return to the operator.
- Spike time-box: if the spike takes more than three pushes without a clear answer, write what is known and return to the operator rather than guess.

## Reviewer Guidance

- Check the trigger is `push` on the throwaway branch, not `workflow_dispatch`.
- Check every answer has evidence (log excerpt or run URL), and that the decision follows from it.
- Check the inspect capture is real (contains the pinned image's own env such as `JAVA_HOME` or `JETTY_*`), not hand-written.
- Check the spike branch is gone.

## Implement command

```bash
spec-kitty agent action implement WP01 --agent claude --mission plantuml-external-opt-in-01M6F052
```
