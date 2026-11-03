# Contract: the opt-in setting (config and environment)

Owner: `src/lib/plantuml-external.mjs` (pure ESM, no imports; exports parse, validate, resolve and `describeDeclared` only. Canary entry and allowlist comparison belong to the check, `src/scripts/plantuml-mode-check.mjs`). Consumers: `src/lib/config.ts` (build) and `src/scripts/assert-plantuml-no-remote-include.mjs` (check). See R1, R2, R10.

## Names

| Surface | Name |
|---|---|
| site configuration | `docKitty({ plantumlAllowExternal })` / `defineDocKittyIntegrations({ plantumlAllowExternal })` |
| environment override | `DK_PLANTUML_ALLOW_EXTERNAL` |
| internal handoff (toolkit-set, never by hand) | `DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED` (JSON resolution; always published by `defineDocKittyIntegrations`, sandbox included; read only from the `site-config-eval` child's answer, never from the check's own env) |

## Accepted shapes

| Value | Site configuration | Environment |
|---|---|---|
| sandbox (default) | option absent or `undefined` | variable absent, empty, or whitespace only |
| allowlist | non-empty array of entries | entries joined by `;` (items trimmed, empty items dropped) |
| internet | `'internet'` | `internet` (exactly lowercase; `INTERNET` is rejected with a hint) |

**Entry**: an absolute `http:` or `https:` URL, written as PlantUML should match it, that has a path, ends with `/`, and has no `;`, `@`, whitespace, userinfo, query or fragment. Write it exactly as the service's `PLANTUML_ALLOWLIST_URL` will hold it: the check compares raw strings, although PlantUML itself trims, lowercases and drops `:80` / `:443`. Example: `https://styles.example.org/plantuml/`.

TypeScript: `plantumlAllowExternal?: readonly string[] | 'internet';`

## Precedence

1. `DK_PLANTUML_ALLOW_EXTERNAL`, if non-blank. Source: `environment`.
2. `plantumlAllowExternal`, if set. Source: `site configuration`.
3. Otherwise sandbox. Source: `default`.

The environment wins: a new rule recorded in ADR-0074, not inherited from `DK_PLANTUML_SERVER_URL` (which has no site counterpart).

**No environment off-switch.** A blank environment value is unset, so it cannot override a site allowlist back to sandbox. To turn the opt-in off, remove the site option.

## Errors

All thrown as `PlantumlAllowExternalError` (build: at config time, so `astro build` stops; check: exit 2 before any canary or render). Message shape:

```
invalid <DK_PLANTUML_ALLOW_EXTERNAL (environment) | plantumlAllowExternal (site configuration)>: <reason>. accepted: leave unset for sandbox, "internet", or a list of http(s) URL prefixes ending in "/" (environment: joined by ";").
```

| Reason (stable substring) | Trigger |
|---|---|
| `unknown value "<v>"` | a word other than `internet`, a non-array non-string site value |
| `use lowercase "internet"` | `INTERNET`, `Internet` |
| `an empty allowlist is not sandbox` | `[]`, `;` |
| `"<entry>" is not an http(s) URL` | wrong scheme, unparsable, userinfo/query/fragment/whitespace |
| `"<entry>" must end with "/"` | bare host, host:port, path without trailing slash; message adds `PlantUML matches raw prefixes, so "http://host" also allows "http://host.evil.com"` |
| `"<entry>" contains ";"` | site-value entry with `;` |
| `"<entry>" contains "@"` | any entry with `@` (PlantUML never matches it; spike F5) |

## Build notice (FR-003)

Printed to stderr by `defineDocKittyIntegrations` when the mode is not sandbox; nothing is printed when unset.

- allowlist: `[dk-plantuml] declared PlantUML allowlist mode (from <source>): <entry>, <entry>. The build cannot see the service; verify it with: dockitty-assert-plantuml-no-remote-include --astro-config <path> --server <url> --canary-host <host> --canary-port 18091 --service-container <container>`
- internet: `[dk-plantuml] WARNING: declared PlantUML internet mode (from <source>): the service may fetch any URL, including internal networks and cloud metadata endpoints. Verify it with: dockitty-assert-plantuml-no-remote-include --astro-config <path> --server <url> --canary-host <host> --canary-port 18091 --service-container <container>`

`<path>` is the config file's path when the build knows it, else the literal `<path>`; the command always includes `--astro-config` (decision `01M6F21BY4VJVWE4VY889F80CP`), so an operator who copies it reads the site configuration.
- either, with `diagrams` off: suffix ` (diagrams are off, so nothing is rendered)`.

`<source>` is `environment DK_PLANTUML_ALLOW_EXTERNAL` or `site configuration`.

## Mapping to the service

`PLANTUML_SECURITY_PROFILE=ALLOWLIST`, `PLANTUML_ALLOWLIST_URL=<entries joined by ";">;http://<canary-host>:<canary-port>/dk-canary/allowed/` (the canary entry is needed only where the check runs). Internet: `PLANTUML_SECURITY_PROFILE=INTERNET`. The toolkit never sets these (C-003); the guide shows them.

**Inspectable services only.** Allowlist and internet modes pass only when the check can `docker inspect` the service (internet mode reads `PLANTUML_SECURITY_PROFILE=INTERNET`, because a real internet-mode service refuses the private canary; decision `01M6F4BRKQ4E9H9Z41BYZH37MC`). A Kubernetes pod, a plain jar or a remote service cannot pass allowlist or internet mode. Recorded in ADR-0074 and the guide; an operator-asserted `--service-allowlist-url` is a follow-up (decision `01M6F21EKGBG5HF8XA2YFC517K`, spec Out of Scope).
