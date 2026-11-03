# Post-tasks adversarial squad — dispositions

**Point-cut**: post-tasks, 2026-11-02. **Question**: can the work packages be completed without delivering a verified opt-in, and are they sized, sequenced and owned so lanes can run in parallel?
**Cast** (profile-loaded via `spec-kitty agent profile show`): reviewer-renata (DoD enforcement), planner-priti (sequencing, lane visibility), implementer-ivan (implementability).
**Verdicts**: renata, priti and ivan all APPROVE-WITH-CHANGES. Orchestrator decisions (O1–O3) restructure WP06, WP07 and WP01.
Severities were assigned during folding.

| # | Sev | Source | Finding | Disposition | Evidence |
|---|-----|--------|---------|-------------|----------|
| O1 | MAJOR | orchestrator | WP06 mixed the pure classifier with the CLI and docker reader, so the spike gated pure logic. | changed: split into WP06 (pure classifier, verdict and messages; no CLI, no docker) and new WP11 (CLI flags, routing, docker reader, verdict output); WP11 depends on WP06 | tasks.md WP06, WP11; tasks/WP06-declared-mode-verifier.md; tasks/WP11-include-check-cli.md |
| O2 | MAJOR | orchestrator | WP07 combined the matrix with halves, edges and NFR-001 in one oversized WP. | changed: WP07 = 9-cell matrix (`plantuml-include-check-cli.test.ts`); new WP12 = half-removal, edge cases 1–8, NFR-001, mutation record (`plantuml-include-check-halves.test.ts`); no owned-file overlap | tasks.md WP07, WP12; tasks/WP07-command-matrix-tests.md; tasks/WP12-half-removal-and-edge-cases.md |
| O3 | MAJOR | orchestrator | WP01 needs pushes, `gh` and a real runner; RETURN-TO-OPERATOR blast radius was unstated. | accepted: WP01 marked orchestrator-run (still planning_artifact); "If RETURN TO OPERATOR" paragraph (WP02–WP06 proceed; WP11 and dependents blocked); branch deletion + evidence copy is DoD on all outcomes; WP06's edge on WP01 removed, WP11 gated with the reason stated | tasks/WP01-ci-feasibility-spike.md (banner, "If RETURN TO OPERATOR", DoD); tasks.md dependency graph; WP06 "Why this WP is not gated"; WP11 "Why this WP is gated" |
| N1 | MAJOR | renata | WP02 DoD did not pin how goldens were produced or prove ordering. | accepted | WP02 DoD: recorded base sha, ≥1 pass and ≥1 fail golden with stdout+stderr+exit, near-miss test (`docker ps`, missing `-f`, extra args, wrong curl flag → 125), commit precedes `src/scripts` changes |
| N2 | MAJOR | renata | Half rows lacked names and the absence rule in the DoD; mutation record unverified. | accepted | WP12 T035 table (a, b, c1, c2, c3, i, ii), DoD, Reviewer Guidance (reviewer re-runs two rows) |
| N3 | MAJOR | renata | NFR-001 had no explicit DoD. | accepted | WP12 DoD: declared-entry server 0 requests on the pass run AND `strayPath` variant exits 1 with the stray substring |
| N4 | MINOR | renata | Stability and port rules not enforceable. | accepted | WP07 and WP12 DoD: three consecutive `pnpm test` runs at default workers; `grep -n 18091` empty |
| N5 | MINOR | renata | Inspect-fixture parse guard only in steps. | changed: the fixture moved to WP11 (docker reader owner); its parse-and-image-env guard is a T057 test and WP11 DoD | tasks/WP11-include-check-cli.md T057, DoD |
| N6 | MAJOR | renata | WP08 DoD did not enumerate the lane's load-bearing parts; no neutered-lane check. | accepted | WP08 DoD: exact `if`, `needs`, flags, `grep -F`, pipefail, no `pnpm install`, `ci-ok` needs + `PLANTUML_ALLOWLIST_RESULT`; recorded neutered-lane mutation check |
| N7 | MINOR | renata | WP01 capture provenance and evidence form unpinned. | accepted | WP01 DoD: named run URL, `JAVA_HOME` / `JETTY_*` + `PLANTUML_SECURITY_PROFILE=ALLOWLIST`, evidence per question |
| N8 | MINOR | renata | WP06 / WP11 DoD used unverifiable phrases ("cannot pass without", "every message matches"). | accepted | WP06 DoD points at WP12 rows a, b, c1–c3, i, ii and WP07 M1–M9; WP11 DoD per-item pointers; forged `_RESOLVED` not read (grep + WP09 case) |
| N9 | MINOR | renata | WP04 "no new output lines" untestable as written. | accepted | WP04 DoD: `pnpm build 2>&1 \| grep dk-plantuml` empty |
| N10 | MINOR | renata | WP03 rows could pass on any throw. | accepted | WP03 DoD: each E-row asserts source label, reason substring and `accepted:` |
| N11 | MINOR | renata | WP05 DoD did not prove existing tests/goldens untouched; marker and redirect cases implicit. | accepted | WP05 DoD: `git diff --stat` clean for goldens and guard test; marker-overlap and redirect DoD items |
| N12 | MINOR | renata | WP10 "covers every topic" was not checkable. | accepted | WP10 DoD points at the T055 required-substring list and block-equality test |
| P1 | MAJOR | priti | WP07 and WP10 consume WP01 outputs but did not depend on it; planning-artifact visibility in lane worktrees unconfirmed. | accepted: WP01 added to WP07 and WP10 dependencies; the orchestrator-run WP01 commits evidence to `feat/268-plantuml-external-opt-in` before dependent lanes start | WP07, WP10 frontmatter and Branch Strategy; tasks.md "Evidence visibility" |
| P2 | MINOR | priti | No mission-level full-suite gate. | accepted | WP10 DoD and tasks.md: full `pnpm test` + `pnpm lint` |
| P3 | MINOR | priti | WP08's CI-green proof cannot be done by a lane agent. | accepted | WP08 T043 and DoD: orchestrator-owned mission-review / PR-check item |
| I1 | BLOCKER | ivan | "Docker missing" by dropping the fake dir from PATH can still find a real `docker`. | accepted | WP02 harness `runCheck({ pathMode: 'node-only' })` (temp dir with only a `node` symlink to `process.execPath`, used as the whole PATH); WP12 T037.2; WP11 T057 |
| I2 | MAJOR | ivan | `evaluateSiteConfig` contract was misdescribed. | accepted: pinned `evaluateSiteConfig({ siteRoot, astroConfig, tool }) → { configPath, siteDir, config }` (`site-config-eval.mjs:118-135`); read `result.config.plantumlAllowExternal`; siteRoot = dirname of the path; `config === null` / field `null` → env-only; missing file → exit 2; `ConfigEvalError` → exit 2 | WP11 "The `evaluateSiteConfig` contract"; WP09 T045; WP12 T036.9 |
| I3 | MAJOR | ivan | Harness: per-port normalization, possible sync spawn deadlock with in-process fakes, non-deterministic fake stderr, golden update reachable in CI. | accepted | WP02 T007.5 (fixed stderr, trailing newline), T008 (one regex, async spawn only), T009 (update mode fails with `CI=true`) |
| I4 | MINOR | ivan | WP04 notice: `<path>` placeholder not asserted; repeated printing unstated; "known keys guard" may not exist. | accepted | WP04 T019 (literal `<path>`, per-call printing stated), T021 case 4, T017 step 3 ("if present") |

