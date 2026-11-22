# Data model: TOM classification and measures catalog

## Classification entry (page frontmatter)

| Field | Type | Required | Rule |
|---|---|---|---|
| (bare form) | string | — | A measure id; normalises to `{ measure: <id>, scope: system }` |
| `measure` | string | yes (object form) | Non-empty measure id |
| `scope` | `system` \| `organisation` | no | Default `system` |
| `note` | string | no | Free text; carried verbatim |

Invariants:

- Every `measure` resolves in the effective catalog, or the build fails naming the page and the id.
- The same measure listed twice with the same scope collapses to one edge. Listed twice with different scopes, it is an error.

## Measure record (catalog file)

| Field | Type | Required | Rule |
|---|---|---|---|
| `id` | string | yes | Kebab case, unique in the file |
| `label` | string | yes | Non-empty |
| `nature` | `technical` \| `organisational` \| `legal` \| `physical` | yes | Closed set |
| `frameworks` | list of `{ framework, ref }` | yes | At least one; both strings non-empty |
| `dpv` | string | no | An absolute IRI when present |

Invariants:

- The file is a YAML list of records. Anything else is a catalog error.
- A consumer file replaces the default wholesale. An empty list is valid and resolves nothing.

## Effective catalog

`consumer file present ? consumer file : shipped default`. It is computed once per surface per build.

## Graph additions

- Measure node: `{ id: "catalog:measure:<id>", kind: "catalog", title, url?, measure: { nature, frameworks } }`. It is emitted only when at least one published page has an edge to it.
- Edge: `{ id: "<page>|classified-as|catalog:measure:<id>", source, target, rel: "classified-as", scope, note? }`.
