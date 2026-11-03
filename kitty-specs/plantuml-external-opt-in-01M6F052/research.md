# Research and decisions: PlantUML external-connection opt-in (#268)

**Mission**: `plantuml-external-opt-in-01M6F052` · **Phase**: plan · **Date**: 2026-11-02 (revised after the post-plan squad, [squad/post-plan.md](./squad/post-plan.md))
**Profile**: architect-alphonso (loaded with `spec-kitty agent profile show architect-alphonso`)
**Inputs**: [spec.md](./spec.md) (authoritative), [squad/post-spec.md](./squad/post-spec.md), issue #268, decision `01M6F05V604SFYSZ9235CRH536` (fakes plus one real ALLOWLIST lane).

## Governance applied

Charter context: `spec-kitty charter context --action plan --json` (template set `software-dev-default`, languages JavaScript/TypeScript) and `.kittify/charter/charter.md`.

| Directive / tactic | How it shaped this plan |
|---|---|
| DIRECTIVE_001 Architectural Integrity | One resolver module with no dependencies (R2) is the only owner of the setting's rules. The canary, the observed-mode classifier and the service-config reader are separate units with pure functions, so each can be tested without Docker. |
| DIRECTIVE_003 Decision Documentation | Every decision below has Decision / Rationale / Alternatives. The load-bearing ones go into ADR-0074 (R9). |
| DIRECTIVE_010 Specification Fidelity | The spec cannot be met as written on one point (R2: NFR-003 and C-006 together). The deviation is named, with a minimal amendment, not hidden. |
| DIRECTIVE_024 Locality of Change, RECONCILE_CHANGE_SCOPE_TENSIONS | The existing sandboxed lane, its step, the guide's recommended block and `plantuml-service-hardening.test.ts` stay as they are. FR-014 goes into a new test file (R6) so SC-003 ("existing tests pass unmodified") holds literally. |
| DIRECTIVE_031 / 032 Context-aware design, Conceptual alignment | The spec's domain terms (opt-in setting, allowlist entry, canary, mode class, include check) are used verbatim in names and messages. "Host" is not used for an entry. |
| DIRECTIVE_034 / 036 Test-first, Black-box | The unset-mode golden output is captured from today's code before any change (characterization). The matrix is tested through the real command with fake services and a fake `docker` on `PATH` (R3, R4). |
| DIRECTIVE_041 Tests as scaffold | Each verification half (FR-004 a/b/c, FR-006) has a fake service that differs from a passing one in that half only, so removing the half turns exactly that test red. |
| USE_MUTATION_TESTING_TO_VALIDATE_TEST_QUALITY | No mutation tool is in the repo and none is added. The review of the verification concern removes each half by hand and records the red test (a manual mutation pass). |
| DIRECTIVE_043 Close defect classes by construction | The FR-014 inventory test finds PlantUML services by image across every workflow file (a glob), so a new workflow or a second service cannot skip the check. |
| DIRECTIVE_044 Canonical sources | Reuses `site-config-eval.mjs` (config evaluation), `internal-env.mjs` (handoff names) and `ci-ok-decision.mjs` (lane gate) rather than new parallel mechanisms. |
| DIRECTIVE_051, dependency-hygiene, supply-chain-install-safety | No dependency is added. The resolver and the check use Node built-ins only. The CI lane adds no action and no image beyond the already digest-pinned PlantUML image. |
| USE_C4_MODEL_TECHNIQUES | The plan's diagram is at component level (the check's decision flow); no new container is introduced. |

## Code evidence used

- `src/scripts/assert-plantuml-no-remote-include.mjs:24-37` parses three flags and exits 2 on an unknown one; `:47` resolves `--server` from `DK_PLANTUML_SERVER_URL`; `:50-54` runs `docker exec <c> curl` as the probe; `:56-71` prints the output that FR-007 freezes.
- `src/scripts/plantuml-include-guard.mjs:86-100` starts the canary on port 0 (random) and serves the same body for every path; `:149-164` probes `/reachability`; `:166-181` renders each fixture against `/include/<fixture>`.
- `src/tests/plantuml-include-guard.test.ts:77` pins the fixture directory to exactly two files; `:97-99` pins message texts. Neither pins canary paths or ports.
- `src/tests/plantuml-service-hardening.test.ts:29-36` reads only the FIRST `plantuml:` block of each of three hard-coded workflows; `:53` requires SANDBOX.
- `src/lib/integrations/diagrams.ts:324-350` (`DEFAULT_PLANTUML_SERVER_URL`, `resolvePlantumlServerUrl`): env-only, no site-config counterpart. `diagramsIntegration` (`:479`) is a constant, not a factory.
- `src/lib/config.ts:145-210` (`DocKittyOptions`, `diagrams?: boolean`), `:507-583` (eager validation, `setInternalEnv` handoffs), `:771` and `:776` (`diagrams === true`, `diagrams ? [...]`).
- `src/lib/internal-env.mjs` owns every internal handoff name and `clearInternalEnv`.
- `src/scripts/site-config-eval.mjs:184-200` evaluates `astro.config.*` in a child process with the site's own `astro`/`vite`, and returns only extracted fields. It imports `draft-publication.mjs`, which imports `gray-matter` (`src/lib/draft-publication.mjs:18`), so it cannot load before install.
- `src/lib/draft-publication.mjs:1-14`: the precedent for one pure `.mjs` module shared by the TypeScript integration and the bare-Node gates.
- `.github/workflows/ci.yml:185-264` (build-example lane, the SANDBOX service, the include-check step run with `node src/scripts/...` before install), `:411-429` (`ci-ok` needs and `*_RESULT` threading); `.github/scripts/ci-ok-decision.mjs:25` (`REQUIRED_LANES`); `.github/filters.yml` (`src/**` and `.github/workflows/**` both select build-example).
- `docs/guides/consumer-setup.md:949-1000` (hardened block; the guide runs the check with `pnpm exec`, after install).
- `docs/architecture/diagrams.md:157-171` (the sandbox decision, no ADR).
- `docs/adr/`: highest number is 0073 on this branch and on `origin/main`; `gh pr list --state open` returned no open PRs, so no ADR is in flight. Next free: **0074**.