**Counts**: 22 findings; 19 accepted, 3 changed (O1, O2, N5), 0 deferred_with_rationale.

## Spike findings

WP01 (orchestrator-run) verdict **GO**; evidence in commit 2eefef7 (`spike/**`, research.md addendum). Folded into the planning artifacts on 2026-11-02.

| # | Sev | Source | Finding | Disposition | Evidence |
|---|-----|--------|---------|-------------|----------|
| S1 | MAJOR | spike F1 | A real INTERNET service refuses the private dotless canary, so the canary can never observe internet mode; an INTERNET service with the canary allowlisted looks like allowlist. | changed (D5 `01M6F4BRKQ4E9H9Z41BYZH37MC`): internet mode is verified by `PLANTUML_SECURITY_PROFILE == INTERNET` read from the container, which is required; canary results informational; observed class = profile when the container is named | spec FR-006, US2 matrix + AS2, US3, Domain Language, Key Entities, Limits; research R11, R12; data-model §3, §4, §6; contracts/include-check-cli.md (matrix, half table, other substrings); contracts/opt-in-setting.md; quickstart "Internet mode"; plan Summary note, flowchart, Risk 6; WP06 T032/T058/T027; WP11 T029, DoD; WP07 M6–M9, M6b; WP12 rows i, ii + internet baseline; WP10 guide items 6, 8, ADR |
| S2 | MAJOR | spike F2 | An empty non-trailing item in the service's `PLANTUML_ALLOWLIST_URL` allows every URL. | accepted (D6 `01M6F4BVDASAREW2NVH23727CW`): the configuration half fails on any empty item other than one trailing `;` | spec FR-004 (c), edge case 10; research R4; data-model §4, §6; contracts half table + other substrings; WP06 T032.3 / T058 / T027.9; WP12 row c4; WP10 guide item 3 |
| S3 | MINOR | spike F3 | A refused redirect renders HTTP 200 with an empty diagram. | accepted: redirect judged only from the request log | spec edge case 8; research R11; data-model §3; contracts; WP02 harness (200 empty diagram); WP05 risk note; WP06 T027.6, T032.8; WP12 edge case 8 |
| S4 | MINOR | spike F4 | PlantUML requests each included URL twice. | accepted: "at least one hit", never exact counts; fakes may fetch twice (`fetchCount: 2`, default 1 keeps goldens) | research R11; data-model §3; WP02 T008; WP05 T024.8; WP06 T032.2, T027.5; WP07, WP12 |
| S5 | MINOR | spike F5 | Entries or URLs containing `@` never match the allowlist. | accepted: declared entries with `@` rejected (new edge case 9, E7); one guide line | spec edge case 9, FR-002; data-model E7; contracts/opt-in-setting.md; quickstart; WP03 T016/T013, DoD; WP12 edge case 1; WP10 guide item 3 |
| S6 | MINOR | spike Q5a | PlantUML trims, lowercases and strips `:80` / `:443` from entries. | accepted: R4 raw-string equality kept (stricter, fails safe); guide says to write entries exactly as declared | research R4 Alternatives; contracts/opt-in-setting.md Entry; spec FR-008; quickstart; WP06 T032.3; WP10 guide item 3 |
| S7 | MINOR | spike Q6 | Inspect env holds runner-injected vars and its order varies. | accepted: the reader picks the two `PLANTUML_*` keys by name; entries compared as sets | research R4; data-model §4; WP06 T032.4; WP11 T028, T057 |
| S8 | MINOR | spike Q4 / R8 | `!import` / `!includesub` fetch under no profile. | accepted: no fixture; WP11 T031 records it | WP11 T031; tasks.md T031 row |
| S9 | MINOR | spike decision | GO: services block works; fallback (a) not needed; lane 38 s. | accepted | WP08 Context, T041.3, T038.3; tasks.md WP01 status |

