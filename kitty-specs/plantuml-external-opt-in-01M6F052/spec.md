# Mission Specification: PlantUML external-connection opt-in

**Mission Branch**: `feat/268-plantuml-external-opt-in`
**Created**: 2026-11-02
**Revised**: 2026-11-02 (post-spec adversarial squad; dispositions in [squad/post-spec.md](./squad/post-spec.md)); 2026-11-02 (CI spike findings F1–F5, decisions `01M6F4BRKQ4E9H9Z41BYZH37MC` and `01M6F4BVDASAREW2NVH23727CW`; dispositions in [squad/post-tasks.md](./squad/post-tasks.md) "Spike findings")
**Status**: Draft
**Input**: Issue spec-kitty/doc-kitty#268, "Operator opt-in to let PlantUML diagrams make external connections (default stays SANDBOX)", plus the operator's discovery answer on verification depth (decision `01M6F05V604SFYSZ9235CRH536`).

## Intent Summary (confirmed 2026-11-02)

A site operator whose diagrams need a remote include (an organisation-hosted style, a shared macro library served over HTTP) sets one explicit opt-in. The build then says loudly which hosts were declared, and the include check proves that the running PlantUML service is in the declared mode, and, when it can read the service's configuration, that the service allows exactly the declared entries. A site that does not set the opt-in sees no change at all.

- **Primary actor**: the operator of a site built with the toolkit, who runs their own PlantUML render service.
- **Trigger**: a diagram that includes remote content by URL (`!include <url>`, `!includeurl`) and today fails the build, because the hardened service refuses it.
- **Desired outcome**: the remote include renders for entries the operator declared, and nothing else changes.
- **Invariant**: the setting and the running service must agree. A detectable disagreement fails the include check, and the check never silently skips a half of its proof.
- **Boundary**: the toolkit never changes the service's security mode. The operator runs the service; the toolkit declares the intended mode and verifies it.

Background: #256 (closing #251) hardened the PlantUML service, so every service block runs with the `SANDBOX` security profile and URL includes fail the build. `dockitty-assert-plantuml-no-remote-include` proves the refusal in CI. That decision is recorded in `docs/architecture/diagrams.md` ("The PlantUML service is pinned and sandboxed"); no ADR records it. The operator ruled on 2026-11-01 that SANDBOX plus that check is the accepted default, and that external connections become an explicit operator opt-in.

Note: PlantUML's bundled standard library (`!include <C4/C4_Container>` and other `<...>` forms) is not fetched over the network and already renders under sandbox mode (verified against the pinned image during the post-spec squad). Sites that only use the bundled C4 library do not need this opt-in.

## Domain Language

| Term | Meaning | Avoid |
|------|---------|-------|
| **opt-in setting** | The one site-level setting that declares the intended external-connection mode. | "flag" in user docs (it has three values, not two) |
| **sandbox mode** | The default: the service refuses all URL includes. PlantUML's `SANDBOX` profile. | "safe mode", "offline" |
| **allowlist mode** | The service may fetch URL includes only from the declared entries. PlantUML's `ALLOWLIST` profile. | "whitelist" |
| **internet mode** | The service may fetch any URL include. PlantUML's `INTERNET` profile. Always an explicit choice. | "open mode", "unrestricted" |
| **allowlist entry** | One URL prefix the service may fetch from. PlantUML matches entries as raw string prefixes. | "host" (an entry is a prefix, not a host name) |
| **include check** | `dockitty-assert-plantuml-no-remote-include`, which renders canary includes against the running service and compares what happened to what was declared. | "the guard" (ambiguous with the source guard `plantuml-guard.mjs`) |
| **canary** | The local HTTP endpoint the include check starts. Its content proves whether an include was fetched. It serves an **allowed path** and a **denied path**. | |
| **mode class** | Which of the three modes a service is in. When the service container is named, it is the security profile read from the container (`SANDBOX`, `ALLOWLIST`, `INTERNET`). The canary gives the behavioural class for sandbox and allowlist modes: refuses both paths (sandbox), fetches only the allowed path (allowlist). A real internet-mode service refuses the private canary (it never fetches dotless or inner-network hosts), so the canary cannot observe internet mode. | |
| **mismatch** | The service's observed mode class or configured entries do not match the declared setting. | |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Allow declared entries for remote includes (Priority: P1)