---

## R1. Setting surface: name, shape, environment form

**Decision**
- Site configuration: a new top-level `DocKittyOptions` field, `plantumlAllowExternal?: readonly string[] | 'internet'`. Absent means sandbox.
- Environment override: `DK_PLANTUML_ALLOW_EXTERNAL`. Text form: the word `internet` (exactly lowercase, trimmed; the same literal the site configuration accepts, post-plan A6), or allowlist entries joined by `;`. Each item is trimmed; empty items are dropped (so a trailing `;` is harmless); if nothing remains, the value is an empty allowlist and is rejected (edge case 2). An empty or whitespace-only value is unset (edge case 5).
- Mapping to the service: `PLANTUML_ALLOWLIST_URL = [...declared entries, canaryEntry].join(';')`. The env text form is deliberately the same `;`-joined form, so an operator can paste the declared entries into the service block.

**Rationale**
- The issue suggests `diagrams.plantuml.allowExternal`, but `diagrams` is a boolean read by identity (`config.ts:771` `diagrams === true`, `:776`). Widening it to an object would make `diagrams: { … }` silently mean "on" and touch every branch that reads it. A sibling top-level option keeps `diagrams` intact and keeps the issue's verb (`allowExternal`).
- `DK_PLANTUML_*` matches `DK_PLANTUML_SERVER_URL`. The `;` form is PlantUML's own separator, and FR-002 already forbids `;` inside an entry, so the split is unambiguous.
- `INTERNET` or `Internet` is rejected with a hint ("use lowercase `internet`"), so the env and the site configuration accept the identical literal (A6).
- `sandbox` is not accepted as a word: the spec allows exactly three values (FR-002), and a fourth spelling of "unset" would let `DK_…=sandbox` look like an override of a site allowlist while edge case 5 says the env cannot express "unset over a site value". The error message says "leave it unset for sandbox". Consequence, stated in the guide's "turn it off" paragraph: **there is no environment off-switch over a site allowlist**; to return to sandbox, remove the site option (A6).

