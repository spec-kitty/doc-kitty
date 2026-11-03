# Contract: `dockitty-assert-plantuml-no-remote-include` (the include check)

Entry: `src/scripts/assert-plantuml-no-remote-include.mjs` (bin `dockitty-assert-plantuml-no-remote-include`, `src/package.json:57`). Node built-ins only at load time; `site-config-eval.mjs` is imported dynamically and only when `--astro-config` is given (R2).

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--server <url>` | `DK_PLANTUML_SERVER_URL`, then `http://localhost:8091/svg/` | unchanged |
| `--canary-host <host>` | `127.0.0.1` | unchanged; the host the service uses to reach the canary. Guide and CI: `dk-canary` |
| `--service-container <id\|name>` | none | unchanged meaning (probe via `docker exec … curl`); also read with `docker inspect` in allowlist and internet modes. Neither declared mode can pass without it (no operator-asserted alternative; follow-up) |
| `--canary-port <n>` | **new.** Declared modes: `18091`. Unset mode: random, unless given | fixed port so the service's allowlist can name the canary |
| `--astro-config <path>` | **new.** none | evaluate this site config to read `plantumlAllowExternal`; needs the site's `astro` installed. `site-config-eval.mjs` is imported dynamically, never statically. Without it only `DK_PLANTUML_ALLOW_EXTERNAL` is read; a site-config-only value then passes as unset (spec Limits) |
| `--print-declared` | **new.** off | print the resolution as one JSON line `{"mode":…,"entries":[…],"source":…}` on stdout and exit 0; no canary, no render |

Unknown or incomplete flags: exit 2, `assert-plantuml-no-remote-include: unknown or incomplete argument: <flag>` (unchanged). `--print-declared` is a boolean flag and takes no value.

## Exit codes

| Code | When |
|---|---|
| 0 | the verdict passes (internet mode also prints a warning) |
| 1 | verification failed: a control failed, a mismatch, a missing container in allowlist or internet mode, an unset-mode profile other than `SANDBOX` with `--service-container`, a failed reachability probe, a redirect followed, a stray canary request |
| 2 | usage error; invalid opt-in setting (edge cases 1–4 and 9); `--astro-config` missing or not evaluable; canary port in use |

## Output, unset mode (frozen, FR-007)

Byte-identical to the committed goldens `src/tests/fixtures/plantuml-include-check/golden-unset-<case>.{stdout,stderr,exit}` for the five cases `refuse-no-container`, `refuse-container`, `fetch`, `canary-unreachable`, `control-fails` (captured from the pre-change code; only `127.0.0.1:<port>` / `localhost:<port>` are normalized). In the container cases the fake `docker inspect` answers `PLANTUML_SECURITY_PROFILE=SANDBOX`. Lines, as today:

- stdout `assert-plantuml-no-remote-include: <fixture>: HTTP <status>, error <json>, canary requests <n>`
- stderr on failure `assert-plantuml-no-remote-include: FAIL — <message>` with today's messages, including `<fixture>: the server FETCHED the remote include (<n> request(s))`
- stderr `assert-plantuml-no-remote-include: note — no --service-container given, so canary reachability from the server was not proven.`
- stdout `assert-plantuml-no-remote-include: OK — <n> remote include(s) refused by <server>[, with the canary proven reachable from the server]`