An operator's diagrams include a shared macro file from `https://styles.example.org/plantuml/`. They set the opt-in to an allowlist with that entry, configure their PlantUML service in allowlist mode as the guide shows (the declared entry plus the canary's allowed path, for the environment where the check runs), and build. The diagrams render; the build output names the declared entry.

**Why this priority**: the consumer need behind spec-kitty/spec-kitty#6100 and #6916, and the narrow mode is the one the issue prefers.

**Independent Test**: with only this story delivered, the include check passes against a service configured as the guide shows, and the build prints the notice.

**Acceptance Scenarios**:

1. **Given** the opt-in declares entry A, **When** the site builds, **Then** the build prints a notice naming entry A and where the value came from (site configuration or environment).
2. **Given** the opt-in declares entry A and the service runs in allowlist mode with entry A plus the canary's allowed path, **When** the include check runs with the service container named, **Then** it proves the canary's allowed path was fetched, proves the denied path was refused (with its own reachability probe), reads the service's configured entries, finds them equal to the declared entries plus the canary entry, and passes.
3. **Given** the same setup, **When** the include check runs without naming the service container, **Then** it fails, saying that allowlist mode needs the container to prove the denied path was reachable and the entries match.
4. **Given** the opt-in declares entry A, **When** a diagram includes from a URL outside entry A, **Then** the service refuses it and the build fails, as it does today for any refused include.

---

### User Story 2 - Catch a setting that does not match the service (Priority: P1)

An operator sets the opt-in, but their service is still in sandbox mode, or was switched to internet mode, or allows an extra entry. Or they removed the setting but left the service open. The include check fails and says what was declared and what was observed. For the "removed the setting" case the check needs either `--service-container` (it then reads the profile, which must be `SANDBOX`; decision `01M6F4XFDPJ6XFBYM5HM65G1AM`) or, for a service still allowlisting the canary entry, `--canary-host dk-canary --canary-port 18091` (with a random canary port the canary is never on the service's allowlist).

**Why this priority**: the opt-in is only safe if it is verifiable. A silent mismatch is exactly the failure #256 set out to prevent.

**Independent Test**: run the include check (the real command, not only its library function) against a service whose behaviour or configuration differs from the declared mode, for each case in the mismatch matrix below, and see it fail with a message naming both sides.

**Acceptance Scenarios** (the mismatch matrix; rows are the declared setting, columns the observed service):

| Declared \ Observed | Sandbox | Allowlist | Internet |
|---|---|---|---|
| **Unset** | pass, output unchanged from today | fail — see note U-A | fail with `--service-container`; otherwise undetectable for the real image — see note U-I |
| **Allowlist** | fail: "declared allowlist, but the allowed path was refused" | pass only if, with the container named, configured entries equal declared + canary entry; extra, missing or empty entries fail, naming them | fail: the service's profile is `INTERNET` (read from the container), even when its canary behaviour looks like allowlist; also "the denied path was fetched" if the canary sees it |
| **Internet** | fail: "declared internet, but the service's PLANTUML_SECURITY_PROFILE is \"SANDBOX\"" | fail: "declared internet, but the service's PLANTUML_SECURITY_PROFILE is \"ALLOWLIST\"" | pass only with the container named and its profile `INTERNET`, with a warning |

Columns are the service's mode class: the profile read from the named container (`PLANTUML_SECURITY_PROFILE`); without a container, the canary's behaviour (refuses both paths = sandbox, fetches only the allowed path = allowlist) for the unset row and, in allowlist mode, as the behavioural half.

Notes keyed to cells:

- **U-A (Unset × Allowlist)**: with `--service-container`, if the service allowlists the canary entry and the check runs with the matching `--canary-host` / `--canary-port`, the behavioural half fails first with today's message ("the server FETCHED the remote include"); if it does not (the service allowlists only other entries, or the canary port is random), the behavioural half passes and the profile read then fails: `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "ALLOWLIST"`. Without the container: fail (today's behaviour) when the allowed path is fetched; **undetectable** if the service allowlists only other entries — see Limits.
- **U-I (Unset × Internet)**: with `--service-container`, the profile read fails (also when the profile variable is absent: the image default is `INTERNET`). Without it: **undetectable** for the real image, which refuses the private canary; fakes that fetch still fail, as today — see Limits.
- In unset mode the profile read also fails closed on Java system-property configuration, exactly as in the declared modes, and on a `docker` error.

