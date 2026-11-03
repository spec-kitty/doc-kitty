# Data model: PlantUML external-connection opt-in (#268)

Terms follow the spec's Domain Language. Revised after the post-plan squad ([squad/post-plan.md](./squad/post-plan.md)). Decisions referenced as R# are in [research.md](./research.md).

## 1. Opt-in setting

| Field | Type | Notes |
|---|---|---|
| site value | `readonly string[] \| 'internet' \| undefined` | `DocKittyOptions.plantumlAllowExternal` in `astro.config.*` (R1) |
| env value | `string \| undefined` | `DK_PLANTUML_ALLOW_EXTERNAL` |

**Resolution** (the only output of `resolvePlantumlAllowExternal`, `src/lib/plantuml-external.mjs`):

```ts
type Resolution = {
  mode: 'sandbox' | 'allowlist' | 'internet';
  entries: string[];          // non-empty only in allowlist mode, in declared order
  source: 'default' | 'environment' | 'site configuration';
};
```

Precedence: a non-blank env value wins over the site value; a blank env value is unset; with neither, `{ mode: 'sandbox', entries: [], source: 'default' }`.

**Validation rules** (each rejection throws `PlantumlAllowExternalError` naming the setting, its source and the accepted shapes; the build fails at config time, the check exits 2 before rendering or probing):

| # | Input | Result |
|---|---|---|
| E1 | env word other than exactly lowercase `internet` that is not a URL list (e.g. `sandbox`, `yes`, `INTERNET`, which gets the hint "use lowercase `internet`"); site value not an array or `'internet'` (e.g. `true`, `'sandbox'`, `{}`); an entry that is not an `http:`/`https:` URL; an entry with userinfo, query, fragment or whitespace | rejected (edge case 1) |
| E2 | site `[]`; env `;` or `; ;` | rejected: "an empty allowlist is not sandbox; leave the setting unset" (edge case 2) |
| E3 | entry not ending in `/`, or with no `/` after the authority (`http://host`, `http://host:8080`, `https://host/path`) | rejected: "end the entry with `/`, PlantUML matches raw prefixes, so `http://host` also allows `http://host.evil.com`" (edge case 3) |
| E4 | a site-value entry containing `;` | rejected: "`;` separates entries in PLANTUML_ALLOWLIST_URL" (edge case 4). In the env, `;` is the separator, so this cannot occur there. |
| E5 | env `""` or whitespace only | unset; the site value (or the default) applies (edge case 5) |
| E6 | env and site both set, different | env wins; `source: 'environment'`; the build notice and the check's declared line both say `environment` (edge case 6) |
| E7 | an entry containing `@` anywhere | rejected: "`<entry>` contains \"@\"; PlantUML never matches an allowlist entry containing \"@\"" (edge case 9, spike F5) |

Entries are kept as written (no URL normalization), because PlantUML compares raw strings.

**Build publication.** `defineDocKittyIntegrations` **always** publishes the resolution as JSON in the internal handoff `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` (added to `internal-env.mjs`, cleared by `clearInternalEnv`), including the explicit sandbox resolution. `site-config-eval.mjs` deletes any inherited value from the child env and returns the handoff as `plantumlAllowExternal`:

| Child answer | Meaning | What the check does |
|---|---|---|
| a resolution object (any mode) | the config called `defineDocKittyIntegrations` | uses it as the declared value |
| `null` | the config never called `defineDocKittyIntegrations` | falls back to the env-only resolver (`siteValue: undefined`) |
| `ok: false` | the config threw (including an invalid setting) | exit 2 |

The check never reads `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` from its own `process.env` (a forged parent value is ignored; tested).

There is no environment off-switch over a site allowlist: a blank env value is unset (E5), so the site value applies. To return to sandbox, remove the site option.

## 2. Canary

| Field | Value |
|---|---|
| host | `--canary-host` (default `127.0.0.1`; the CI lane and guide use `dk-canary` via `--add-host dk-canary:host-gateway`) |
| port | `--canary-port`; declared modes default `18091`; unset mode random unless given |
| allowed prefix | `/dk-canary/allowed/` (serves marker `DK-CANARY-FETCHED`) |
| denied prefix | `/dk-canary/denied/` (serves marker `DK-CANARY-DENIED-FETCHED`) |
| paths used | declared modes: `<prefix>probe`, `<prefix>include/<fixture>`, `/dk-canary/allowed/redirect/<fixture>` → `302` to `/dk-canary/denied/redirected/<fixture>` |
| canary entry | `http://<host>:<port>/dk-canary/allowed/` |
| request log | every request path, in order |
| unset-mode paths | fixtures at `/dk-canary/allowed/include/<fixture>`; reachability probe stays at today's `/reachability`, because a failed probe's message embeds the URL (FR-007 failure-path byte identity) |