**Counts (spike findings)**: 9; 8 accepted, 1 changed (S1), 0 deferred_with_rationale.

## Analyze findings

`/spec-kitty.analyze` returned BLOCKED (2 high, 8 medium, 9 low; `analysis-report.md`, commit ee7abeb). New decision D7 `01M6F4XFDPJ6XFBYM5HM65G1AM` resolves A2.

| # | Sev | Source | Finding | Disposition | Evidence |
|---|-----|--------|---------|-------------|----------|
| A1 | HIGH | analyze | Internet-mode build notice omits `--service-container`, so the printed verify command always fails after D5. | accepted | contracts/opt-in-setting.md internet notice; WP04 T019 internet line, T021 case 5 asserts `--service-container` present |
| A2 | HIGH | analyze | Unset × real INTERNET service is undetectable (the image refuses the canary), contradicting the matrix. | changed (D7): in unset mode with `--service-container`, after the unchanged check passes, the profile must be `SANDBOX` (absent = image default `INTERNET` fails); pass output byte-identical; without the container the limit is recorded | spec US2 narrative + matrix Unset row, US4 AS4 + Independent Test, FR-007, Limits, Out of Scope; data-model §6; contracts/include-check-cli.md (unset section, matrix, substrings, exit 1); research R7, R9; quickstart "Turn it off"; plan; WP02 (SANDBOX inspect for container goldens), WP06 `checkUnsetProfile`, WP11 T029.5 + DoD, WP07 M2c / M3c and M3 fake-only, WP12 rows u0–u2, WP10 guide item 10 + changelog fragment + T055 |
| A3 | MEDIUM | analyze | "Uninspectable → internet mode" wording stale after D5. | accepted | spec Limits; contracts/opt-in-setting.md; quickstart step 3; plan Risk 7; research R9 |
| A4 | MEDIUM | analyze | R13 still lists canary-based FR-006 halves and the old file; c4 missing. | accepted | research R13 |
| A5 | MEDIUM | analyze | Plan's requirement → test names the wrong file for halves / edges / NFR-001; no rows for edge cases 9, 10. | accepted | plan tree, IC-07, requirement → test |
| A6 | MEDIUM | analyze | Contract names two `.txt` goldens; plan / WP02 use five cases × three files. | accepted | contracts/include-check-cli.md "Output, unset mode" |
| A7 | MEDIUM | analyze | Matrix column headers described canary behaviour a real internet service never shows. | accepted | spec US2 matrix headers + column note |
| A8 | MEDIUM | analyze | `compareAllowlist` contract silent on whether an empty item appears in `extra`. | accepted: empty items only via `emptyItems`, never in `extra` / `missing` | WP06 T032 row 4b, T058 |
| A9 | MEDIUM | analyze | No gate fails if the real lane never goes green. | accepted: orchestrator-owned mission-level PR-check gate naming SC-001 / SC-004 / NFR-002 | tasks.md "Mission-level PR-check gate"; WP08 DoD |
| A10 | MEDIUM | analyze | "Removed the setting … check fails" holds only with matching canary flags. | accepted (and widened by D7: `--service-container` also detects it) | spec US2 narrative; quickstart step 5; WP10 guide item 10 |
| A11 | LOW | analyze | Stale edge-case ranges and research counts. | accepted | plan (scale, tree, IC-03, IC-07, req → test); tasks.md T013, T036; WP12 title |
| A12 | LOW | analyze | Exit-code table omits internet missing container and edge case 9. | accepted | contracts/include-check-cli.md exit codes |
| A13 | LOW | analyze | Plan Summary limits inspect to allowlist; flowchart fails internet on a probe failure. | accepted | plan Summary, flowchart |
| A14 | LOW | analyze | WP01 priority line said it gates WP06. | accepted | tasks.md WP01 Priority |
| A15 | LOW | analyze | WP06 DoD omits c4; c1 substring overlaps row ii. | accepted | WP06 DoD; WP12 T035 row c1 full substring |
| A16 | LOW | analyze | Edge case 7 silent on internet mode. | accepted | spec edge case 7 |
| A17 | LOW | analyze | "Only canary entries" / "exactly the guide's block" ambiguous. | accepted | spec NFR-001, FR-012 |
| A18 | LOW | analyze | US1 AS4 (undeclared URL refused) unmapped. | accepted: fake-only row; real behaviour is the service's | WP12 T037.8; plan requirement → test |
| A19 | LOW | analyze | ADR content does not require the unconditional-lane rationale (ADR-0007 exception). | accepted | research R9; WP10 T052 Consequences, T055 item 3 |

