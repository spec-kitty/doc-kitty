---
title: "ADR-0057: One owner for DocKitty's internal environment handoffs"
description: DocKitty passes five settings between its own parts through process.env; one module now names, writes and clears them.
doc_status: active
updated: 2026-10-15
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0050-route-collisions-and-single-index-setting
  - adr/0055-gherkin-scenario-results
  - adr/0056-gherkin-results-followups
  - guides/consumer-setup
---

# ADR-0057: One owner for DocKitty's internal environment handoffs

## Status

Accepted. Closes [#167](https://github.com/spec-kitty/doc-kitty/issues/167).
It names the seam that [ADR-0050](./0050-route-collisions-and-single-index-setting.md),
[ADR-0055](./0055-gherkin-scenario-results.md) and
[ADR-0056](./0056-gherkin-results-followups.md) each used without recording it.
Those ADRs are not edited beyond a pointer to this one.

## Context

`defineDocKittyIntegrations` runs in the `astro.config` surface. The docs loader,
the routes and the command-line tools run elsewhere, often in a separate module
graph (Vite SSR), so they cannot share module state. DocKitty therefore passes
five values through `process.env`. Before this change each name was a string
literal in several files, each write was a bare assignment, and nothing cleared
old values. A second config in the same process, for example a test suite, kept
the first config's draft-publication setting. Production builds define one
config per process, so they were not affected.

The drafts a build withholds are not among the five values. They live in a
per-config build state; see [ADR-0058](./0058-build-state-owner-and-config-split.md).

## Decision

1. **One module owns the five names.** `src/lib/internal-env.mjs` defines each
   name once, and all other code imports it. The names are:

   | Name                          | Written at | Writer                                   | Readers                                   |
   | ----------------------------- | ---------- | ---------------------------------------- | ----------------------------------------- |
   | `DK_INDEX_BASENAME`           | define     | `defineDocKittyIntegrations`             | docs loader, site-index-names CLI         |
   | `DK_GHERKIN_RESULTS`          | define     | `defineDocKittyIntegrations`             | docs loader (`schema.ts`), scenario route |
   | `DK_DOCS_ROOT`                | define     | `defineDocKittyIntegrations`             | standalone routes (`routes/shared.ts`)    |
   | `DK_GHERKIN_ROUTE`            | setup      | `doc-kitty:gherkin-fence` `config:setup` | scenario-index route                      |
   | `DK_PUBLISH_DRAFTS_RESOLVED`  | setup      | `doc-kitty:draft-publication` `config:setup` | `publishDraftsInForce` (loader, routes) |

2. **Every write goes through the module.** Code sets a value with
   `setInternalEnv` and removes one with `deleteInternalEnv`. Both refuse a name
   that is not one of the five.
3. **A config definition starts clean.** `defineDocKittyIntegrations` calls
   `clearInternalEnv` first, so a later config never inherits an earlier one's
   values.
4. **Readers read `process.env` at call time.** Vite SSR loads the content config
   and routes in a separate module graph, so module state would arrive empty.
5. **Adopters never set these.** DocKitty sets them for its own use. The
   [consumer guide](../guides/consumer-setup.md) lists the names so nobody sets
   one by hand.
6. **The build output does not change.** A byte comparison of the example site,
   built before and after this change, finds no difference.
7. **Only `DK_INDEX_BASENAME` keeps a format check.** It holds a JSON list, so a
   hand-set value can be checked and rejected. The other four hold free strings
   (a path, a route, `on`/`off`), so no check could tell a hand-set value from a
   real one. The check is not extended to them.

## Consequences

### Positive

- A name has one definition, so a typo cannot create a second variable.
- A second config in one process starts with no leftovers.
- A reader can find every writer and reader in one table.

### Negative

- `routes/shared.ts` still re-exports the docs-root name, so one more file
  depends on the module.

### Risks

- A new handoff added without going through the module would escape
  `clearInternalEnv`. Adding the name to the module, and to the table above, is
  part of adding a handoff.
- Each config's define and its setup hooks must run as a pair. If two defines
  interleave with setup hooks (define A, define B, setup A), setup A sees B's
  values. Astro does not do this, and handling it is out of scope.

## Alternatives considered

### Shared module state

Rejected: the loader and routes run in a separate module graph, so the state
would be empty when they read it.

### Leave the literals and clear them ad hoc

Rejected: that is the situation that let a stale value through.

## References

- [#167](https://github.com/spec-kitty/doc-kitty/issues/167), the issue.
- [Consumer setup](../guides/consumer-setup.md#internal-environment-names).
