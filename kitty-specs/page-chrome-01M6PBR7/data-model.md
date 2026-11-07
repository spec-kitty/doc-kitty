# Data model: Page chrome

No stored data. These are build-time values.

## ServedSurfaces

| Field | Type | Source |
|---|---|---|
| `llms` | boolean | Route `/llms.txt` |
| `agentIndex` | boolean | Route `/api/index.json` |
| `agentPages` | boolean | Route `/api/pages/[...slug].json` |
| `rss` | boolean | Route `/rss.xml` |
| `bibliography` | boolean | Route `/api/bibliography.json` |
| `scenarios` | boolean | Route `/api/scenarios.json` |
| `contentGraph` | boolean | Route `/api/content-graph.json`; the type is `boolean`, as for the other routes |
| `sitemap` | boolean | `config.site` is set |
| `okf` | true | Always added |
| `pageAtom` | boolean | Injected unless turned off |

Invariant: a link to a surface renders only if its field is true.

## PageFormatLink

`{ label, href, type?, rel }`, derived from the entry and ServedSurfaces. It is base-aware.

Invariants:

- A draft page yields no links.
- A page outside the docs collection yields no links.
- Footer and head output come from the same list.

## RepositorySettings

`{ provider: 'github' | 'gitlab' | 'bitbucket', repo: string, branch: string, siteDir?: string }`

Invariant: all required fields are present, or config evaluation throws.

## IconRef

`fa-<name>` or a bare Starlight name. Invariant: resolves at build time, or the build fails naming the page or section.

## Disclosure state

`details.open` is the only state for blocks and groups. It starts closed unless the site opts out, and no block state is stored. A sidebar group's state follows Starlight's existing session persistence.