Rule (NFR-001): in declared modes any logged path outside the two prefixes fails the run. No request is ever made to a declared entry.

## 3. Observed mode class

Three classes (R11, revised after the spike). With `--service-container`, the **observed class is the profile** read from the container: `SANDBOX` → sandbox, `ALLOWLIST` → allowlist, `INTERNET` → internet (any other value: no class). The canary gives the **behavioural** class for sandbox and allowlist modes, per fixture, from the request log ("hit" = at least one logged request; PlantUML requests each include twice):

| allowed `include/` hit | denied `include/` hit | class |
|---|---|---|
| no | no | sandbox |
| yes | no | allowlist |
| yes | yes | internet |

Anything else (denied hit without allowed hit, or the two fixtures disagreeing) has **no class**: `observed` is `null` and the verdict fails with reason `inconsistent fetches`, listing each fixture's per-path result.

A real INTERNET service refuses the canary, so the behavioural class never reads internet for it; the "both yes" row only arises from fakes or unusual services. In internet mode the behavioural result is informational.

Separately: a hit on `/dk-canary/denied/redirected/` = **redirect followed** (edge case 8), judged only from the request log, never from the HTTP status (a refused redirect renders HTTP 200 with an empty diagram). It fails allowlist mode; in internet mode it is informational.

## 4. Service configuration (optional)

Read only with `--service-container`, in allowlist and internet modes (R4, R12). Keys are picked by name; the env array's order and runner-injected variables are ignored:

| Field | Source | Rule |
|---|---|---|
| profile | `PLANTUML_SECURITY_PROFILE` from `docker inspect .Config.Env` | must be exactly `ALLOWLIST` (allowlist mode) or `INTERNET` (internet mode) |
| configured entries (allowlist mode) | `PLANTUML_ALLOWLIST_URL`, split on `;`, no trimming | no empty item except one trailing `;` (an empty item allows every URL, spike F2); as a set, must equal `declared entries ∪ { canary entry }` |
| system-property config | every env value (post-merge fold; before: only `JAVA_OPTS`, `JAVA_OPTIONS`, `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS`, `CATALINA_OPTS`, which missed `_JAVA_OPTIONS`, `JETTY_OPTS` and the like) | must not carry any `-D` property named `plantuml.*` / `PLANTUML_*` in any case or separator — PlantUML's `SecurityUtils.getenv` reads `System.getProperty("PLANTUML_SECURITY_PROFILE")` before the env var (verified in the pinned jar, WP06 review) — and no env key may be named `plantuml.*` (PlantUML reads it before `PLANTUML_ALLOWLIST_URL`); either fails closed |
| container identity | `docker inspect -f '{{json .NetworkSettings.Ports}}'` (an object of `<port>/<proto>` → `null` or `[{HostIp, HostPort}]`; `null`/`{}` when nothing is published) | with a local `--server` host, some binding must have `HostPort` equal to the `--server` port and a loopback-reachable `HostIp`; else fail closed (decoy). A non-local host is not verified and prints one note (pre-PR fold) |
| property file | `PLANTUML_PROPERTY_FILE` from `docker inspect .Config.Env` | must be unset or empty: the pinned server loads the named file into system properties after the env profile, so it can override the profile and the allowlist; the check cannot read it and fails closed in every mode with a container (post-merge fold) |
| command-line properties | `docker inspect -f '[{{json .Config.Entrypoint}},{{json .Config.Cmd}},{{json .Args}}]'` (exactly three items, each `null` or an array of strings) | no word may carry a `-D` property named `plantuml.*` / `PLANTUML_*` in any case or separator, nor be a bare `plantuml.*` word; fails closed in every mode with a container (post-merge fold: `docker run <image> -D…` lands there, out of reach of the env read) |

## 5. Include check verdict

```ts
type Verdict = {
  ok: boolean;
  exitCode: 0 | 1 | 2;          // 2: usage or setting error; 1: verification failed
  declared: Resolution;
  observed: 'sandbox' | 'allowlist' | 'internet' | null; // null: unset path, control failure, or inconsistent fetches
  reachability: { allowed: boolean | null; denied: boolean | null };      // null: not probed
  entries?: { extra: string[]; missing: string[] };
  warnings: string[];           // internet mode
  reasons: string[];            // stable failure reason ids, e.g. 'allowed-refused', 'entries-differ', 'inconsistent fetches'
  messages: string[];           // failures; each names declared mode and observed class (or "no class")
};
```

