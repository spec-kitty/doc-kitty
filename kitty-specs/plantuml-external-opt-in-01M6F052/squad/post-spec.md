# Post-spec adversarial squad — dispositions

**Point-cut**: post-specify, 2026-11-02. **Question**: can the spec be met without delivering a verified, safe opt-in, and does its security boundary hold?
**Cast** (profile-loaded via `spec-kitty agent profile show`): reviewer-renata (sonnet; fakeability), architect-alphonso (opus; security boundary and verification model), researcher-robbie (sonnet; assumptions, empirical test of the pinned image).
**Verdicts**: renata REVISE, alphonso REVISE, robbie APPROVE-WITH-CHANGES. The blocker converged across two independent lenses.

| # | Sev | Source | Finding | Disposition | Evidence |
|---|-----|--------|---------|-------------|----------|
| 1 | BLOCKER | renata, alphonso | Allowlist proof target undefined: the check cannot fetch the operator's real hosts. | accepted | spec: Intent; US1 AS2–3; FR-004; Limits; domain terms *canary*, *mode class* |
| 2 | MAJOR | alphonso, renata | "No more, no less" overclaims with one canary; 3×3 matrix undercounted. | accepted | spec: Intent; US2 matrix; FR-004(c); FR-005; SC-002; Limits |
| 3 | MAJOR | alphonso, robbie | Canary binds a random port; allowlist is fixed at service start. | accepted | spec: Key Entities (fixed port); Assumption 3 (plan spike) |
| 4 | MAJOR | alphonso, robbie | Raw prefix match: `http://host` allows `host.evil.com` (verified empirically). | accepted | spec: Edge cases 3–4; FR-002; FR-008 |
| 5 | MAJOR | renata | Refusal half is a blind probe without its own reachability control. | accepted | spec: FR-004(b); Edge case 7; US1 AS3 |
| 6 | MAJOR | renata | No criterion tests the production entry point; NFR-003 had no mechanism. | accepted | spec: FR-011 (at the command); FR-013; NFR-003 (9 of 9) |
| 7 | MAJOR | renata | US1 build outcomes had no verifying criterion. | changed | US1 AS1 now the build notice (FR-003); "renders/fails on host B" restated as service behaviour (AS4), proven in the CI lane (FR-012) |
| 8 | MAJOR | renata | Ratchet positive control not same-fixture; "byte-identical build output" unachievable; bundle contradicts FR-012/FR-008. | accepted | spec: FR-007; US4 AS1–3; SC-003 |
| 9 | MAJOR | renata | No half-by-half requirement. | accepted | spec: FR-004, FR-006 ("removing any half turns a test red") |
| 10 | MAJOR | renata | Guide blocks unexecuted; lane might be path-filtered. | accepted | spec: FR-008 ("same block the CI lane runs"); FR-012 (not path-filtered, feeds `ci-ok`) |
| 11 | MAJOR | alphonso | Trade-off text missing local-file relaxation, SSRF/internal networks, redirects. | accepted | spec: FR-008; Edge case 8 |
| 12 | MAJOR | alphonso | `plantuml-service-hardening.test.ts` inspects only the first PlantUML service per workflow. | accepted | spec: FR-014 |
| 13 | MAJOR | robbie | "Env wins, per `DK_PLANTUML_SERVER_URL`" is not a precedent. | accepted | spec: Assumption 1 (new rule); FR-009 |
| 14 | MINOR | alphonso | No #251 record to amend; decision lives in `docs/architecture/diagrams.md`. | accepted | spec: Background; FR-009 (new ADR + diagrams.md) |
| 15 | MINOR | alphonso | Build notice can only say "declared"; env-only CI setting loosens the check, not the service. | accepted | spec: FR-003 ("declared"). Hard build failure for env-only internet mode: deferred_with_rationale — the notice names the source; the ADR records the option for a later decision. |
| 16 | MINOR | alphonso, robbie | Bundled `<C4/...>` stdlib renders under SANDBOX (verified). | accepted | spec: Background note; FR-008 |
| 17 | MINOR | robbie | Name `PLANTUML_ALLOWLIST_URL` and the `;` separator; reject `;` inside an entry. | accepted | spec: Assumption 2; FR-008; Edge case 4 |
| 18 | MINOR | renata | Edge cases lacked scenarios; empty env value undefined; malformed value fails where? | accepted | spec: Edge cases 1–8 (now FR-002/FR-013 scenarios) |
| 19 | MINOR | renata | NFR-001 had no measurement. | accepted | spec: NFR-001 (allowlist contents + canary request log) |
| 20 | MINOR | renata | FR-009/FR-010 no-op passable unless content asserted. | accepted | spec: FR-009, FR-010 |
| 21 | MINOR | renata | Message content unspecified. | accepted | spec: US2 AS1; FR-005; FR-011 (stable substrings) |
| 22 | MINOR | alphonso | `!import` / archive include forms. | deferred_with_rationale | Plan decides whether the pinned image supports them and adds a fixture if so; not a spec-level behaviour. |
| — | — | robbie | INTERNET semantics not verified empirically. | deferred_with_rationale | Out of Scope (no real internet-mode service in CI, operator decision); fake-service tests pin the check's logic. |

## Plan-phase amendment

| # | Source | Finding | Disposition | Evidence |
|---|--------|---------|-------------|----------|
| P1 | plan author (architect-alphonso) | NFR-003's site-config-only cells conflict with C-006: reading `astro.config.*` needs the site's dependencies. | changed — decision `01M6F1VS8XWTR7A7KAC42ZWAE0` (orchestrator, under the operator's drive-E2E mandate): the site-config path needs `--astro-config`; env and unset stay pre-install. | spec: FR-013, NFR-003, C-006, Limits |