1. Each cell above is one acceptance scenario. Every failing cell's message contains the declared mode, the observed mode class, and the canary path, profile or entries that disagreed. In declared modes the observed class is the profile read from the named container; for allowlist mode the canary's behaviour must also match.
2. **Given** the opt-in declares internet mode, **When** the include check runs without naming the service container, **Then** it fails, saying that internet mode needs the container to read the service's security profile.

---

### User Story 3 - Opt into internet mode explicitly (Priority: P2)

An operator who cannot enumerate entries chooses internet mode, knowing the trade-off. The build warns on every run that the service may reach any URL, including internal networks, and the include check confirms, by reading the named container's security profile, that the service really is in internet mode.

**Why this priority**: allowed by the issue, but only as an explicit second value; the narrow mode comes first.

**Independent Test**: with the opt-in set to internet and a named service container whose profile is `INTERNET`, the include check passes and prints a warning; the build prints a warning.

**Acceptance Scenarios**:

1. **Given** the opt-in is internet mode and the named service container's `PLANTUML_SECURITY_PROFILE` is `INTERNET`, **When** the site builds and the include check runs with the container named, **Then** both pass, and each prints a warning that the service may reach any URL. The check's canary results are printed for information only: a real internet-mode service refuses the private canary.

---

### User Story 4 - Nothing changes for a site that does not opt in (Priority: P1)

An operator who never sets the opt-in upgrades the toolkit. For a correctly sandboxed service their include check output, the guide's recommended service block, and the toolkit's existing sandboxed CI lane behave exactly as before, and the build prints no new lines: no new line on pass. A misconfigured service named by `--service-container` (profile not `SANDBOX`) gains a failure (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`).

**Why this priority**: the issue's hardest rule. The default is the security boundary.

**Independent Test**: compare the include check's output for an unset opt-in against a committed golden copy of today's output (a correctly sandboxed service, profile `SANDBOX` when the container is named), and run the existing test suite unchanged.

**Acceptance Scenarios**:

1. **Given** no opt-in is set, **When** the include check runs against a sandboxed service, **Then** its output matches the committed golden output and it passes.
2. **Given** no opt-in is set and the same canary fixtures, **When** the include check runs against a service that fetches, **Then** it fails as today (the same-fixture positive control).
3. **Given** no opt-in is set, **When** the site builds, **Then** no new notice lines are printed.
4. **Given** no opt-in is set and the include check runs with `--service-container`, **When** the named service's `PLANTUML_SECURITY_PROFILE` is not `SANDBOX` (or absent, so the image default `INTERNET` applies), **Then** the check fails with a message naming the observed profile; when it is `SANDBOX`, the output is byte-identical to today's (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`).

### Edge Cases

Each is an acceptance scenario of FR-002, FR-004 or FR-013.