## 6. The 3×3 verdict table

Rows: declared. Columns: observed class. Exact message substrings are in [contracts/include-check-cli.md](./contracts/include-check-cli.md).

| Declared \ Observed | sandbox | allowlist | internet |
|---|---|---|---|
| **unset** (sandbox) | **pass**, output = golden (FR-007) | **fail** — note U-A | **fail** with `--service-container`; else undetectable for the real image — note U-I |
| **allowlist** | **fail**: allowed path refused | **pass** only with `--service-container`, both probes reachable, allowed path fetched, denied path refused, profile `ALLOWLIST`, entries equal with no empty item; else **fail** naming extra / missing / empty entries, the profile, or the missing container | **fail**: profile is `INTERNET` (caught even when the canary looks like allowlist); plus "denied path fetched" if the canary sees it |
| **internet** | **fail**: profile is `SANDBOX` | **fail**: profile is `ALLOWLIST` | **pass** only with `--service-container` and profile `INTERNET`, with a warning; canary results informational |

Notes keyed to cells:

- **U-A (unset × allowlist)**: with `--service-container` — canary entry allowlisted and the check run with the matching `--canary-host` / `--canary-port`: the behavioural half fails first, today's message `the server FETCHED the remote include`; canary entry not allowlisted (or random canary port): the behavioural half passes, then the profile read fails, `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "ALLOWLIST"`. Without the container: **fail** with today's message when the allowed path is fetched; undetectable if the service allowlists other entries only (Limits).
- **U-I (unset × internet)**: with `--service-container`: **fail**, `opt-in unset (sandbox), but the service's PLANTUML_SECURITY_PROFILE is "INTERNET"` (or `… is not set (the image default is INTERNET)`); without: undetectable for the real image (it refuses the canary); a fetching fake fails with today's messages.

**Unset mode with `--service-container`** (decision `01M6F4XFDPJ6XFBYM5HM65G1AM`): the unchanged unset check runs first; only if it passes, and before the OK line is printed, the profile is read (`docker inspect`, by key name) and must be exactly `SANDBOX`. Absent → fail with `… is not set (the image default is INTERNET)`. Any other value → fail naming it. On `SANDBOX` nothing new is printed, so the pass output stays byte-identical to the goldens; today's failure outputs are unchanged because the read happens only after a pass. `docker` missing or erroring at that point → `could not read the service configuration`. The read fails closed on Java system-property configuration exactly as the declared modes do (a `-D` property named `plantuml.*`/`PLANTUML_*` in any case or separator in `JAVA_OPTS`, `JAVA_OPTIONS`, `JAVA_TOOL_OPTIONS`, `JDK_JAVA_OPTIONS` or `CATALINA_OPTS`, e.g. `-DPLANTUML_SECURITY_PROFILE=INTERNET`, or an env key named `plantuml.*` → `configured through Java system properties…`), even when `PLANTUML_SECURITY_PROFILE=SANDBOX` is set.

For declared modes the column is the profile read from the container. Without the container, allowlist and internet modes both fail ("needs --service-container").

Additional failing states in any declared mode: control render fails; canary port in use (exit 2); a path's reachability probe fails (edge case 7; allowlist mode only); redirect followed (edge case 8, allowlist); request outside the two prefixes (NFR-001); inconsistent fetches (no class, allowlist mode); `docker` missing or erroring (allowlist and internet); no container (allowlist and internet); an empty item in the service's allowlist (edge case 10).

Unset mode never changes: edge case 7 there stays a note, not a failure.

## 7. NFR-003 measurement grid

Each cell sets value V in source S, runs the build side (the fixture site's `astro.config.mjs` calls the real `defineDocKittyIntegrations`; evaluated through `evaluateSiteConfig`; notice captured from stderr) and the check side (`assert-plantuml-no-remote-include.mjs --astro-config <fixture> --print-declared`), and requires identical `{mode, entries, source}`. The fixture also sets `indexBasename: ['PARITY']`, and the answer must carry `names: ['PARITY']`, which only `defineDocKittyIntegrations` publishes: proof the real build code ran (N8).

| S \ V | unset | allowlist `[A]` | internet |
|---|---|---|---|
| site only | option absent, env absent | option `[A]` | option `'internet'` |
| env only | option absent, env `""` | env `A` | env `internet` |
| both | option explicitly `undefined`, env whitespace-only | option `[B]`, env `A` → env wins | option `[B]`, env `internet` → env wins |

Target: 9 of 9 identical. One extra parity case covers E5 across sources: option `[B]` with env `""` must resolve to `[B]` from site configuration on both sides.