**Counts (analyze findings)**: 19; 18 accepted, 1 changed (A2, via D7), 0 deferred_with_rationale.

## Re-analyze findings

Re-analyze verdict: ready (0 high); report `analysis-report.md`, commit ec8a6e3. Folded before implementation.

| # | Sev | Source | Finding | Disposition | Evidence |
|---|-----|--------|---------|-------------|----------|
| A11 (partial) | LOW | re-analyze | Stale edge-case ranges remained (tasks.md ×3, WP12, WP07, WP03 describe label). | accepted: edge cases 1–10, E-rows E1–E7 | tasks.md WP03 independent test, T013, T036; WP12 objective + T036 heading; WP07 objective; WP03 T016 step 3 |
| B1 | MEDIUM | re-analyze | Inserted paragraphs split the 3×3 matrix tables. | accepted: tables restored; notes U-A / U-I keyed to cells below them | spec.md US2; data-model §6 |
| B2 | MEDIUM | re-analyze | Unset × allowlist with a container depends on whether the canary entry is allowlisted. | accepted: split rows (allowlisted → FETCHED first; not → D7 profile message) | spec note U-A; data-model note U-A; contracts/include-check-cli.md matrix; WP07 M2c, new M2d; WP12 u3 |
| B3 | MEDIUM | re-analyze | D7 profile read did not fail closed on Java system properties. | accepted | data-model §6; contract unset section + substrings; WP06 `checkUnsetProfile` (system properties first); WP12 row u4 |
| B4 | LOW | re-analyze | D7 wording inconsistent ("no new line in pass or fail"). | accepted | research R7; WP11 T029.5 + DoD; spec US4; plan flowchart (unset profile-read step), IC-02 requirements, coverage and requirement → test rows |
| B5 | LOW | re-analyze | PR-check gate section separated WP10 from its Risks line. | accepted: moved after WP10's Risks | tasks.md |
| B6 | LOW | re-analyze | No test for `docker inspect` failing in unset mode after a passing check. | accepted | WP02 `DK_FAKE_DOCKER_INSPECT_FAIL`; WP12 row u5; contract substring row |

**Counts (re-analyze findings)**: 7; 7 accepted, 0 changed, 0 deferred_with_rationale.
