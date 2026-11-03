---
title: "ADR-0074: Let operators opt PlantUML into external includes"
description: The sandbox stays the default; an operator opt-in lets the PlantUML service fetch declared URL includes, and the include check verifies the running service against it.
doc_status: active
updated: 2026-11-03T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - adr/0007-ci-cd-path-scoped-lanes
  - adr/0040-build-time-diagram-render-dual-mode
  - adr/0072-parallel-landing-without-shared-files
  - guides/consumer-setup
---

# ADR-0074: Let operators opt PlantUML into external includes

## Status

Accepted (2026-11-02)

## Context

[#256](https://github.com/spec-kitty/doc-kitty/issues/256) and
[#251](https://github.com/spec-kitty/doc-kitty/issues/251) hardened the PlantUML
service: it runs pinned by digest with `PLANTUML_SECURITY_PROFILE=SANDBOX`,
and `dockitty-assert-plantuml-no-remote-include` proves that a remote include
is refused. The reason for that decision lived only in
[Diagrams](../architecture/diagrams.md).

The hardening is deliberately strict, and it gives operators with a real need
no way forward. Two downstream spec-kitty issues
([spec-kitty/spec-kitty#6100](https://github.com/spec-kitty/spec-kitty/issues/6100)
and [spec-kitty/spec-kitty#6916](https://github.com/spec-kitty/spec-kitty/issues/6916)) keep an
organisation-hosted style or macro library behind a URL. Their diagrams
`!include` it, and today every such build fails. Issue
[#268](https://github.com/spec-kitty/doc-kitty/issues/268) asks for an opt-in
that lets the operator allow external connections without losing the default.

## Decision

The sandbox stays the default. An operator may opt in with one setting that has
exactly three values:

| Value | Site configuration | Environment |
|---|---|---|
| unset (sandbox, the default) | option absent | variable absent or blank |
| allowlist | `plantumlAllowExternal: ['https://host/path/']` | `DK_PLANTUML_ALLOW_EXTERNAL=https://host/path/;…` |
| `internet` | `plantumlAllowExternal: 'internet'` | `DK_PLANTUML_ALLOW_EXTERNAL=internet` |

- **The environment wins.** When `DK_PLANTUML_ALLOW_EXTERNAL` is non-blank it
  overrides `plantumlAllowExternal`. This is a new rule, not a precedent
  inherited from `DK_PLANTUML_SERVER_URL`, which has no site counterpart. A
  blank value counts as unset, so there is no environment off-switch over a
  site allowlist: to return to the sandbox, remove the site option.
- **The toolkit declares and verifies, and never configures the service.** It
  does not start, stop or reconfigure it. The build prints which entries were
  declared and the command that verifies them. The include check proves the
  running service matches.
- **A top-level option, not `diagrams.plantuml.allowExternal`.** The issue
  suggested the nested name, but `diagrams` is a boolean read by identity.
  Widening it to an object would make `diagrams: { … }` silently mean "on" and
  touch every branch that reads it. A sibling option keeps `diagrams` intact.
- **Entries are strict.** An entry is an absolute `http(s)` URL with a path,
  ending in `/`, with no `;`, `@`, whitespace, userinfo, query or fragment.
  PlantUML matches raw string prefixes, so `http://host` also allows
  `http://host.evil.com`. PlantUML never matches an entry containing `@`.
- **The include check reads the site config only when asked.**
  `--astro-config <path>` evaluates the site's configuration (it needs the
  site's dependencies installed); without it, the check reads only the
  environment. The unset path stays free of dependencies.

### What the check proves in each mode

- **Unset:** the output is byte-identical to before (committed goldens). With
  `--service-container` the check now also reads the service's profile and
  requires `SANDBOX`: a service with any other profile, or none (the image
  default is `INTERNET`), fails. This is the one behaviour change for
  existing users: a service named by `--service-container` whose profile is
  not `SANDBOX` used to pass.
- **Allowlist:** the allowed canary path is fetched, the denied path is
  reachable and refused, a redirect from the allowed path to the denied one is
  not followed, and the container's `PLANTUML_SECURITY_PROFILE` is `ALLOWLIST`
  with a `PLANTUML_ALLOWLIST_URL` equal to the declared entries plus the
  canary entry. The check never requests a declared entry.
- **Internet:** the container's `PLANTUML_SECURITY_PROFILE` is `INTERNET`, and
  the check warns that the service may fetch internal networks and cloud
  metadata endpoints.

### What the check cannot prove

- **Unset, no `--service-container`, a service allowlisting only other
  entries:** both canary paths are refused, so it looks sandboxed and passes.
- **Unset, no `--service-container`, a real internet-mode service:** the pinned
  image refuses the private canary, so the service looks sandboxed and passes.
  With the container, the profile read fails it.
- **A site-config-only value checked without `--astro-config`:** the check
  resolves unset and passes as such. The build notice prints the full command
  with `--astro-config`.
- **Allowlist and internet modes need `docker inspect`.** A service the check
  cannot inspect (Kubernetes, a plain jar, a remote server) cannot pass
  either mode. Without the container, allowlist and internet modes fail.
- **Internet reach:** the pinned image in internet mode refuses dotless,
  IP-literal and inner-network hosts and non-default ports, so the canary
  cannot observe it. Internet mode is verified by the container's profile
  (decision `01M6F4BRKQ4E9H9Z41BYZH37MC`), not by behaviour: the check does not
  prove the service reaches the internet.
- **Reachability of declared entries:** whether the operator's hosts are up is
  outside the check.
- **Configuration outside the two variables:** with `--service-container`, the
  check fails closed, in every mode, on the known channels: Java options in any
  env value (a `-D` property named `plantuml.*`/`PLANTUML_*`), env keys named
  `plantuml.*`, a non-empty `PLANTUML_PROPERTY_FILE` (the pinned server loads it
  after the profile, so it can override the profile and the allowlist), and
  `-D`/`plantuml.*` words on the command line (entrypoint, command or args). It
  trusts the image, its entrypoint script, mounted files (for example Jetty
  `start.d`) and `@argfile` contents: configuration hidden there is not seen.
- **Container identity:** the check reads one container and renders through
  `--server`. When the `--server` host is local (`localhost`, `127.0.0.0/8`,
  `[::1]`), it requires the container to publish that port, so a decoy
  container cannot vouch for another service. With a non-local host, such as a
  Docker network name, it cannot tie the two and prints a note that service
  identity was not verified.

The spike against the pinned image shaped these rules. Raw entry comparison is
deliberately stricter than PlantUML's own normalisation (it trims, lowercases
and drops `:80` and `:443`), so a differently written entry is a mismatch. An
empty item in the service's allowlist allows every URL, so the check fails
it (decision `01M6F4BVDASAREW2NVH23727CW`). A redirect from an allowed entry
to a denied URL is not followed under allowlist mode.

## Consequences

### Positive

- Operators with a remote style library can build, and the default for everyone
  else is unchanged: no new output, no new failure with `SANDBOX`.
- The setting and the running service are checked against each other, so a
  service left in the wrong mode is caught where the container is named.

### Negative

- A new CI lane, `plantuml-allowlist`, runs the real service in allowlist mode.
  It is **unconditional**, not path-scoped: the success criterion asks for the
  real-service proof on every run, which is a recorded exception to the
  path-scoped design of [ADR-0007](./0007-ci-cd-path-scoped-lanes.md). It is
  cheap, and it feeds `ci-ok`.
- Unset mode with `--service-container` now requires `SANDBOX` (decision
  `01M6F4XFDPJ6XFBYM5HM65G1AM`). A consumer who names the container and runs a
  different profile sees a new failure.
- A docs test ties the consumer guide's allowlist block to the lane's block, so
  the two change together.

### Risks

- An operator who only sets the environment variable and never opens the
  service gets a declared mode with no service behind it. The check is what
  catches that, and it needs the container.
- The unconditional `plantuml-allowlist` lane pulls the pinned image from
  Docker Hub on every run. An outage or rate limit there turns `ci-ok` red for
  changes unrelated to PlantUML; the digest pin keeps the pull reproducible,
  not available.

## Alternatives considered

### Option A: nest it under `diagrams.plantuml.allowExternal`

Not chosen, for the reason given above.

### Option B: have the toolkit configure the service

Not chosen. The operator runs the service, and the toolkit changing its
security mode would be a surprise and impossible for services it cannot reach.

### Option C: read the site config without a flag

Rejected: a pre-install run in a site directory would newly fail, which
changes unset-mode output. The check takes `--astro-config` instead. Other
options considered were an environment-only check (it misses site-config
values), a side file both read (a second configuration surface) and parsing
the config text (it fails closed often and lies sometimes).

### Option D: verify internet mode by behaviour

Rejected after the spike: a real internet-mode service refuses the private
canary, so a behavioural check fails every correct service.

### Deferred

- **Failing a build whose internet mode comes only from the environment.** The
  build warns today; making it fail is a stricter option for later.
- **An operator-asserted `--service-allowlist-url`.** It would let a service
  that is not inspectable pass allowlist mode. This is a follow-up:
  [#287](https://github.com/spec-kitty/doc-kitty/issues/287).

## References

- [#268](https://github.com/spec-kitty/doc-kitty/issues/268), [#256](https://github.com/spec-kitty/doc-kitty/issues/256) and [#251](https://github.com/spec-kitty/doc-kitty/issues/251)
- [Allowing external includes](../guides/consumer-setup.md#allowing-external-includes) in the consumer guide
- [Diagrams](../architecture/diagrams.md)
- [ADR-0007](./0007-ci-cd-path-scoped-lanes.md) and [ADR-0072](./0072-parallel-landing-without-shared-files.md)
