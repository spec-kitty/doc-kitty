---
title: Adopter loader & migration — index.md, section rename, redirect-coverage gate
description: "Closes #37/#48/#42 — index.md is an accepted section index, a section rename is a data-only registry edit, and a coverage gate proves old URLs still resolve after migration."
doc_status: active
updated: 2026-09-03
type: Changelog
kind: Changelog
tags: [loader, migration, adoption, redirects, registry, testing]
related:
  - adr/0002-readme-as-index
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0033-flexible-section-identity
  - adr/0034-redirect-coverage-gate
  - context/convention
  - guides/authoring
---

# 2026-09-03 — Adopter loader & migration

Three adoption frictions surfaced by the spec-kitty proving-ground study
([`spec-kitty-adoption-proof`](../architecture/research/spec-kitty-adoption-proof.md))
are closed here, each turned into a first-class, supported toolkit capability
rather than a one-off workaround. Base behaviour is unchanged: on today's
corpus — `README.md` indexes, no section renames, no redirect map — every
change is a no-op, and the full toolkit test suite and every doc-sanity /
build-artifact gate stay green.

## What changed

- **A migrating adopter no longer has to rename every `index.md` to
  `README.md` (#37).** The loader accepts `index.md` as a section index
  (case-insensitive) via a new `indexBasename` option, alongside the
  unchanged `README.md` default. Before, an adopter whose tree already used
  `index.md` had to rename roughly sixty files and rewrite ~1,589 internal
  links just to onboard; now the site builds against the tree as-is. Every
  surface that recognises a section index honours the setting — the content
  loader and route slug, the bare-Node frontmatter validator (including its
  root-index exemption), the link checker, the scaffolder, the new-doc tool,
  and the `llms.txt` description emitter — so an `index.md` tree is never
  half-recognised. A folder with both files resolves to the configured
  basename and warns on the collision, rather than resolving silently.
  Partially supersedes [ADR-0002](../adr/0002-readme-as-index.md); recorded
  in [ADR-0033](../adr/0033-flexible-section-identity.md).

- **Renaming a section folder is now a data edit, not a code edit (#48).**
  Before, a section's derived `type` — and especially its sub-path *subtype*
  (e.g. `plans/features` vs. `plans/missions`) — came from a hardcoded table
  mirrored in two files; renaming the folder without touching that table
  silently reverted every child page to the section's bare default type. The
  section registry (`docs/_meta/sections.yaml`) now carries an optional
  `subtypes` field, so an adopter whose governance mandates a different
  section name declares the rename as registry data: the derived type
  follows the new folder, routes regenerate, `related:` links stay resolved,
  and the [ADR-0029](../adr/0029-sidebar-autogenerate-content-root-coupling.md)
  sidebar coupling is asserted to survive the rename rather than silently
  emptying. The built-in table remains the fallback, so doc-kitty's own tree
  is unaffected. Both derivation twins (the TypeScript lib and the bare-Node
  validator gate) implement the identical resolution order, guarded by an
  extended parity test.

- **A CI gate now proves old URLs still resolve after a migration (#42).**
  Before, doc-kitty shipped no equivalent to a URL-preserving host's redirect
  guarantees — switching to Starlight's clean URLs risked a silent,
  large-scale 404 regression with nothing to catch it. Now, an adopter
  commits a pre-change URL baseline, declares a redirect map via Astro's
  native `redirects` (no new dependency), and a new bare-Node
  `check-redirect-coverage.mjs` gate fails when a baselined URL has neither a
  live page nor a redirect whose *target* resolves — a redirect chain is
  followed to its live terminus, so a redirect pointing at a dead page is
  caught rather than waved through. The gate runs with no Astro build
  context, adds only a few seconds to the `build-example` job, and covers the
  URL churn a section rename (above) produces. Greenfield
  [ADR-0034](../adr/0034-redirect-coverage-gate.md).

- **The worked example now demonstrates all three capabilities against real
  build output.** It builds an `index.md`-indexed section, a renamed section
  (registry `subtypes` + surviving sidebar + covering redirects), and the
  coverage gate in its passing case and both failure modes (an uncovered
  URL, a redirect to a dead target).

- **Living docs stay true.** [`context/convention.md`](../context/convention.md)
  and [`guides/authoring.md`](../guides/authoring.md) document the
  `indexBasename` option, the registry `subtypes` field, and the
  redirect-coverage workflow; the ADR index is regenerated
  (`generate-adr-index.mjs --write`) and stays `--check`-clean with the two
  new records.

## Deferred (filed, not folded)

The full mjs↔ts derivation-twin consolidation (#49) — this mission adds
*guarded* twins (basename detection, `subtypes` resolution) pinned by parity
tests, not a single-source merge. The actual spec-kitty corpus cutover and its
~1,589-link rewrite remain downstream adopter work, as does any Node-in-CI
trial. The `#43` LICENSE decision is a separate human legal gate, unaffected
by this mission.