1. **Malformed value** (unknown mode word, an entry that is not an http(s) URL): the build and the include check both fail before rendering or probing, naming the setting, its source, and the accepted shapes.
2. **Empty allowlist**: invalid, never read as sandbox or internet; fails as in 1.
3. **Bare-host entry** (`http://host` with no `/` after the host or port): rejected, because PlantUML's raw prefix match would also allow `http://host.evil.com`. The message says to end the entry with `/`.
4. **Entry containing `;`**: rejected in a single entry, because `;` is PlantUML's separator.
5. **Empty environment value** (`DK_…=""`): treated as unset, so the site configuration (or the default) applies.
6. **Environment and site configuration disagree**: the environment value wins, and both the build notice and the include check output name the environment as the source.
7. **The canary cannot be reached from the service**: in allowlist mode the check fails (it cannot prove the refusal half); in internet mode it is informational only (printed, not judged); in unset mode it keeps today's behaviour (a note without a container; today's failure with one).
8. **Redirect**: an allowed canary path that redirects to the denied path must not result in a fetch of the denied content; the check fails if it does. The redirect outcome is read from the canary's request log, never from the render's HTTP status (the pinned image answers a refused redirect with HTTP 200 and an empty diagram).
9. **Entry containing `@`**: rejected, because PlantUML never matches an allowlist entry or URL containing `@`, so the entry could never work.
10. **Empty item in the service's allowlist**: a `PLANTUML_ALLOWLIST_URL` with an empty item other than one trailing `;` (`;http://…`, `a;;b`) allows every URL on the pinned image; the include check's configuration half fails on it. Declared values never contain empty items (edge case 2).

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | One opt-in setting | As an operator, I want one site setting, with a documented environment override, that declares the external-connection mode, so that there is one place to turn it on and off. Unset means sandbox mode. Both the build and the include check read the declared value through one shared resolver. | High | Open | build | no |
| FR-002 | Three accepted values, validated | As an operator, I want the setting to accept exactly: unset (sandbox), a non-empty list of allowlist entries, or an explicit internet value, and to reject the edge-case shapes 1–5 and 9, so that the open mode is never reached by accident and no entry leaks to lookalike hosts. | High | Open | build | no |
| FR-003 | Loud build notice | As an operator, I want the build to print a notice naming the declared entries (or a warning that the service may reach any URL) and the value's source, whenever the opt-in is set, so that the opening is never silent. The notice says "declared", because the build cannot see the service. | High | Open | build | no |
| FR-004 | Allowlist verification | As an operator, I want the include check, in allowlist mode, to pass only when (a) the canary's allowed path is fetched, (b) the canary's denied path is refused after its own reachability probe succeeded, and (c) the service's configured entries, read from the named service container, equal the declared entries plus the canary entry, with no empty item other than one trailing `;` (decision `01M6F4BVDASAREW2NVH23727CW`). Removing any of (a), (b), (c) from the implementation turns a test red. | High | Open | build | no |
| FR-005 | Mismatch fails, by the matrix | As an operator, I want the include check to give the verdict in every cell of the User Story 2 matrix, with a message containing the declared mode, the observed mode class, and the disagreeing paths or entries. | High | Open | build | no |
| FR-006 | Internet mode verification | As an operator, I want the include check, in internet mode, to confirm the service's security profile is `INTERNET`, read from the named service container, print a warning, and fail if the profile differs or no container is named. Canary results are printed for information, not judged (a real internet-mode service refuses the private canary; decision `01M6F4BRKQ4E9H9Z41BYZH37MC`). Removing either half (the container requirement, the profile comparison) turns a test red. | Medium | Open | build | no |
| FR-007 | Unset is unchanged | As an operator who does not opt in, I want the include check's output for a correctly sandboxed service to match a committed golden copy of today's output (when `--service-container` names a service whose profile is not `SANDBOX`, the check now fails instead; decision `01M6F4XFDPJ6XFBYM5HM65G1AM`), the build to print no new lines, the guide's recommended service block to stay byte-identical, and the existing sandboxed CI lane to stay unchanged. Same-fixture positive control: the existing refuse-versus-fetch pair on the unset path (User Story 4, scenario 2). | High | Open | ratchet | yes (same-fixture positive control named) |
| FR-008 | Consumer guide subsection | As an operator, I want an "Allowing external includes" subsection beside "Run the PlantUML service hardened" that gives the service block for allowlist mode (the same block the CI lane runs) and for internet mode; the `PLANTUML_ALLOWLIST_URL` variable and its `;` separator; the prefix rule and why entries end in `/`; the canary entry needed where the check runs; that the service's entries must be written exactly as declared (the check compares raw strings, although PlantUML itself trims, lowercases and drops `:80` / `:443`); that entries containing `@` never match; that internet mode, like allowlist mode, needs a container the check can inspect; that bundled `<C4/...>` includes need no opt-in; the trade-offs (requests reach those URLs, builds depend on them, allowlist and internet modes also relax local-file reads, internet mode can reach internal networks and cloud metadata endpoints, redirects); and how to turn it off. | High | Open | build | no |
| FR-009 | Decision record | As a maintainer, I want a new ADR (the next free number; the index row is left to the bot) stating that sandbox stays the default, that the opt-in exists with its three values, that the environment override wins (a new rule, not an existing precedent), and what the include check can and cannot prove; and `docs/architecture/diagrams.md` updated to point to it. | Medium | Open | build | no (content asserted: default unchanged, three values, limits) |
| FR-010 | Changelog fragment | As a consumer, I want a changelog fragment that names the setting, the three values, and that the default is unchanged. | Medium | Open | build | no (content asserted) |
| FR-011 | Matrix coverage, at the command | As a maintainer, I want tests that run the include check command itself (exit code and stable message substrings) for every cell of the User Story 2 matrix, using fake services, plus the edge cases 1–10. | High | Open | build | no |
| FR-012 | Real allowlist service in CI | As a maintainer, I want one CI lane that runs the real, digest-pinned PlantUML image in allowlist mode, configured with the guide's allowlist block with only the declared entry replaced by a canary-host entry, against the include check's canary; the lane is not path-filtered out of PRs that touch the check or the diagrams integration, and it feeds `ci-ok`. | High | Open | build | no |
| FR-013 | One resolution for build and check | As an operator, I want the build and the include check to resolve the identical declared value and source for the same site configuration and environment, so that the check verifies what the build declared. The check reads the site configuration only when given the site's config path (which needs the site's dependencies installed); without it, the check reads the environment only and its output says so. | High | Open | build | no |
| FR-014 | Hardening test covers every service | As a maintainer, I want the workflow hardening test to inspect every PlantUML service in every workflow (not only the first), to allow allowlist mode only on the named opt-in lane (digest-pinned, never internet mode), and to require sandbox mode everywhere else. | High | Open | build | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | No real outbound calls in CI | In every CI lane, including the new allowlist lane, the PlantUML service's configured allowlist contains only canary-host entries (`http://dk-canary:`), and the canary records 0 requests outside its two paths; the include check never requests a declared entry's URL. | Security | High | Open |
| NFR-002 | Bounded CI cost | The new allowlist lane runs in parallel with the existing lanes and completes in at most 5 minutes wall time. | Performance | Medium | Open |
| NFR-003 | One resolution, measured | For all 9 combinations of source (site configuration only, environment only, both) and value (unset, allowlist, internet), the build and the include check given the site's config path report the identical value and source: 9 of 9. Without the config path, the 6 environment-only and unset combinations match; on the declared (allowlist and internet) paths the check states that site configuration was not read, and on the unset path it prints no new lines (FR-007; decision `01M6F21BY4VJVWE4VY889F80CP`). | Reliability | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Default unchanged | Sandbox mode stays the default. The existing sandboxed CI lane and the guide's recommended service block are not modified. | Technical | High | Open |
| C-002 | Changelog by fragment | The changelog entry is a fragment under `docs/changelog/unreleased/`; `CHANGELOG.md` is never edited (ADR-0072). The issue's "A CHANGELOG entry is added" is read this way. | Technical | High | Open |
| C-003 | Declare and verify only | The toolkit never sets or changes the PlantUML service's security profile. It declares the intended mode and verifies the running service against it; reading the service's configuration is verification, not control. | Technical | High | Open |
| C-004 | No plantuml.com | The existing ban on plantuml.com as a render server (#13 C-001) still holds in every mode. | Technical | High | Open |
| C-005 | Digest-pinned image | The new CI lane uses the same digest-pinned PlantUML image as the existing hardened lane. | Technical | Medium | Open |
| C-006 | Check runs before install | The include check keeps running on Node built-ins only, before dependencies are installed, for the unset and environment paths, as the existing CI lane requires. Reading the site configuration needs the site's dependencies (decision `01M6F1VS8XWTR7A7KAC42ZWAE0`). | Technical | High | Open |

### Key Entities

- **Opt-in setting**: the declared mode. Values: unset (sandbox), allowlist (a non-empty list of entries, each an http(s) URL prefix ending in `/`), internet. Source: site configuration or environment override (environment wins; empty means unset).
- **Canary**: one local endpoint on a fixed, configurable port, serving an allowed path and a denied path; it records every request path.
- **Observed mode class**: sandbox, allowlist, or internet: the security profile read from the named container when available; for sandbox and allowlist modes, also the behavioural class from which canary paths were fetched.
- **Service configuration (optional)**: the service's security profile and allowlist entries, read from the named service container.
- **Include check verdict**: pass or fail, with the declared value and source, the observed mode class, and the reason for any mismatch.

## Limits (what the include check cannot prove)

- **Unset declared, no `--service-container`, service allowlisting other entries only**: the canary paths are not in that allowlist, so both are refused and the service looks sandboxed. The check passes. With `--service-container` the profile read catches it (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`). The workflow hardening test (FR-014) covers the toolkit's own workflows; the guide warns consumers.
- **Unset declared, no `--service-container`, real internet-mode service**: the pinned image in internet mode refuses the private canary, so the service looks sandboxed and the check passes; without the container the check cannot detect it. With `--service-container` the profile read fails it.
- **Exact entries without the service container**: without the container, the check proves only the mode class, so allowlist mode requires the container (User Story 1, scenario 3).
- **Site configuration without the config path**: a value set only in the site configuration is not seen by the check unless it is given the site's config path; on the declared paths the check says which sources it read.
- **Site-configuration-only value checked without the config path passes as unset**: the check then resolves sandbox and runs the unset path, which prints nothing new (FR-007). A service allowlisting only the operator's entries then passes (first limit above). The build notice prints the full verify command with `--astro-config <path>` so operators run the complete form (decision `01M6F21BY4VJVWE4VY889F80CP`).
- **The canary cannot observe a real internet-mode service**: the pinned image in internet mode refuses dotless, IP-literal and inner-network hosts and non-default ports unless allowlisted, so it refuses the canary. Internet mode is therefore verified by the profile read from the container, not by behaviour; the check does not prove that the service actually reaches the internet.
- **Internet mode needs `docker inspect` too**: like allowlist mode, it cannot pass without the named container (decision `01M6F4BRKQ4E9H9Z41BYZH37MC`).
- **Declared modes need `docker inspect`**: a service the check cannot inspect (Kubernetes, a plain jar, a remote service) cannot pass allowlist or internet mode. Recorded in the ADR and the guide (decision `01M6F21EKGBG5HF8XA2YFC517K`).
- **Reachability of declared entries**: the check never fetches a declared entry's URL (NFR-001). Whether the operator's real hosts are up is outside the check.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can turn on remote includes for one declared entry by changing one setting and their service block as the guide shows, and the include check passes in the real-service CI lane. — [build] · no-op passable: no
- **SC-002**: For all 9 cells of the declared/observed matrix, the include check command gives the specified verdict; every failing cell's message contains the declared mode and the observed mode class. — [build] · no-op passable: no
- **SC-003**: With the opt-in unset, the include check output matches the committed golden output, the build prints no new lines, and 100% of existing tests pass unmodified; the unset-path refuse-versus-fetch pair on the same fixtures stays green. — [ratchet] · no-op passable: yes (same-fixture positive control named)
- **SC-004**: On every CI run, a real PlantUML service in allowlist mode fetches the canary's allowed path and refuses its denied path. — [build] · no-op passable: no

## Assumptions

- The environment override wins over the site configuration. This is a new rule (the existing `DK_PLANTUML_SERVER_URL` has no site-configuration counterpart), recorded in the ADR (FR-009).
- PlantUML's allowlist mode is configured with `PLANTUML_SECURITY_PROFILE=ALLOWLIST` and `PLANTUML_ALLOWLIST_URL`, entries separated by `;`, matched as raw string prefixes (verified against the pinned image during the post-spec squad).
- The include check can serve its canary on a fixed port and two paths, so the service's allowlist can be written before the service starts. The plan confirms this works on a GitHub runner, starting with a spike; if it cannot, the plan returns to the operator rather than dropping the real-service lane.

## Out of Scope

- Changing the default security profile, or the existing sandboxed CI lane.
- Detecting, in unset mode **without `--service-container`**, a service that allowlists only entries other than the canary, or a real internet-mode service (see Limits). With the container, both are now in scope (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`).
- Proxying, caching, or vendoring remote includes.
- Any per-diagram or per-page opt-in; the setting is site-wide.
- A real internet-mode service in CI (internet mode is proven with fake services only, per the operator's decision).
- DNS rebinding: PlantUML's allowlist is a string-prefix match, so it is outside this mission.
- An operator-asserted allowlist for services the check cannot inspect (e.g. `--service-allowlist-url`, "asserted, not read"): a follow-up issue (decision `01M6F21EKGBG5HF8XA2YFC517K`).
