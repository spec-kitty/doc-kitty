# AGENTS.md

Guidance for AI agents working in this repository.

## Documentation

All documentation about this toolkit is in `docs/`, written in the **Common Docs
— Kitty Variation**. Always start at [`docs/README.md`](./docs/README.md).

| Section | Path | Contains |
|---------|------|----------|
| Domain & product context | `docs/context/` | The convention spec, product, glossary |
| System design | `docs/architecture/` | How the toolkit works |
| Decision log | `docs/adr/` | Immutable record of architectural decisions |
| How-to guides | `docs/guides/` | Authoring docs, adopting the toolkit |

When unsure about the documentation convention, read
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
  section index and carries frontmatter; every non-index file needs
  `title`, `description`, `status`, `updated`, `type`.