**New failure only** (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`): with `--service-container`, after the unchanged check passes and before the OK line, the profile is read; if it is not `SANDBOX` the run fails with `assert-plantuml-no-remote-include: FAIL — opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "<v>"` (or `… is not set (the image default is INTERNET)`), exit 1. A `SANDBOX` profile prints nothing new. The read fails closed exactly as in the declared modes: Java system-property configuration in the env → `FAIL — configured through Java system properties; the check reads only PLANTUML_SECURITY_PROFILE and PLANTUML_ALLOWLIST_URL` (even with `SANDBOX` set); a local `--server` whose port the container does not publish → `FAIL — the service container does not publish the --server port <n> (published: …), so the check would read one container and test another service`; a non-empty `PLANTUML_PROPERTY_FILE` in the service env → `FAIL — configured through a PlantUML property file (PLANTUML_PROPERTY_FILE); the check reads only PLANTUML_SECURITY_PROFILE and PLANTUML_ALLOWLIST_URL` (even with `SANDBOX` set); a PlantUML property on the container command line → `FAIL — configured through Java system properties on the container command line (entrypoint, command or args); the check reads only PLANTUML_SECURITY_PROFILE and PLANTUML_ALLOWLIST_URL` (even with `SANDBOX` set); `docker` missing or erroring on `inspect` → `FAIL — could not read the service configuration (<reason>)`, exit 1.

No `declared:` line, no verdict line and no "site configuration not read" note is printed in unset mode, whether the run passes or fails, and whether or not `--canary-port` or `--astro-config` is given (decision `01M6F21BY4VJVWE4VY889F80CP`). The goldens cover pass and fail cases (stdout, stderr, exit code). The unset reachability probe keeps the `/reachability` path, so the probe-failure message is unchanged.

## Output, declared modes

First line, stdout: `assert-plantuml-no-remote-include: declared: <describeDeclared(resolution)>`, the same text the build notice uses, e.g. `allowlist (from environment DK_PLANTUML_ALLOW_EXTERNAL): https://styles.example.org/plantuml/`. When `--astro-config` was not given, it ends with `; site configuration not read (no --astro-config)`.

Then per fixture and path: `<fixture> → <allowed|denied|redirect>: HTTP <status>, canary requests <n>`.

Then exactly one stable verdict line on stdout, which CI greps: `assert-plantuml-no-remote-include: verdict: declared <mode>, observed <class|no class>`. The allowlist lane requires `verdict: declared allowlist, observed allowlist`.

### Stable substrings per matrix cell

Every failure line is `assert-plantuml-no-remote-include: FAIL — <message>` and every declared-mode message contains `declared <mode>` and `(observed: <class>)` or `(observed: no class)`.

### Half-specific substrings (FR-004, FR-006)

Each is asserted present in its own half-removal row and absent in every other row:

| Half | Substring |
|---|---|
| FR-004 (a) allowed fetched | `the allowed path was refused` |
| FR-004 (b) denied refusal after reachable probe | `the canary's denied path is not reachable from the service` |
| FR-004 (c) profile | `declared allowlist, but the service's PLANTUML_SECURITY_PROFILE is` |
| FR-004 (c) extra entry | `extra: ` |
| FR-004 (c) missing entry | `missing: ` |
| FR-004 (c) empty item (spike F2) | `has an empty entry, which allows every URL` |
| FR-006 container required | `declared internet needs --service-container to read the service's security profile` |
| FR-006 profile is INTERNET | `declared internet, but the service's PLANTUML_SECURITY_PROFILE is` |

| Declared | Observed | Exit | Required substrings |
|---|---|---|---|
| unset | sandbox | 0 | golden output |
| unset | allowlist, with `--service-container`, canary entry allowlisted and matching `--canary-host`/`--canary-port` | 1 | `the server FETCHED the remote include` (behavioural half fails first; no profile read) |
| unset | allowlist, with `--service-container`, canary entry **not** allowlisted (or random canary port) | 1 | `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "ALLOWLIST"` (behavioural half passed; profile read fails) |
| unset | allowlist, no container, allowed path fetched (needs `--canary-host`/`--canary-port` matching the service's canary entry) | 1 | `the server FETCHED the remote include` |
| unset | internet, with `--service-container` (profile `INTERNET` or absent) | 1 | `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is` |
| unset | internet, no container | — | real image: undetectable (refuses the canary; spec Limits). A fetching fake: 1, `the server FETCHED the remote include` |
| allowlist | sandbox | 1 | `declared allowlist, but the allowed path was refused`, `(observed: sandbox)`, `/dk-canary/allowed/` |
| allowlist | allowlist, entries equal | 0 | `OK — declared allowlist matches the service` |
| allowlist | allowlist, entries differ | 1 | `declared allowlist, but the service's allowlist differs`, `(observed: allowlist)`, `extra: <entry>` and/or `missing: <entry>`, `expected PLANTUML_ALLOWLIST_URL=` |
| allowlist | allowlist, profile not ALLOWLIST | 1 | `declared allowlist, but the service's PLANTUML_SECURITY_PROFILE is "<value>"` |
| allowlist | internet (profile `INTERNET`) | 1 | `declared allowlist, but the service's PLANTUML_SECURITY_PROFILE is "INTERNET"`, `(observed: internet)`; plus `declared allowlist, but the denied path was fetched` and `/dk-canary/denied/` when the canary saw the denied fetch |
| internet | sandbox (profile `SANDBOX`) | 1 | `declared internet, but the service's PLANTUML_SECURITY_PROFILE is "SANDBOX"`, `(observed: sandbox)` |
| internet | allowlist (profile `ALLOWLIST`) | 1 | `declared internet, but the service's PLANTUML_SECURITY_PROFILE is "ALLOWLIST"`, `(observed: allowlist)` |
| internet | internet (profile `INTERNET`) | 0 | stderr `warning — declared internet: the service may fetch any URL, including internal networks and cloud metadata endpoints`; stdout `OK — declared internet matches the service` |

In declared modes the observed class is the profile read from the container (R11, decision `01M6F4BRKQ4E9H9Z41BYZH37MC`). In internet mode the per-path canary lines are printed as usual but are informational: they never enter the verdict.

### Other stable substrings

| Case | Exit | Substring |
|---|---|---|
| allowlist without `--service-container` (US1 AS3) | 1 | `declared allowlist needs --service-container to prove the denied path was reachable and the entries match` |
| internet without `--service-container` (US2 AS2) | 1 | `declared internet needs --service-container to read the service's security profile` |
| unset mode, container named, profile not `SANDBOX` | 1 | `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is` |
| unset mode, container named, profile variable absent | 1 | `PLANTUML_SECURITY_PROFILE is not set (the image default is INTERNET)` |
| unset mode, container named, system-property override | 1 | `configured through Java system properties` |
| unset mode, container named, `docker inspect` fails after a passing check | 1 | `could not read the service configuration` |
| empty item in the service's allowlist (edge case 10) | 1 | `the service's PLANTUML_ALLOWLIST_URL has an empty entry, which allows every URL` |
| a reachability probe fails (edge case 7) | 1 | `the canary's <allowed\|denied> path is not reachable from the service, so its <fetch\|refusal> proves nothing` |
| redirect followed (edge case 8; judged from the request log, never the HTTP status) | 1 | `the allowed path's redirect to the denied path was followed` |
| stray canary request (NFR-001) | 1 | `the canary received a request outside its two paths: <path>` |
| inconsistent fetches (no class) | 1 | `inconsistent fetches`, `(observed: no class)` |
| `docker` missing or erroring (allowlist, internet) | 1 | `could not read the service configuration` |
| system-property configuration | 1 | `configured through Java system properties` |
| `--server` host is local (`localhost`, `127.0.0.0/8`, `[::1]`, trailing dot ignored) and the container does not publish that port on an address loopback reaches (`""`, `0.0.0.0`, `::`, `127.0.0.1`, `::1`): a decoy container (every mode with a container; unset mode checks it after a passing check, like the profile) | 1 | `the service container does not publish the --server port <n> (published: <ip:port->port/proto, …\|none>), so the check would read one container and test another service` |
| `--server` host is not local (a docker-network service name, a remote host): identity cannot be tied to the container | 0 (no failure) | one line `note — the --server host <host> is not local, so the check cannot tie it to --service-container: service identity was not verified` (stdout in declared modes, stderr in unset mode; never printed with a local `--server`, so the unset goldens are unchanged) |
| a non-empty `PLANTUML_PROPERTY_FILE` in the service env (every mode with a container; the pinned server loads the file into system properties after the env profile, so it can override the profile and the allowlist; verified 2026-11-03) | 1 | `configured through a PlantUML property file (PLANTUML_PROPERTY_FILE)` |
| a `-D` property named `plantuml[._]*` (any case, also inside a `sh -c` string) or a bare `plantuml.*` word in the container's entrypoint, command or args (every mode with a container; the args form is not honoured by the pinned image, but the check cannot prove that for a given container) | 1 | `configured through Java system properties on the container command line` |
| control render fails | 1 | `control: a plain diagram did not render` / `did not answer` (today's texts) |
| canary port busy | 2 | `cannot listen on canary port <n>` |
| invalid setting | 2 | `invalid DK_PLANTUML_ALLOW_EXTERNAL (environment)` or `invalid plantumlAllowExternal (site configuration)`, plus `accepted:` |
| `--astro-config` not evaluable | 2 | `could not evaluate <path>` (same prefix as `evalRefusal`, built in the CLI; the hint names no `--env-dir`, which this CLI lacks) |
| `--astro-config` given but the site's dependencies are not installed | 2 | `--astro-config needs the site's dependencies installed` (one line, no stack trace) |

## What the check never does

- It never requests a declared entry's URL (NFR-001).
- It never starts, stops or reconfigures the service (C-003). It runs exactly four `docker` argv shapes, all of which only read:
  `docker inspect -f '{{json .Config.Env}}' <c>`, `docker inspect -f '[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]' <c>`,
  `docker inspect -f '{{json .NetworkSettings.Ports}}' <c>` and `docker exec <c> curl -sf --max-time 5 -o /dev/null <url>`.
