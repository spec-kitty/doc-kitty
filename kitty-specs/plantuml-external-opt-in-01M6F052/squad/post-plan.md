# Post-plan adversarial squad — dispositions

**Point-cut**: post-plan, 2026-11-02. **Question**: does the plan deliver a verified opt-in without vacuous tests, and does it stay faithful to the spec after the NFR-003/C-006 amendment?
**Cast** (profile-loaded via `spec-kitty agent profile show`): architect-alphonso (verification model, resolution path), randy-reducer (semantic compression), reviewer-renata (fakeability, lane vacuity).
**Verdicts**: alphonso, randy and renata all APPROVE-WITH-CHANGES. Orchestrator decisions: `01M6F1VS8XWTR7A7KAC42ZWAE0` (NFR-003/C-006 amendment accepted), D3 `01M6F21BY4VJVWE4VY889F80CP` (unset mode prints nothing new; the notice prints the full verify command), D4 `01M6F21EKGBG5HF8XA2YFC517K` (allowlist mode needs `docker inspect`; asserted allowlist is a follow-up).
Severities below were assigned during folding (the squad reports did not grade them).

| # | Sev | Source | Finding | Disposition | Evidence |
|---|-----|--------|---------|-------------|----------|
| A1 | MAJOR | alphonso | "Site configuration not read" note would add lines in unset mode, against FR-007. | accepted (D3) | spec: NFR-003 last sentence scoped to declared paths; Limits (site-config-only value passes as unset). research R2, R10; contracts/include-check-cli.md (unset prints nothing); contracts/opt-in-setting.md (notice prints full command with `--astro-config`) |
| A2a | MAJOR | alphonso | "Resolved to unset" vs "config never called `defineDocKittyIntegrations`" were indistinguishable. | accepted | research R2 (handoff always published; `null` → env-only resolver); data-model §1 child-answer table; plan IC-06 acceptance items |
| A2b | MINOR | alphonso | The env-only path must not read `_RESOLVED` from `process.env`. | accepted | research R2 (forged-value test); data-model §1; plan IC-11, requirement → test (FR-013) |
| A3 | MAJOR | alphonso | Allowlist mode is unreachable for services that cannot be inspected. | accepted (D4) | spec: Limits, Out of Scope (`--service-allowlist-url` follow-up). research R9 (ADR content); contracts/opt-in-setting.md "Inspectable services only"; quickstart step 3; plan IC-10, Risk 7 |
| A4 | MAJOR | alphonso | FR-007 byte identity breaks on the failure path: the probe error embeds the URL. | accepted | research R3 (unset probe stays `/reachability`; goldens cover pass and fail); data-model §2; contracts/include-check-cli.md |
| A5 | MAJOR | alphonso | `workflow_dispatch` only runs workflows on the default branch. | accepted | research R5 (spike on a `push` trigger to a throwaway branch); plan IC-01 |
| A6 | MINOR | alphonso | Env accepted `INTERNET` case-insensitively, config only `'internet'`; no env off-switch undocumented. | accepted | research R1 (lowercase in both; hint for other cases; no env off-switch); data-model E1, §1; contracts/opt-in-setting.md; quickstart "Turn it off" |
| A7 | MINOR | alphonso | plan.md still called the amendment "proposed". | accepted | plan Summary, Charter Check, Complexity Tracking; research R2 "now resolved" |
| A8 | MINOR | alphonso | ADR/changelog content tests had two owners; parity buried in IC-07; IC-06 lacked a "no static import" item. | accepted | plan IC-10 owns all prose tests (`plantuml-opt-in-docs.test.ts`); new IC-11 parity; IC-06 acceptance items |
| R1 | MINOR | randy | `inconsistent` is a fourth mode class the spec does not have. | accepted | research R11; data-model §3, §5; contracts/include-check-cli.md (`inconsistent fetches`, `observed: no class`); plan diagram |
| R2 | MINOR | randy | The shared module carried check-only helpers. | accepted | research R2 (module exports parse/validate/resolve/describeDeclared only); contracts/opt-in-setting.md owner line; plan Project Structure |
| R3 | MINOR | randy | Inventory test mixed workflow structure and prose; risk of editing the existing hardening test. | changed | Split rather than renamed only: `plantuml-workflow-services.test.ts` (structure; regex and parser copied) and `plantuml-opt-in-docs.test.ts` (prose, existence plus required substrings). research R6; plan IC-09, IC-10 |
| N1 | MAJOR | renata | The lane could pass vacuously (wrong flags, unset path, unwired `ci-ok`). | accepted | research R5 (verdict grep, exact guard), R6 (lane-vacuity assertions); contracts/include-check-cli.md (stable verdict line); plan IC-08, IC-09 |
| N2 | MAJOR | renata | A permissive fake `docker` would let wrong argv pass; inspect shape unverified; no docker-failure case. | accepted | research R4 (strict argv, recorded spike capture, missing/erroring cases); plan IC-01 (capture), IC-07; contracts/include-check-cli.md |
| N3 | MAJOR | renata | Half-removal proofs were not concrete. | accepted | research R13 (table-driven rows a, b, c1–c3, FR-006 i–ii; presence and absence; mutation record as a comment); contracts/include-check-cli.md half-specific substrings |
| N4 | MAJOR | renata | Goldens covered only the pass path and could be captured after changes. | accepted | research R3 (pass and fail; stdout, stderr, exit; separate earlier commit; `--canary-port` leaves output unchanged); plan IC-02 |
| N5 | MINOR | renata | NFR-001 test lacked a declared-entry server and a positive control. | accepted | research R3 "Request log"; plan requirement → test (NFR-001) |
| N6 | MINOR | renata | Fixed 18091 in tests collides under parallel Vitest; unset detection depends on flags. | accepted | research R3 (detection only with flags), R13 (free ports); quickstart "Turn it off" |
| N7 | MINOR | renata | No requirement → test map. | accepted | plan "Requirement → test" table (build / ratchet / folded), including FR-003 per source and US4 AS3 |
| N8 | MINOR | renata | Parity did not prove the real `defineDocKittyIntegrations` ran. | accepted | research R13 (`indexBasename: ['PARITY']` → `names` in the child answer); data-model §7; plan IC-11 |

**Counts**: 20 findings; 19 accepted, 1 changed, 0 deferred_with_rationale.
