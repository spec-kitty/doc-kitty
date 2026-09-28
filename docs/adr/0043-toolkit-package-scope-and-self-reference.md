---
title: "ADR-0043: DocKitty ships under the @spec-kitty scope; NFR-001 forbids runtime coupling, not self-reference"
description: DocKitty ships as @spec-kitty/doc-toolkit, so NFR-001's zero-coupling guard forbids the Spec Kitty runtime and other @spec-kitty packages but exempts its own self-reference.
doc_status: active
updated: 2026-09-28
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - context/convention
  - adr/0042-native-documentation-charter
---

# ADR-0043: DocKitty ships under the `@spec-kitty` scope; NFR-001 forbids runtime coupling, not self-reference

## Status

Accepted

## Context

The project was renamed to **DocKitty** and its npm package from
`@commondocs-kitty/toolkit` to **`@spec-kitty/doc-toolkit`** (Spec Kitty, Inc. is
the copyright holder and now the publishing org).

DocKitty's charter is resolved by its own pure-core/fs-loader/gate triad with **no
Spec Kitty runtime dependency** ([ADR-0042](0042-native-documentation-charter.md)).
That independence is enforced as **NFR-001**: the packed tarball a real adopter
installs must carry zero Spec Kitty coupling. The guard (`charter-cleanroom.test.ts`,
T025) was written as "no `spec-kitty` / `@spec-kitty` import anywhere" — deliberately
precise so it does **not** false-positive on the self-contained `spec-kitty` *brand*
theme (`themes/spec-kitty/**`, `specKittyTheme`, the "Spec Kitty" wordmark).

Publishing the package **under the `@spec-kitty` scope** collides with that guard:
the toolkit's own shipped files self-reference the package by name
(`@spec-kitty/doc-toolkit/routes`, `@spec-kitty/doc-toolkit/themes/spec-kitty`, …) —
the resolved specifiers a consumer's `node_modules` uses — which are exactly the
`@spec-kitty/*` import form the guard forbade. Every such self-import tripped the
zero-coupling check.

## Decision

Keep the `@spec-kitty/doc-toolkit` name and **refine NFR-001** so it targets what it
was always about — *runtime/engine* coupling — rather than the npm scope string:

- **Forbidden (unchanged in spirit):** an import of the `spec-kitty` engine, any
  *other* `@spec-kitty/*` package (e.g. `@spec-kitty/core`), a differently-named
  look-alike that merely shares the `@spec-kitty/doc-toolkit` prefix
  (`@spec-kitty/doc-toolkit-internals`), and the `DoctrineService` symbol.
- **Exempt (new):** the toolkit's **own self-reference** — the exact package name
  `@spec-kitty/doc-toolkit` and its `@spec-kitty/doc-toolkit/*` subpath exports.

The guard's scanner adds a precise self-reference carve-out (matched by exact name or
a `@spec-kitty/doc-toolkit/` prefix), scans **all** matches per file (not just the
first), and its bites-test plants the look-alike as a forbidden case and the bare
self-reference as a benign one, so the exemption cannot silently widen.

## Consequences

### Positive

- The package ships under the organisation that owns it, with no "Common Docs" in the
  name (the rename's goal), while NFR-001 keeps its real teeth: no Spec Kitty runtime,
  no `DoctrineService`, no dependency on any other `@spec-kitty/*` package.
- The scanner is now stricter in one respect (all matches, not just the first), closing
  a latent gap where a forbidden import after a benign one on the same form was missed.

### Negative

- "Zero `@spec-kitty`" is no longer literally true; the invariant is now "zero Spec
  Kitty *runtime* coupling, self-reference excepted." The nuance lives in this ADR and
  the guard's header so a future reader does not mistake the carve-out for a weakening.

### Risks

- A genuinely-coupling package could be introduced under the exact
  `@spec-kitty/doc-toolkit/` prefix and slip past the carve-out. Mitigated: the toolkit
  publishes a single package; anything under that prefix *is* the toolkit, and the
  look-alike bites-test guards the boundary.
- The guard matches **literal** import/require specifiers only; a computed specifier
  (`import('spec' + '-kitty')`) is out of scope. Accepted: shipped, compiled output uses
  literal specifiers, so accidental runtime coupling always takes a literal form.

## Alternatives considered

- **`@dockitty/toolkit` or unscoped `dockitty-toolkit`.** Would have preserved NFR-001
  verbatim with no guard change. Rejected in favour of publishing under the owning
  organisation's scope; the guard refinement is small and well-bounded.
- **Blanket-allow `@spec-kitty/*` in the guard.** Rejected — it would gut NFR-001,
  re-permitting an import of the actual Spec Kitty runtime.
