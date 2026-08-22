# Contract — build-example artifact assertions

**Producer**: `assert-build-artifacts.mjs` run after `astro build` in build-example.

## Preconditions
- `example/dist/` exists after a clean build.

## Assertions (all must hold; any failure → non-zero exit → lane red)
| Target | Check |
|---|---|
| `sitemap*.xml` | present, non-empty, parses as XML |
| `rss.xml` | present, parses as XML |
| `llms.txt` | present, non-empty |
| agent index JSON | valid JSON; has the expected top-level shape; entry count matches today's example content |
| README-as-index | a section `README.md` is served at its directory route |
| known page | at least one known content page rendered to HTML |

## Scope note
Assertions target **today's** example output. Metadata-model chrome (M1) is out of
scope; do not assert M1 shapes.

## Acceptance (maps to spec)
- FR-011, FR-010, SC-010; US2.10 (missing/malformed artifact → red).
