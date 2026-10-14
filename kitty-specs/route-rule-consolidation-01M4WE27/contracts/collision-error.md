# Contract: route collision error message

Applies to: the integration (`astro:config:setup` of the base-absolute-links
integration, `src/lib/config.ts:~470`), `docKittyDocsLoader` (`resolveIds`),
and `dockitty-check-links --strict`. One formatter in `vocabulary-core.mjs`
(`formatRouteCollisions(collisions, { docsDir })`) produces the text for all
three, so the wording cannot drift.

## Format

```
[dk-routes] <N> route collision(s) in <docsDir>: two or more files would be served at the same address.

  /x/
    docs/x/README.md
    docs/x/index.md

  /
    docs/README.md
    docs/index.md

Each address can hold one page. Rename or remove all but one file in each group
(for example rename docs/x/index.md to docs/x/overview.md), or merge their content.
Draft files count: a draft that collides is reported whether drafts are published or not.
```

Rules:

- Paths are shown with the docs folder prefix as the author wrote it
  (`docsDir`), so they can be pasted into a shell.
- Routes are base-less (`/x/`, not `/doc-kitty/x/`).
- Groups are sorted by route (code-unit), paths within a group likewise.
- The fix example names the second path of the first group.
- When a group involves a generated page (glossary or Gherkin), the existing
  ADR-0048 wording is kept for that case and this message is not used twice.

## Exit behaviour

| Surface | Behaviour |
|---------|-----------|
| build / dev / sync | throws `Error` with the message; Astro stops |
| loader alone (no integration) | same throw from `resolveIds` |
| `check-links --strict` | message on stderr, exit code 1, after other findings are printed |
| `check-links` (not strict) | not checked (files are read as on GitHub) |

## Gherkin `index.feature` (FR-006)

```
[dk-gherkin] reserved output name: features/x/index.feature maps to behaviour/x/index.md,
which the site serves at its folder's address (/behaviour/x/). Rename the feature file.
```

Raised for a leaf slug of `index` on any index-name setting, and for a leaf in
the configured names (existing rule, `generate.mjs:245`).
