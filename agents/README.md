# Agent Skills

Minimal, portable agent skills for operating on a **Common Docs — Kitty
Variation** `docs/` tree. They mirror the upstream
[common-docs skills](https://github.com/velvet-tiger/common-docs/tree/main/skills)
and extend them with the Kitty twists (README-as-index with frontmatter, root
`docs/`, the `agent` frontmatter extension) and the toolkit's builder scripts.

> **Status / direction.** These are deliberately minimal. They capture and
> enhance the upstream approach *before* we mint our own doctrine. They will be
> recast as Spec Kitty **charter/doctrine** artifacts later; keep them small and
> convention-faithful until then.

## Skills

| Skill | Purpose |
|-------|---------|
| [`doc-kitty-scaffold`](./doc-kitty-scaffold/SKILL.md) | Create the standard `docs/` structure (section dirs + stub files with correct frontmatter). |
| [`doc-kitty-write`](./doc-kitty-write/SKILL.md) | Write substantive content for one `docs/` file, meeting the convention's requirements. |
| [`doc-kitty-find`](./doc-kitty-find/SKILL.md) | Locate the right `docs/` file (or the gap) for a question, using metadata and the agent-API. |
| [`doc-kitty-convert`](./doc-kitty-convert/SKILL.md) | Convert a vanilla Common Docs tree (or ad-hoc docs) into the Kitty Variation. |

## Actor convention

When a skill writes or regenerates a file, it stamps `generated: { by:
agent/<skill-name>, at: <ISO8601> }` — e.g. `agent/doc-kitty-scaffold`. Humans
identify as `human:<id>`. This matches OKF's actor convention.

## Shared reference

All skills treat [`../docs/context/convention.md`](../docs/context/convention.md)
as the source of truth, and use the toolkit scripts in
[`../src/scripts`](../src/scripts):

- `scaffold.mjs` — emit the tree
- `new-doc.mjs` — one page with correct frontmatter
- `validate-frontmatter.mjs` — the CI gate
