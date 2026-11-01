# Changelog fragments

Each change that a user of the toolkit would notice adds **one new file here**.
This folder holds entries, not pages: the docs gates (frontmatter, links,
markdownlint, Vale) leave it out, and it is listed in no index.
Do not edit `## [Unreleased]` in `CHANGELOG.md`. Parallel PRs then never touch
the same lines, so merging one does not put the others into conflict
([ADR-0072](../../adr/0072-parallel-landing-without-shared-files.md)).

## Write a fragment

Name the file `<issue>-<slug>.md`, for example `250-github-alerts-as-asides.md`.
Use `<slug>.md` when there is no issue. Names are lower-case kebab-case.

```markdown
---
section: Added
---

- **GitHub alert blockquotes render as Starlight asides (#250).** Before, a
  `> [!NOTE]` blockquote rendered as a plain quote. Now it renders as the
  matching native aside. See
  [ADR-0068](docs/adr/0068-github-alerts-as-starlight-asides.md).
```

- `section` is one of `Breaking`, `Added`, `Changed`, `Deprecated`, `Removed`,
  `Fixed`, `Security` or `Documentation`. It is the only frontmatter key.
- The body is the entry exactly as it will appear in `CHANGELOG.md`: a `- `
  bullet that opens with a bold lead naming what a reader sees and the issue
  number. Write "Before, … Now, …". Link files relative to the repository
  root (`docs/adr/…`), never with `../`: the entry is read from `CHANGELOG.md`.
- No headings in the body, neither `#` ones nor underlined ones. One fragment
  can hold more than one bullet.
- Within each section the entries run by issue number, lowest first (two
  fragments with one number by name). Fragments without a number follow, by
  name. Merge order never matters.

`pnpm validate:changelog` checks every fragment (CI runs it), and
`pnpm changelog:preview` prints `CHANGELOG.md` with the fragments in place. The
example site shows them as `[Unreleased]` on its release-history page.

## At release time

`pnpm changelog:release <x.y.z>` writes the fragments into a
`## [x.y.z] — <date>` section, moves the compare links and deletes the released
fragments. See [Releasing](../../ops/releasing.md).