**Alternatives**
- `diagrams: { plantuml: { allowExternal } }` (issue's suggestion): rejected for the identity reads above; noted in the ADR.
- JSON in the env (`'["https://…/"]'`): rejected; quoting in YAML workflows is error-prone and the result cannot be pasted into `PLANTUML_ALLOWLIST_URL`.
- Whitespace or comma separation: rejected; commas and spaces are legal in URLs, `;` is already forbidden.

## R2. One shared resolver, and how the include check sees a site-configuration value

**The problem.** The build reads `astro.config.*`, which can only be evaluated with the site's `astro` and `vite` installed (`site-config-eval.mjs:188-191`). The toolkit's own include-check step runs before `pnpm install` (`ci.yml:254-264`, C-006). A value set only in site configuration is therefore invisible to a pre-install check.

**Options evaluated**

| Option | NFR-003 9/9 | C-006 | Verdict |
|---|---|---|---|
| A. Check reads env only; docs tell CI to export it | 6/9 (the three "site config only" cells differ) | yes | fails NFR-003 |
| B. Static JSON side file both read (e.g. `dockitty.plantuml.json`) | 9/9 | yes | a second config surface beside `docKitty({...})`; the issue asks for "one flag in the site config"; no precedent in the toolkit |
| C. Parse the option out of `astro.config.mjs` text | flaky | yes | a config is code (imports, spreads, computed values); fails closed often, lies sometimes |
| D. The build writes a resolved-value artifact the check reads | 9/9 only after a build | yes | the check normally runs **before** the build (`ci.yml` order: check, then build); stale artifacts would be read silently |
| E. Check evaluates the site config with `--astro-config <path>` through `site-config-eval.mjs`; without the flag it reads the env only | 9/9 with the flag | env and unset paths: yes; config path: needs the site's `astro` installed | **chosen** |
| F. E, but auto-discover the config | 9/9 | no: a pre-install run in a site directory would newly fail, changing unset-mode output (FR-007) | rejected |

**Decision**
- New module `src/lib/plantuml-external.mjs`: pure ESM, JSDoc types, **no imports at all** (not even `node:` ones are needed). Exports only `PLANTUML_ALLOW_EXTERNAL_ENV`, `parseAllowExternalEnv`, `validateAllowExternal`, `resolvePlantumlAllowExternal({ env, siteValue })` returning `{ mode: 'sandbox'|'allowlist'|'internet', entries: string[], source: 'default'|'environment'|'site configuration' }` or throwing `PlantumlAllowExternalError`, and `describeDeclared(resolution)` (the one line both the build and the check print). Canary-entry construction and allowlist comparison are check concerns and live in `src/scripts/plantuml-mode-check.mjs` (post-plan R2).
- The build: `defineDocKittyIntegrations` calls the resolver eagerly (like `gherkin`, `config.ts:528`), so an invalid value throws at config time (edge case 1). It **always** publishes the resolution, including `{ mode: 'sandbox', entries: [], source: 'default' }`, as a new internal handoff `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` (JSON) through `setInternalEnv`, and prints the FR-003 notice (R10) only when the mode is not sandbox. Publishing is invisible (no output), so FR-007 holds.
- The check: with `--astro-config <path>`, it dynamically imports `site-config-eval.mjs` (never at top level, so the env and unset paths still need nothing installed) and reads the new `plantumlAllowExternal` field the child returns. An explicit resolution means the config called `defineDocKittyIntegrations`; `null` means it never did (no handoff published), and the check then falls back to the env-only resolver rather than reading `null` as sandbox (post-plan A2a). The check never reads `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` from its own `process.env`: only the child's answer counts, and a test sets a forged value in the parent env and shows it is ignored (A2b). The child deletes any inherited value before evaluating, like `DK_INDEX_BASENAME` (`site-config-eval.mjs:84-87`). Without the flag, it calls the same resolver with `siteValue: undefined`. A `--print-declared` flag prints the resolution as one JSON line and exits 0 without probing; this is the measurement hook for NFR-003.
- The child process passes `DK_PLANTUML_ALLOW_EXTERNAL` through (it inherits the env), so "environment wins" is applied by the same resolver in the same place for both sides.

**Rationale.** Option E is the only one that reaches 9 of 9 without a second configuration surface or a stale artifact, and it reuses the existing, tested config-evaluation path (DIRECTIVE_044). It keeps C-006 for every path that exists today: the toolkit's lanes declare through the environment and run pre-install; consumers already run the check with `pnpm exec` after install (`consumer-setup.md:985-990`), where evaluation works.

**Spec deviation (DIRECTIVE_010), now resolved.** NFR-003's "site configuration only" cells require reading `astro.config.*`, which C-006 forbade before install. The amendment below was **accepted** (decision `01M6F1VS8XWTR7A7KAC42ZWAE0`) and is in spec.md; decision `01M6F21BY4VJVWE4VY889F80CP` further scopes the "not read" statement to the declared paths, so unset mode prints nothing new. Original proposal, for the record:
- FR-013 / NFR-003: "...when the include check is given the site configuration (`--astro-config <path>`). Without it, the check reads only the environment, and says so in its declared line."
- C-006: "The include check keeps running on Node built-ins only, before dependencies are installed, when the value comes from the environment or is unset. Reading a value from site configuration (`--astro-config`) needs the site's dependencies installed."
- Limits: add "Without `--astro-config`, a value set only in site configuration is not seen; the check then verifies sandbox mode. The guide always passes `--astro-config` in the allowlist and internet recipes."

## R3. Canary redesign

**Decision**
- One canary (in `plantuml-include-guard.mjs`, exported `startCanary({ port })`) serves two path prefixes on one host and port: allowed `/dk-canary/allowed/` and denied `/dk-canary/denied/`. Allowed responses carry marker `DK-CANARY-FETCHED`; denied responses carry `DK-CANARY-DENIED-FETCHED`. It logs every request path (the request log).
- Paths under each prefix: `probe` (reachability probe), `include/<fixture>` (renders), and on the allowed side `redirect/<fixture>`, which answers `302 Location: <base>/dk-canary/denied/redirected/<fixture>` (edge case 8).
- Port: `--canary-port <n>`. Default for declared modes is `18091` (fixed, so the service's allowlist can be written before it starts). In unset mode the port stays random (0) unless `--canary-port` is given, so a run that passes today cannot newly fail on a busy port.
- Canary entry: `http://<canary-host>:<canary-port>/dk-canary/allowed/`.
- Unset mode keeps `checkRemoteIncludesRefused` with the same signature, result shape and messages. Its fixtures now point at `<base>/dk-canary/allowed/include/<fixture>`; its reachability probe **keeps today's `<base>/reachability` path**, because a failed probe's message embeds the `execFile` argv including the URL (`plantuml-include-guard.mjs:154`, `assert-…mjs:52`), so moving it would change failure output (post-plan A4). Fixture include paths are never printed (`:178-180` print the fixture name only), so pass and fail output stay byte-identical, and a service that allowlists the guide's canary entry is caught in unset mode **only** when the check runs with the matching `--canary-host` and `--canary-port` (the "fail when the allowed path is fetched" cell); with a random port the allowed path is never in the service's allowlist (post-plan N6). The guide therefore always passes both flags.
- Declared modes run a new function, `checkDeclaredMode` in `src/scripts/plantuml-mode-check.mjs`, which renders the existing two fixtures (`include-url.puml`, `includeurl.puml`) against the allowed path, the denied path and the redirect path, then classifies (R11).
- Request log (NFR-001): any request outside the two prefixes fails a declared-mode run ("the canary received a request outside its two paths"). The check makes no request to any declared entry. Test (post-plan N5): a declared entry points at a second local server that must log zero requests; paired positive control: a fake service that requests `/dk-canary/stray` makes the run fail with the stray-request message.
- Golden output (FR-007, post-plan N4): before any code change, in a separate earlier commit, capture today's CLI stdout, stderr and exit code for **pass and fail** cases: refuse (no container), refuse (container, fake `docker`), fetch (fail), canary unreachable (probe fails), control render fails. Files: `src/tests/fixtures/plantuml-include-check/golden-unset-<case>.{stdout,stderr,exit}`. Only the fake server's and canary's ports are normalized. A second assertion runs the same cases with `--canary-port <free port>` and requires identical output (the new flag does not alter unset output).

**Rationale.** Keeping the unset function and its output, while moving its URLs onto the allowed path, satisfies FR-007 and makes the unset × allowlist cell detectable. Reusing the two fixtures avoids touching the fixture directory that `plantuml-include-guard.test.ts:77` pins.

**Alternatives**
- Two canaries on two ports: rejected; the allowed/denied difference would then be a port difference, which a prefix entry also expresses, but the CI lane would need two fixed ports.
- Rewriting unset mode onto `checkDeclaredMode`: rejected; it changes the printed lines (two paths per fixture), breaking FR-007.
- Fixed port in unset mode by default: rejected (a busy port would fail a run that passes today).

## R4. Reading the service configuration (FR-004c)

**Decision**
- Read with `docker inspect -f '{{json .Config.Env}}' <container>`; parse the `KEY=VALUE` array in a pure function (`parseContainerEnv`).
- Fail closed when `JAVA_OPTS`, `JAVA_OPTIONS`, `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS` or `CATALINA_OPTS` carry a `-D` property named `plantuml.*`/`PLANTUML_*` in any case or separator (PlantUML's `SecurityUtils.getenv` prefers `System.getProperty("PLANTUML_SECURITY_PROFILE")` over the env var — verified in the pinned jar during the WP06 review), or when any env key is named `plantuml.*` (configuration the check cannot read reliably): "configured through Java system properties; the check reads only PLANTUML_SECURITY_PROFILE and PLANTUML_ALLOWLIST_URL".
- `PLANTUML_SECURITY_PROFILE` must equal `ALLOWLIST` exactly.
- Read the two `PLANTUML_*` keys **by name**; the inspect array also holds runner-injected variables (`GITHUB_ACTIONS`, `CI`) and the image's own env, and its order varies between containers (spike Q6).
- **Empty items fail** (spike F2, decision `01M6F4BVDASAREW2NVH23727CW`): on the pinned image an empty item that is not trailing allows **every** URL (`cleanPath("")` is `""`, and every URL starts with it). The configuration half fails on any empty item other than one trailing `;` with "the service's PLANTUML_ALLOWLIST_URL has an empty entry, which allows every URL". One trailing `;` is accepted (Java's `split(";")` drops it).
- Equality of entries: split `PLANTUML_ALLOWLIST_URL` on `;`, then (after the empty-item rule) no trimming, no trailing-slash or case normalization; compare as **sets** (order-insensitive, duplicates ignored) against declared entries plus the canary entry. The message names `extra` and `missing` entries and prints the expected `PLANTUML_ALLOWLIST_URL` value.
- Tests use a fake `docker` executable on `PATH` (a Node script under `src/tests/fixtures/plantuml-fake-docker/`) that accepts **only** the exact argv forms the check uses, `inspect -f {{json .Config.Env}} <c>` and `exec <c> curl -sf --max-time 5 -o /dev/null <url>`, and exits non-zero with the argv on stderr for anything else (post-plan N2). Its `inspect` answer is a recorded real `docker inspect` capture from the IC-01 spike, committed as a fixture, with test-specific env edits applied on top. A "docker missing" case (no `docker` on `PATH`) and a "docker errors" case (fake exits 1) must both fail allowlist mode with exit 1.

**Rationale.** `docker inspect` needs no binary inside the image (`printenv` would), works with the GitHub service id the lane already uses, and reads exactly what the container was created with. Raw string comparison matches PlantUML's raw prefix match: `…/x` and `…/x/` allow different URLs, so normalizing would hide a real difference. Order carries no meaning for a prefix list.

**Alternatives**
- `docker exec <c> printenv …`: rejected (depends on the image's userland; a second exec path).
- Ordered comparison: rejected (false failures without a security difference).
- Trimming items: rejected. The spike showed PlantUML **does** trim, lowercase and drop `:80/` / `:443/` (`SURL.cleanPath`), so a raw comparison is stricter than PlantUML: a whitespace, case or default-port difference fails the check although the service would match. This is kept on purpose (fails safe, and the operator sees the expected value); the guide says the service's entries must be written exactly as declared.
- Drop all empty items (the original rule): rejected after spike F2, because it would let the configuration half pass a service whose empty item allows everything.

## R5. CI lane, the spike, and `ci-ok`

**Decision**
- New job `plantuml-allowlist` in `ci.yml` (the existing build-example job and its SANDBOX service stay as they are, C-001). It `needs: detect-changes` only and runs on every CI run unless the PR is paused (`if: needs.detect-changes.outputs.paused != 'true'`), so it is never path-filtered (FR-012) and SC-004 ("every CI run") holds. It does no `pnpm install` (the check is built-ins only, env path), so it fits NFR-002 easily.
- Service block (identical to the guide's allowlist block except the declared entry):

  ```yaml
  services:
    plantuml:
      image: plantuml/plantuml-server:jetty-v1.2026.9@sha256:065c66adc6728ba6dd353a29d4ada73f8358b68549a0f710c4bf46b43c103618
      ports:
        - 8091:8080
      options: --add-host dk-canary:host-gateway
      env:
        PLANTUML_SECURITY_PROFILE: ALLOWLIST
        PLANTUML_ALLOWLIST_URL: "http://dk-canary:18091/dk-declared/;http://dk-canary:18091/dk-canary/allowed/"
  ```

  The declared entry `http://dk-canary:18091/dk-declared/` points at the canary host, so the allowlist holds only canary-host entries (NFR-001), and the check never requests it.
- Job guard: `if: needs.detect-changes.outputs.paused != 'true'`, exactly. `timeout-minutes: 5` bounds it (NFR-002).
- Step: wait for the server (same loop as build-example), then
  `DK_PLANTUML_ALLOW_EXTERNAL=http://dk-canary:18091/dk-declared/ node src/scripts/assert-plantuml-no-remote-include.mjs --server http://localhost:8091/svg/ --canary-host dk-canary --canary-port 18091 --service-container "${{ job.services.plantuml.id }}" | tee check.log`, then `grep -F 'verdict: declared allowlist, observed allowlist' check.log`, so a lane that silently ran the unset path cannot pass (post-plan N1). The step runs with `set -o pipefail`.
- `--add-host dk-canary:host-gateway` gives the container a static name for the runner, so the allowlist is static YAML written before the service starts. The gateway IP (`ci.yml:260`) is only known after start, which is too late for `services.env`.
- `ci-ok`: add `plantuml-allowlist` to `needs`, thread `PLANTUML_ALLOWLIST_RESULT`, add the lane to `REQUIRED_LANES` in `.github/scripts/ci-ok-decision.mjs` and its `node:test` suite. Update the lane count in the `ci.yml` header comment, `docs/architecture/ci-cd-pipeline.md` and `docs/ops/ci-cd.md` where they list lanes.
- **Spike (first concern).** On a throwaway branch with a workflow triggered by `push` to that branch (`workflow_dispatch` only runs workflows present on the default branch, post-plan A5) on `ubuntu-latest`, plus a local Docker run, prove: (1) `options: --add-host dk-canary:host-gateway` is accepted for a service and `docker exec <id> curl http://dk-canary:18091/…` reaches a Node server on the runner; (2) under ALLOWLIST the allowed prefix is fetched and the denied prefix refused; (3) what happens to a 302 from the allowed prefix to the denied prefix; (4) whether `!import <url>` and `!includesub <url>!X` fetch under ALLOWLIST/INTERNET; (5) whether PlantUML trims entries or accepts a trailing `;`; (6) the shape of `docker inspect .Config.Env`, captured to a file and committed as the fake-docker fixture (N2); (7) wall time. Results go into this file as an addendum.
- **Fallbacks.** (a) If `host-gateway` fails: start the service with `docker run` in a step (the allowlist can then use the job network's gateway IP), and extend the FR-014 inventory test to parse that step. (b) If PlantUML follows the redirect to the denied prefix under ALLOWLIST: that is a real hole, and edge case 8 then makes the real lane fail by design. (c) If neither (a) works nor the lane can pass for reason (b): **stop and return to the operator** (spec Assumption 3); do not drop the real-service lane.

**Rationale.** A separate job keeps C-001 literal and runs in parallel (NFR-002). Running it unconditionally costs about a minute and removes the path-filter question entirely.

**Alternatives**
- A second service in build-example: rejected (modifies the existing sandboxed lane, C-001; serializes with a long build).
- Gating on `run_build_example`: would satisfy FR-012 but not SC-004's "every CI run".
- Gateway IP in the allowlist: impossible to write statically before service start.

## R6. FR-014: hardening covers every service

**Decision (revised after the post-plan squad: R3, N1, A8).** A new test file `src/tests/plantuml-workflow-services.test.ts`, scoped to workflow structure only. The existing `plantuml-service-hardening.test.ts` is not modified (SC-003); its pinned-image regex and block parser are **copied**, not imported or edited. It:
- globs every file in `.github/workflows/`, finds every service block whose `image:` is `plantuml/plantuml-server…` (not only a key named `plantuml`, not only the first), and fails on any `docker run … plantuml-server` outside a service block (unless fallback (a) of R5 is taken, in which case that one step is parsed and held to the same rules);
- requires `PLANTUML_SECURITY_PROFILE: SANDBOX` on every service except the one in job `plantuml-allowlist` of `ci.yml`, which must be `ALLOWLIST` (never `INTERNET`), carry the shared pin, and whose `PLANTUML_ALLOWLIST_URL` entries all start with `http://dk-canary:` (NFR-001, static half);
- lane vacuity (N1): the job's `if:` is exactly `needs.detect-changes.outputs.paused != 'true'`; its check step contains `DK_PLANTUML_ALLOW_EXTERNAL=`, `--canary-port 18091`, `--canary-host dk-canary`, `--service-container "${{ job.services.plantuml.id }}"` and the `verdict: declared allowlist, observed allowlist` grep; `ci-ok` `needs` lists `plantuml-allowlist` and threads `PLANTUML_ALLOWLIST_RESULT`; `REQUIRED_LANES` contains it;
- requires that no workflow sets `INTERNET` and none contains `plantuml.com` (C-004).

Prose assertions (the guide's allowlist block equals the lane's service block after replacing the declared entry; the recommended SANDBOX block equals a committed copy; the guide states the D4 limit; ADR-0074 and changelog content) live in `src/tests/plantuml-opt-in-docs.test.ts`, owned by IC-10 (A8). Each checks existence plus a few required substrings, not prose wording (R3).

**Alternatives.** Editing the existing hardening test in place: rejected for SC-003. One file for workflows and prose: rejected (unrelated failure reasons in one file).

## R7. Unset mode under the new code

**Decision (amended by decision `01M6F4XFDPJ6XFBYM5HM65G1AM`).** The CLI routes on the resolution: `mode === 'sandbox'` calls the unchanged unset path with unchanged printing. With `--service-container`, after that check passes and before the OK line, the profile is read and must be `SANDBOX` (absent counts as the image default `INTERNET`); a pass prints nothing new, a mismatch fails with a new message. This closes the "real internet-mode service looks sandboxed" gap (spike F1) for runs that name the container. No new line is printed in unset mode on pass, and today's failure outputs are unchanged; a misconfigured service named by `--service-container` gains a failure (profile not `SANDBOX`, Java system-property configuration, or a `docker inspect` error, all fail closed). New flags (`--canary-port`, `--astro-config`, `--print-declared`) are optional and default to today's behaviour. Edge case 7 in unset mode stays a note (today's `:67-69`), not a failure.

## R8. `!import` and archive forms (squad finding 22)

**Decision.** Decided by the spike (R5 item 4). If the pinned image fetches `!import <url>` or `!includesub <url>!X` under ALLOWLIST or INTERNET, add those as fixtures in a **new** directory `src/scripts/fixtures/plantuml-remote-include-modes/` read only by the declared-mode check, and open a follow-up issue for the unset path (whose fixture directory is pinned by `plantuml-include-guard.test.ts:77`, and FR-007 freezes its output). If the image does not fetch them, record that and add nothing.

**Rationale.** Without the spike result a fixture would be guesswork; the pinned directory cannot grow inside this mission without breaking SC-003.

## R9. ADR, architecture pointer, changelog fragment

**Decision**
- ADR: `docs/adr/0074-plantuml-external-include-opt-in.md` (0073 is the highest on the branch and on `origin/main`; no open PRs). Status Accepted. Content asserted by a test (FR-009 "content asserted"): sandbox stays the default; the three values; environment wins (a new rule, not a `DK_PLANTUML_SERVER_URL` precedent); what the check proves and cannot prove (every spec Limit, including the `--astro-config` limit and the D4 limit: allowlist and internet modes need `docker inspect`, so Kubernetes, plain-jar and remote services cannot pass either; why the `plantuml-allowlist` lane is unconditional (SC-004 "every CI run"; an exception to path-scoped CI, ADR-0007); unset mode with `--service-container` requires `SANDBOX` (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`); an operator-asserted `--service-allowlist-url` is a follow-up, decision `01M6F21EKGBG5HF8XA2YFC517K`); the deferred option of failing a build whose internet mode comes only from the environment (squad finding 15). The index row is left to the bot.
- `docs/architecture/diagrams.md`: the "pinned and sandboxed" bullet gains one sentence naming the opt-in and linking ADR-0074 and the new guide subsection.
- Changelog: `docs/changelog/unreleased/268-plantuml-external-include-opt-in.md`, `section: Added`, one bullet naming `plantumlAllowExternal` / `DK_PLANTUML_ALLOW_EXTERNAL`, the three values, and that the default is unchanged; links written repo-root relative. Content asserted by a test (FR-010).

## R10. The build notice (FR-003)

**Decision.** `defineDocKittyIntegrations` prints the notice with `console.warn` (stderr) once per config evaluation, prefixed `[dk-plantuml]`, using `describeDeclared` from the shared module. Allowlist: `[dk-plantuml] declared PlantUML allowlist mode (from <source>): <entries>. The build cannot see the service; verify it with: dockitty-assert-plantuml-no-remote-include --astro-config <path> --server <url> --canary-host <host> --canary-port 18091 --service-container <container>`, with `<path>` filled in when the config path is known (decision `01M6F21BY4VJVWE4VY889F80CP`). Internet mode prints the same command after its warning. Internet: `[dk-plantuml] WARNING: declared PlantUML internet mode (from <source>): the service may fetch any URL, including internal networks and cloud metadata endpoints.` When `diagrams` is off, the line adds `(diagrams are off, so nothing is rendered)`. Unset prints nothing.

**Rationale.** Precedent: `config.ts:393` prints a `[dk-config]` warning at definition time. Printing in `diagramsIntegration`'s hook would miss sites with `diagrams: false` and would need the constant integration to become a factory (a public export change).

**Alternatives.** An Astro `logger` call in a hook (needs an always-present integration; more surface); a hard build failure for an env-only internet mode (deferred, finding 15).

## R11. Observed mode class and verdict

**Decision (revised, post-plan R1; revised again after the spike, F1, F3, F4).** Three classes only, as the spec defines them. When `--service-container` is given, the **observed class is the profile** read with `docker inspect` (`SANDBOX` → sandbox, `ALLOWLIST` → allowlist, `INTERNET` → internet); the canary supplies the second, **behavioural** half for sandbox and allowlist modes and must agree with it in allowlist mode. A real INTERNET service refuses the canary (F1), so the canary never classifies internet mode. Per fixture, "fetched" for a path means the request log has **at least one** hit under that path's `include/` prefix (PlantUML requests each included URL twice, F4; never count exact hits), and a hit counts even if the render then errors. The redirect is judged only from the log (a hit under `/dk-canary/denied/redirected/`), never from the render's HTTP status: a refused redirect renders as HTTP 200 with an empty diagram (F3). allowed no / denied no = sandbox; allowed yes / denied no = allowlist; both yes = internet. Anything else (denied fetched while allowed refused, or the two fixtures disagreeing) is not a class: `observed` is `null` and the verdict fails with reason `inconsistent fetches`, naming each fixture's per-path result. The verdict table is in [data-model.md](./data-model.md).

**Alternatives.** A fourth `inconsistent` class: rejected, the spec has three.

## R12. Internet mode and the container

**Decision (revised after spike F1; decision `01M6F4BRKQ4E9H9Z41BYZH37MC`).** The pinned image in INTERNET mode refuses any URL whose host is dotless, an IP literal or an inner address, and any non-default port, unless the URL is allowlisted, so it never fetches the runner-local canary. Internet mode is therefore verified by the configuration: `--service-container` is **required**, and `PLANTUML_SECURITY_PROFILE` read with `docker inspect` must equal `INTERNET`. Without the container the check fails: "declared internet needs --service-container to read the service's security profile". The canary renders and probes still run and are printed, but they are informational and do not enter the verdict. The superseded design (fetches of both canary paths prove internet mode) would have failed every real internet-mode service.

## R13. Test design for the halves, NFR-001, ports and parity (post-plan N3, N5, N6, N8)

**Decision**
- **Half-removal proofs (N3; revised after the spike and the post-tasks split)**: one table-driven test in `plantuml-include-check-halves.test.ts` (WP12). Each row differs from a passing baseline in exactly one half: FR-004 (a) allowed path refused; (b) denied-path reachability probe fails; (c1) profile not `ALLOWLIST`; (c2) one extra entry; (c3) one missing entry; (c4) an empty item in the service's allowlist (D6); FR-006 (i) no `--service-container`, (ii) profile not `INTERNET` (D5). Each row asserts exit 1, its own message substring, and the **absence** of every other row's substring. A comment block at the top of the table records the manual mutation pass (which code was removed, which row turned red).
- **NFR-001 (N5)**: see R3, "Request log".
- **Ports (N6)**: every test that starts a canary passes a free `--canary-port` (bind port 0, read it, release it), never 18091, so parallel Vitest workers cannot collide.
- **Parity proof (N8)**: the fixture site's `astro.config.mjs` calls the real `defineDocKittyIntegrations` from `src/lib/config.ts` and sets `indexBasename: ['PARITY']`. The check side runs `--astro-config <fixture> --print-declared`; the build side evaluates the same file through `evaluateSiteConfig`. Both must report the same `{mode, entries, source}`, and the child's answer must carry `names: ['PARITY']`, which only `defineDocKittyIntegrations` publishes (`config.ts:542`), so a stubbed or skipped build side cannot pass. The notice text is asserted from captured stderr for the non-sandbox cells, and asserted absent for the sandbox cells (US4 AS3).

## Dependencies

None added. Node built-ins only in the resolver and the check; the CI lane adds no action and reuses the pinned image digest. DIRECTIVE_051 supply-chain review therefore has nothing to assess.

## Spike addendum (IC-01, WP01)

Run by the orchestrator on 2026-11-02 on the throwaway branch `spike/268-allowlist-lane` (push trigger, two pushes, branch deleted afterwards), plus a local Docker check for the questions the runner cannot answer without real outbound traffic.

- Run 1: https://github.com/spec-kitty/doc-kitty/actions/runs/41532111136 (R5 block, INTERNET / leading-space / trailing-`;` legs, fallback (a) job). Its reachability probes used a synchronous `exec` that blocked the in-process canary, so `curl` timed out (exit 28) although the canary logged both probe requests; fixed in run 2.
- Run 2 (last run): https://github.com/spec-kitty/doc-kitty/actions/runs/41532432345 (R5 block; INTERNET on :18091 and :80; ALLOWLIST on :80; leading space; trailing `;`). The `allowlist` job is https://github.com/spec-kitty/doc-kitty/actions/runs/41532432345/job/125575764369.
- Evidence under [`spike/`](./spike/): `spike-workflow.yml` (the final workflow), `spike-driver.mjs` (the canary and render driver it ran), `inspect-capture.json` (artifact `spike-allowlist` of run 2), `results-allowlist-run2.json`, `ci-log-excerpts.txt` (per-job excerpts with job URLs), `local-evidence.txt` (local Docker runs and the `javap` bytecode of PlantUML's URL checks).

### Answers

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | `--add-host dk-canary:host-gateway` on a `services:` container; canary on the runner reachable on :18091 | **Yes.** The runner passes the option to `docker create`; the container's `/etc/hosts` has `172.17.0.1 dk-canary`; both `docker exec <id> curl -sf --max-time 5` probes exit 0 and the canary logs them. | run 2 `allowlist`: `docker create … --add-host dk-canary:host-gateway …`, `172.17.0.1	dk-canary`, `[probe] allowed: ok=true code=0 canaryLogSoFar=["/dk-canary/allowed/probe"]`, `[probe] denied: ok=true code=0 …"/dk-canary/denied/probe"]` |
| 2 | ALLOWLIST: allowed prefix fetched, denied prefix refused | **Yes**, for `!include` and `!includeurl`. Allowed: HTTP 200, marker present, canary hit. Denied: HTTP 400, `X-PlantUML-Diagram-Error: Cannot open URL`, zero canary hits. | run 2 `allowlist`: `[render] include-allowed: {"status":200,…"allowedMarker":true,…"canaryHits":["/dk-canary/allowed/include/x","/dk-canary/allowed/include/x"]}`; `[render] include-denied: {"status":400,"diagramError":"Cannot open URL",…"canaryHits":[]}`; same for `includeurl-*` |
| 3 | 302 from the allowed prefix to the denied prefix (edge case 8) | **Not followed** under ALLOWLIST (on :18091 and :80). The canary logs `/dk-canary/allowed/redirect/x` (twice) and never `/dk-canary/denied/redirected/x`. The render is **HTTP 200 with no `X-PlantUML-Diagram-Error`**: an empty diagram (PlantUML's "Welcome" page), not an error. Under INTERNET the question cannot be asked with a local canary (finding F1). No hole: fallback (b) does not apply. | run 2 `allowlist`: `[render] redirect-include: {"status":200,"diagramError":null,"allowedMarker":false,"deniedMarker":false,"canaryHits":["/dk-canary/allowed/redirect/x","/dk-canary/allowed/redirect/x"],…"text":"<empty diagram>"}`; full canary log has no `denied/redirected` entry; same in `allowlist-80` |
| 4 | `!import <url>` and `!includesub <url>!X` under ALLOWLIST / INTERNET | **Neither fetches** under any profile tried. `!import <url>.zip`: HTTP 400 `Cannot import`, zero canary hits (ALLOWLIST; INTERNET with the URL allowlisted, run 1; INTERNET without, run 2). `!includesub <url>!PART`: HTTP 400 `Fatal parsing error`, zero hits, same profiles. | run 2 `allowlist`: `[render] import-allowed: {"status":400,"diagramError":"Cannot import",…"canaryHits":[]}`, `[render] includesub-allowed: {"status":400,"diagramError":"Fatal parsing error",…"canaryHits":[]}`; run 1 `variants (internet …)` same |
| 5a | Does PlantUML trim allowlist entries? | **Yes.** `PLANTUML_ALLOWLIST_URL=" http://dk-canary:18091/dk-canary/allowed/"` (leading space) still fetches the allowed include and refuses the denied one. The bytecode shows why: `SURL.cleanPath` applies `trim()`, `toLowerCase(Locale.US)` and removes `:80/` and `:443/`, to both the URL and each entry. | run 2 `leading-space`: inspect shows `"PLANTUML_ALLOWLIST_URL= http://dk-canary:18091/dk-canary/allowed/"`, then `[render] include-allowed: {"status":200,…"allowedMarker":true…}`; `local-evidence.txt` L3 `cleanPath` |
| 5b | Trailing `;` accepted? | **Yes.** The service starts and behaves exactly like the entry without `;` (Java `String.split(";")` drops trailing empty strings). | run 2 `trailing-semicolon`: `"PLANTUML_ALLOWLIST_URL=http://dk-canary:18091/dk-canary/allowed/;"`, allowed 200 + marker, denied 400 + no hits |
| 6 | Shape of `docker inspect -f '{{json .Config.Env}}' <service-id>` | A JSON array of `KEY=VALUE` strings: the service's `env:` entries, **`GITHUB_ACTIONS=true` and `CI=true` injected by the runner**, then the image's own env (`PATH`, `JAVA_HOME=/opt/java/openjdk`, `JETTY_*`, `WEBAPP_PATH`, …). The **order differs between jobs** (in run 2, `PLANTUML_ALLOWLIST_URL` comes first in the `allowlist` and `trailing-semicolon` captures and `PLANTUML_SECURITY_PROFILE` first in `internet-18091` and `leading-space`; the injected `GITHUB_ACTIONS` / `CI` move too), so readers must not depend on position. No secrets: GitHub injects none into service env. | `spike/inspect-capture.json` (verbatim, artifact of run 2 job `allowlist`); per-job inspect lines in `ci-log-excerpts.txt` |
| 7 | Wall time (NFR-002, ≤ 5 min; flag > 3 min) | **38 s** for the whole `allowlist` job in run 2 (21:53:32Z → 21:54:10Z; 42 s in run 1). Job set-up to PlantUML ready: 16 s, of which 13 s is "Initialize containers" (image pull + start). The readiness loop passed on its first try; the spike step took 1 s. Well under the 3-minute flag. | run 2 job API timings: `Initialize containers: 21:53:47Z -> 21:54:00Z`, `Wait for the PlantUML server: 21:54:02Z -> 21:54:02Z`; log `PlantUML ready after 2s from first step` |

Fallback (a) was also exercised in run 1 (job `fallback-a`, service started with `docker run --add-host dk-canary:host-gateway` in a step): it behaves the same as the service block. It is not needed.

### Service block that worked (WP08 writes exactly this)

```yaml
services:
  plantuml:
    image: plantuml/plantuml-server:jetty-v1.2026.9@sha256:065c66adc6728ba6dd353a29d4ada73f8358b68549a0f710c4bf46b43c103618
    ports:
      - 8091:8080
    options: --add-host dk-canary:host-gateway
    env:
      PLANTUML_SECURITY_PROFILE: ALLOWLIST
      PLANTUML_ALLOWLIST_URL: "http://dk-canary:18091/dk-declared/;http://dk-canary:18091/dk-canary/allowed/"
```

The canary must listen on `0.0.0.0:18091` on the runner (the spike driver did; the service reaches it at the default bridge gateway `172.17.0.1`).

### Decision

**GO**: R5 as designed (the `services:` block with `options: --add-host dk-canary:host-gateway`).

### R8 outcome

`!import <url>` and `!includesub <url>!X` fetch under **no** profile on the pinned image: **no fixture needed**; WP11 T031 adds nothing to `src/scripts/fixtures/plantuml-remote-include-modes/` and no follow-up issue is needed for the unset path.

### Trimming outcome

PlantUML **trims** entries (and lowercases them and strips `:80/` / `:443/`). Per R4 the check's comparison stays raw: a whitespace or case difference between the declared entries and the service's value fails loudly, even though PlantUML would treat them as equal.

### Findings for the orchestrator (not decided here)

These came out of the spike and the bytecode it led to. They do not change the GO for the lane; they bear on other WPs and need a routing decision.

- **F1 (needs an operator decision; affects FR-006 internet, R11, R12, WP06, WP11).** Under `INTERNET`, the pinned image refuses **any** URL whose host has no dot, is an IP literal, or resolves to an inner address (loopback, any-local, and the other inner ranges `URLCheck.isInnerAddress` tests), and any port other than 80 / 443 / default, **unless** the URL is in `PLANTUML_ALLOWLIST_URL`, which is checked first (`SURL.isUrlOk`). A runner-local `dk-canary` (dotless, `172.17.0.1`, :18091) therefore can never be fetched by a real INTERNET service: run 2 `internet-18091` and `internet-80` show both paths refused (`Cannot open URL`, zero canary hits) although both probes reach the canary, and local L1 shows the same with no port and with :80. Consequences: (i) a correctly configured internet-mode service is observed as **sandbox** by the canary, so the "declared internet, observed internet" cell can never pass against the real image; (ii) an INTERNET service whose allowlist holds the canary entry is observed as **allowlist**; only the configuration half (profile must equal `ALLOWLIST`) tells them apart. The tests planned with fake services would pass while the real check always fails in internet mode.
- **F2 (security; affects R4, WP06).** An **empty entry that is not trailing** (`;http://…` or `a;;b`) allows **every** URL under ALLOWLIST: `cleanPath("")` is `""` and every URL `startsWith("")`. Local L2: with `PLANTUML_ALLOWLIST_URL=;http://dk-canary:8000/dk-canary/allowed/` the denied include is fetched (HTTP 200, `DK-CANARY-DENIED-FETCHED`). R4's "drop empty items" would let the configuration half pass such a service (the behavioural half still catches it, because the denied path is fetched). Recommended: the configuration half fails on any empty item other than one trailing `;`.
- **F3 (affects R11 and the classifier, WP06).** A redirect render under ALLOWLIST is **HTTP 200 with no diagram-error header** (an empty diagram), not an error. Classify the redirect cell on the request log (no `/dk-canary/denied/redirected/` hit) and never on the HTTP status.
- **F4.** PlantUML requests each included URL **twice** per render (every fetched path appears twice in the canary log). A classifier that tests "at least one hit" is unaffected; one that counts hits must not expect exactly one.
- **F5.** Entries and URLs containing `@` never match the allowlist (`isInUrlAllowList` returns false on `@`). Worth one line in the guide.

Clean-up (T006): last run https://github.com/spec-kitty/doc-kitty/actions/runs/41532432345; `spike/268-allowlist-lane` deleted locally and on `origin`, and `git ls-remote --heads origin spike/268-allowlist-lane` prints nothing. No workflow under `.github/workflows/` changed on the mission branch.
