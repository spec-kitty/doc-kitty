# Public surface changed by this mission

## Site options

- `gherkin.allowEmpty?: boolean` (new, default `false`).

## CLI

| Command | Change |
|---|---|
| `dockitty-generate-feature-pages` | new `--allow-empty`. Write mode exits 1 with the FR-002 message when sources are empty, owned pages exist and the flag is absent. `--check` unchanged. |
| `dockitty-check-links` | new `--strict` and `--index-basename <name[,name…]>`. With no flag, a relative `.md`/`.mdx` link is accepted only when it resolves to a published page; otherwise exit 1 with the reason and, where one exists, the route to use. Reference-style links are checked. |

## Build behaviour

- The build stops (integration hook throws) on empty Gherkin sources with owned pages present, unless `gherkin.allowEmpty` is true.
- Glossary hub and context pages are written as `<name>.md` per the target-name rule. A site that lists `index` sees no change.
- The build stops when an authored file occupies a glossary target path.
- Relative `.md`/`.mdx` links in page Markdown are emitted as base-prefixed routes. Other links are unchanged.

## Error message contract (FR-002)

The empty-source failure contains: each configured source directory, the count of pages that would be removed, the phrase naming an uninitialised git submodule as the likely cause, `gherkin.allowEmpty: true` / `--allow-empty`, and the alternative of removing the `gherkin` option to keep the pages frozen.

## Unchanged

- Agent page API `markdown` field (links as written).
- `withBase`, `base-absolute-links` behaviour for root-absolute links.
- `dockitty-assert-no-broken-links`.
- Package `exports`.
