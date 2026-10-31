---
title: "ADR-0068: A configurable ADR id, and a frontmatter status fallback"
description: A charter axis chooses how an ADR id is read from its file name (a date-seq preset or a regex); status and date fall back to frontmatter. NNNN- stays the default.
doc_status: active
updated: 2026-10-31T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0032-adr-index-generation
  - adr/0042-native-documentation-charter
  - adr/0035-vocabulary-core-consolidation
  - context/convention
---

# ADR-0068: A configurable ADR id, and a frontmatter status fallback

## Status

Accepted (2026-10-31). Extends [ADR-0032](./0032-adr-index-generation.md): the
ADR index and the ADR hub cards still share one extractor; that extractor now
reads the id rule from the charter and falls back to frontmatter for the status
and the date.

## Context

One extractor, `extractAdrMeta`, gives every ADR its number, status and date.
The generated ADR index (`generate-adr-index.mjs`) and the `kind: Hub` ADR
cards (`selectAdrHubCards`) both use it, so the two cannot disagree. It read:

- the number from `^(\d{4})-` on the file name;
- the status from the body `## Status` section only;
- the date from frontmatter `updated` only.

The spec-kitty docsite is moving onto DocKitty (spec-kitty/spec-kitty#6100,
issue #248). It has 234 ADRs in era folders (`adr/1.x/` to `adr/4.x/`), named
`YYYY-MM-DD-N-slug.md`. Their frontmatter is `{title, description, status,
date}`, and only 5 have a body `## Status` section. With the old extractor,
every ADR's number is its year, the hub order collapses, and 229 cards show no
status. The ADRs are immutable, and renaming them would change about 234
published URLs, so the fix has to be in DocKitty.

## Decision

### 1. The ADR id rule is a charter axis, `adr.id`

A docs tree chooses the rule in `docs/_meta/charter.yaml`:

```yaml
adr:
  id:
    preset: date-seq         # or: pattern: '^(?<id>adr-\d+)-'
```

- **`preset`** names a built-in rule. `nnnn` is the default, `/^(\d{4})-/`,
  byte for byte the old pattern. `date-seq` reads `YYYY-MM-DD-N`: the id is
  `2026-03-09-1`.
- **`pattern`** is a regular expression with a named group `id`. It may also
  have a `date` group and a `seq` group, which only affect ordering.
- The rule is matched against the **lowercased** file name, without its
  extension. The generator sees the file name and the hub sees the route slug,
  which Starlight lowercases; matching both lowercased makes them read the same
  id. A pattern is therefore written in lowercase. The default matches only
  digits and `-`, so lowercasing changes nothing for it.
- Exactly one of the two. An unknown preset, a pattern without an `id` group,
  a pattern that does not compile, or an unknown key fails closed with a
  message naming the charter file. This happens when the charter loader reads
  the file, so the frontmatter gate, the generator and the build all fail the
  same way.

The charter, not an `astro.config` option, because both sides must read the
same value. The generator is a bare-Node CLI that never loads `astro.config`,
and `Hub.astro` already reads `docs/_meta` for the section registry. The
charter is the docs tree's own governance file
([ADR-0042](./0042-native-documentation-charter.md)), and the ADR naming
scheme belongs to the tree.

The generator finds the charter in the parent of `--dir` (`docs/adr` →
`docs`), or in `--docs-root` when given. The hub reads `<cwd>/docs`, the same
root it uses for the section registry.

### 2. Ordering follows the id

ADRs sort by the `date` group (code-unit order), then the `seq` group as a
number (`-2` before `-10`), then the id (code-unit order). A rule without
`date` and `seq` groups, the default included, sorts by the id alone, exactly
as before. Both the generator and the hub sort with the same comparator,
`compareAdrIds`.

### 3. Status: the body first, then frontmatter

When the body has a `## Status` section, it is the status, as before, even if
the section is empty. Only when the body has **no** `## Status` section is the
frontmatter `status` used, reduced by the same token rule (`**`/backticks
stripped, up to the first `.`, `—` or space). A non-string frontmatter
`status` is ignored.

### 4. Date: `updated`, then `date`

The date is frontmatter `updated`; when it is absent, frontmatter `date`. Both
are UTC-sliced to `YYYY-MM-DD`. `updated` stays required by the frontmatter
gate unless the charter relaxes it (`required_fields.optional: [updated]`); the
fallback only affects what the index and the hub show.

### 5. The build schema declares `status` and `date`

The docs collection schema drops undeclared keys, so the hub never saw a
frontmatter `status` or `date`. Both are now declared as `unknown`, optional.
They are lenient on purpose: a page that set either key built before, and must
still build.

### 6. `superseded_by` is not rendered

The issue lists rendering `superseded_by` as a link as optional. It is left out.
Its value format in the consumer corpus is not fixed (a file name, an id or a
slug), so a link built from it could point at the wrong page. A hub card is one
link, so a second link would need a separate element. This can be added later
without changing anything decided here.

## Consequences

### Positive

- A date-named corpus gets real ids, a date-then-sequence order and its
  frontmatter status, with no change to the ADR files.
- The generated index and the hub still use one extractor and one comparator,
  so they match one to one.
- A tree without the axis is unchanged: same ids, same order, same table
  (pinned by a test over this repository's own ADR index).

### Negative

- The hub reads the charter at `<cwd>/docs`, like the section registry does. A
  site whose docs are elsewhere gets the default rule on its hub, while the
  generator, given `--docs-root`, uses the charter. This is the existing
  limitation of the section registry, not a new one.
- A frontmatter `status` on a non-ADR page is now kept in the collection data.
  Nothing else reads it.

### Risks

- A corpus whose ADRs also lack `doc_status` still gets no hub cards: the
  schema defaults `doc_status` to `draft`, and a hub lists only published
  pages. That is the draft rule, unchanged here; the consumer has to supply
  `doc_status`.

## Alternatives considered

### An `astro.config` option on `defineDocKittyIntegrations`

Rejected: the generator would have to evaluate the site config to read it, as
the index-name resolver does. That adds a second channel and a timeout to a
CLI that today reads only the docs tree.

### A heuristic that recognises date-named files automatically

Rejected: a file that happens to start with a date would change id silently,
and the `NNNN-` default could no longer be pinned byte for byte.

### Falling back to frontmatter when the body `## Status` is empty

Rejected: the issue says the body section stays the primary source. An empty
section is an authored section, and the old extractor showed it as blank.

## References

- Issue #248; consumer spec-kitty/spec-kitty#6100.
- [ADR-0032](./0032-adr-index-generation.md) — the generated ADR index.
- [ADR-0042](./0042-native-documentation-charter.md) — the documentation charter.
