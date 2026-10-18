# Contract: OKF export

## CLI

```
dockitty-export-okf [--graph <dist>/api/content-graph.json] [--docs <docsDir>]
                    [--out ./okf-export] [--index-basename README[,index]] [--check]
```

- `--graph`: the built graph. Default `./dist/api/content-graph.json`. If the file is missing, the command builds nothing and exits 2 with a hint to run the site build first.
- `--docs`: the source tree. Default from the site config (`findSiteRoot`), else `./docs`.
- `--out`: the target directory. It is emptied before writing.
- `--check`: run the §11 conformance checker on `--out` (or on an existing bundle when given `--out` alone with `--check-only`). Exit 1 on a violation, listing each `path: rule`.
- Exit codes: 0 ok, 1 conformance violation, 2 usage or missing input.

Build output: the `astro:build:done` hook calls the same core with `graph = dist/api/content-graph.json` and `out = dist/okf/`.

## Output layout

```
okf/
├── index.md                 # root: frontmatter exactly `okf_version: "0.2"`, §8 entry list
├── <section>/
│   ├── index.md             # no frontmatter, §8 entry list
│   ├── _index.meta.yaml     # original index frontmatter (sorted keys)
│   └── <page>.md            # OKF concept
└── log.md                   # only if present in source, copied verbatim
```

Only graph nodes of kind `page` or `persona` are written, so drafts are absent.

## Concept rewriting

- Frontmatter: see the mapping in `data-model.md`. Keys are written in a fixed order, and `type` is non-empty (falls back to the section's expected type).
- Body: the source body, then the relation sections (`## Related`, `## Audience`, `## References`, `## Derived from`), each an alphabetically sorted list of `- [title](/path.md)` or an external `[title](https://…)`. A section with no entries is not written.
- Links are `/`-prefixed bundle paths ending in `.md` (OKF §6.1). Note: the OKF reference viewer skips them; see the export guide (FR-020).

## Conformance rules (checker, FR-026)

1. Every non-reserved `.md` has parseable frontmatter with a non-empty `type`.
2. A non-root `index.md` has no frontmatter.
3. The root `index.md` frontmatter is exactly `okf_version: "0.2"`.
4. Every `index.md` body is a §8 entry list (lines `- [text](link)` with an optional ` - description` (OKF §8; the checker also accepts `:` and `—`), headings allowed).
5. (Extra, SC-003) The page-to-page body links equal the graph edges with `rel` in {related, audience, derived-from} where the target is a page.

Reserved names: `index.md`, `log.md`.

## Determinism

Files are written in `compareCodeUnit` path order. Line endings are LF with a trailing newline, and nothing depends on time. Two exports of the same input produce identical bytes.
