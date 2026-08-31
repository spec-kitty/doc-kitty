# AGENTS.md

Guidance for AI agents working in this repository.

## Documentation

All documentation about this toolkit is in `docs/`, written in the **Common Docs
— Kitty Variation**. Always start at [`docs/README.md`](./docs/README.md).

The canonical section set is declared as data in
[`docs/_meta/sections.yaml`](./docs/_meta/sections.yaml) (the authored section
registry — see [ADR-0004](./docs/adr/0004-amend-common-docs-as-extensible-variation.md)).
It currently holds thirteen sections:

| Section | Path | Contains |
|---------|------|----------|
| Context | `docs/context/` | Why the toolkit exists, who it serves, and the convention it implements (spec, product, glossary) |
| Architecture | `docs/architecture/` | How the toolkit is built and the reasoning behind it |
| Decision Records | `docs/adr/` | The immutable log of architectural decisions |
| Plans | `docs/plans/` | Roadmap, feature designs, and user journeys |
| API | `docs/api/` | The generated discovery surfaces and their contracts |
| Configuration | `docs/configuration/` | How a consuming site configures the toolkit |
| Integrations | `docs/integrations/` | How the toolkit connects to external systems and tools |
| Security | `docs/security/` | Security posture, boundaries, and handling rules |
| Guides | `docs/guides/` | Task-oriented how-tos and tutorials for authors and consumers |
| Operations | `docs/operations/` | Running, deploying, and maintaining a docsite, with runbooks |
| Migrations | `docs/migrations/` | Version-to-version migration guides for the contract and toolkit |
| Presentations | `docs/presentations/` | Markdown-authored reveal.js slide decks |
| Changelog | `docs/changelog/` | What changed and when, newest first |

`sections.yaml` is the source of truth for section identity, labels, ordering,
and feeds — read it rather than assuming a fixed folder list. When unsure about
the documentation convention, read
[`docs/context/convention.md`](./docs/context/convention.md) first.
When making an architectural decision, check `docs/adr/README.md`.

> The `example/` package has its **own** `docs/` tree — the worked example that
> the site renders. Don't confuse it with this repo's `docs/`.

## Agent skills

Reusable skills for operating on a Common Docs — Kitty tree live in
[`agents/`](./agents) (scaffold / write / find / convert). These are minimal for
now and will be recast as Spec Kitty charter/doctrine later.

## Repository conventions

- Package manager: **pnpm** (via `corepack enable`).
- The toolkit source is `src/` (`@commondocs-kitty/toolkit`); the runnable site
  is `example/`.
- Follow the convention when editing any `docs/` tree: `README.md` is the
  section index and carries frontmatter. The required frontmatter fields are
  `title`, `description`, `doc_status`, and `updated`. Two further fields are
  **optional**: `type` names the section and, when omitted, is derived from the
  section registry (`docs/_meta/sections.yaml`) — an authored value wins, and a
  mismatch with the derived value is an advisory warning, never a hard failure;
  a root or orphan page with no derivable type is accepted as untyped. `kind`
  names how to read the page and is accepted when absent (no derivation source
  exists for it). Both `type` and `kind` are open-vocabulary and consumer-
  overridable via `docs/_meta/vocabulary.yaml`. See
  [ADR-0004](./docs/adr/0004-amend-common-docs-as-extensible-variation.md),
  [ADR-0009](./docs/adr/0009-finalize-metadata-contract.md), and
  [ADR-0031](./docs/adr/0031-vocabulary-override.md) for the landed contract.
