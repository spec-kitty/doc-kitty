---
title: "ADR-0014: Upgrade Starlight to 0.32 for the route-data API"
description: The carrier route-data API ADR-0011 requires lives in Starlight 0.32, not 0.30; M1 upgrades Starlight to reach it.
doc_status: active
updated: 2026-08-23
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0013-m1-chrome-substrate-single-layer
  - architecture/theming
---

# ADR-0014: Upgrade Starlight to 0.32 for the route-data API

## Status

Accepted. Corrects the Starlight version claim in
[ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md) (the design decision
stands; only the version number was wrong) and refines NFR-006 for M1.

## Context

[ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md) and
[theming.md](../architecture/theming.md) require the four chrome carriers to read
page state from `Astro.locals.starlightRoute`, "the Starlight 0.30 route-data API,"
and explicitly *not* from `Astro.props`. Building the carriers in M1 (mission
M1 / WP02) surfaced a factual error: `Astro.locals.starlightRoute` **does not exist
in Starlight 0.30**. That line was pinned at `@astrojs/starlight@0.30.6`, whose
component overrides receive route data through `Astro.props`; the route-data locals
API was introduced in **Starlight 0.32**. Verified in the pinned tree: zero
occurrences of `starlightRoute` in 0.30.6, and its `Page.astro` renders overrides as
`<Head {...Astro.props} />`.

This put two constraints in direct conflict on the pinned toolchain:

- **ADR-0011 / the carrier contract** — carriers use `Astro.locals.starlightRoute`,
  never `Astro.props`. Requires Starlight ≥ 0.32.
- **NFR-006 (as restated in the plan)** — "no dependency added, upgraded, or
  removed." Pins Starlight at 0.30.6.

The design intent is unambiguous — the whole point of the four-carrier surface is
the stable route-data seam, and a future Starlight rename is meant to be a one-file
carrier fix. Only the version number attached to that API was wrong.

## Decision

1. **Upgrade `@astrojs/starlight` to `^0.32.6`** (0.32 is the first release with the
   route-data locals API), across both workspaces — the `example` site dependency
   and the toolkit's own dev/peer dependency — so a single Starlight instance is
   linked. 0.32 peers on Astro `^5.1.5`, satisfied by the pinned Astro 5.18.2, so
   **no Astro major bump** is required. The carrier contract from ADR-0011 is kept
   verbatim: carriers read `Astro.locals.starlightRoute`, never `Astro.props`.
2. **Refine NFR-006** for M1: it forbids adding a *new* heavy or external dependency
   (and any coupling to an external brand/design repo). Upgrading an
   already-shipped core dependency to the version that provides the API the settled
   design requires is **in scope**, not a violation. No new package is added.
3. **Unify the version across the pnpm workspace.** The initial partial bump left
   the toolkit on 0.30.6 and the example on 0.32.6; two linked Starlight instances
   break the `virtual:starlight/route-middleware` resolution at build. Both
   workspaces pin the same 0.32.x line.

## Consequences

### Positive

- The carriers use the route-data seam ADR-0011 designed, so a later Starlight
  rename stays a one-file carrier fix and the M2 extension points (ADR-0013) hold.
- Every `ci-ok` lane stays green on the upgrade: toolkit tests, lint, `astro check`,
  doc-sanity, and `build-example` (14 pages, agent index pinned at 12, draft
  excluded from the sitemap).

### Negative

- The committed `pnpm-lock.yaml` changes. A single Starlight version must be kept in
  sync across the two workspaces (a divergence reintroduces the virtual-module build
  failure).

### Risks

- A future Starlight bump past the Astro-5 line (0.38 requires Astro 6) would couple
  a Starlight upgrade to an Astro major. Mitigation: stay on the highest Astro-5
  Starlight until an Astro upgrade is itself decided.

## Supply chain (DIRECTIVE_051)

`@astrojs/starlight@0.32.6` is the official Astro package (maintainer `natemoo-re`),
carries a registry integrity hash, and declares **no** `preinstall`/`install`/
`postinstall` lifecycle scripts. No transitive new top-level dependency is
introduced by the bump.

## Alternatives considered

### Keep 0.30.6; rewrite carriers to `Astro.props`

Rejected by the maintainer's decision. It preserves the exact pin but abandons the
route-data API the design mandates, makes the carriers read the `Astro.props` the
design says to avoid, and defers the same upgrade to a later mission with the
carriers then needing rework — the fragility ADR-0011 exists to prevent.

### Upgrade to the latest Starlight (0.41)

Rejected. Latest Starlight peers on Astro `^7`, forcing an Astro major upgrade far
outside M1's scope and risking the whole M0-green baseline. 0.32 reaches the API
with the smallest version distance from 0.30.

## References

- [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md),
  [ADR-0013](./0013-m1-chrome-substrate-single-layer.md).
- [Theming and chrome](../architecture/theming.md).
