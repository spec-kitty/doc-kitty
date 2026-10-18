# Data model: OKF alignment and content graph

## Actor

```
actor   := human | tool | process
human   := "human:" id
process := "process:" id
tool    := name "/" version          ; name matches [a-z0-9][a-z0-9-]*, version is a non-empty run of non-space characters
id      := [A-Za-z0-9._-]+
```

An email address (`x@y`) is accepted on `authors` with a warning that suggests `human:<local-part>`. The export rewrites any email it finds to `human:<local-part>`. Owner: `vocabulary-core.mjs` `parseActor()` / `isActor()`.

## Instant

`YYYY-MM-DDTHH:MM:SSZ` (canonical; fractional seconds allowed). A date-only `YYYY-MM-DD` is read as `T00:00:00Z` with `dateOnly: true`, which the doc-sanity gate warns on. The rule applies to `updated`, `stale_after`, `generated.at` and `verified[].at`. Owner: `normaliseInstant()`.

## Generated stamp

```yaml
generated:
  by: doc-kitty-gherkin/0.3.0     # actor, <producer>/<toolkit version from src/package.json>
  at: 2026-10-18T09:30:00Z        # stable unless content_hash changes
  content_hash: sha256:0123456789ab
```

Producers: `doc-kitty-gherkin`, `doc-kitty-glossary`, `doc-kitty-scaffold`. Detection: `by` starts with `<producer>/`. Owner: `generator-stamp.mjs`.

## `verified`

Either a list of `{by: actor, at: instant}` or one bare mapping. The graph and the export normalise it to a list.

## `doc_status` → OKF `status`

The canonical vocabulary is `STATUSES` in `vocabulary-core.mjs:159`.

| `doc_status` | `status` |
|---|---|
| `draft` | `draft` (excluded from the graph and export anyway) |
| `active` | `stable` |
| `deprecated` | `deprecated` |
| `superseded` | `deprecated` |
| absent | `stable` |
| charter-added value | `stable` (default; total) |

Owner: `okfStatusOf()`. A test enumerates `STATUSES`.

## Content graph (`api/content-graph.json`)

```jsonc
{
  "schema": "dockitty.content-graph/1",
  "okf_version": "0.2",
  "generatedFrom": "doc-kitty",
  "nodes": [ /* sorted by id, compareCodeUnit */ ],
  "edges": [ /* sorted by (source, rel, target) */ ]
}
```

### Node

| field | source | notes |
|---|---|---|
| `id` | bundle path without `.md` (pages and personas, which are pages); `catalog:<key>`; `resource:<uri>` | unique |
| `kind` | `page` \| `persona` \| `catalog` \| `resource` | DocKitty |
| `type`, `title`, `description`, `resource`, `tags` | frontmatter | OKF names |
| `status` | `okfStatusOf(doc_status)` | OKF |
| `generated` | `{by, at, content_hash?}`; for authored pages `at` = `updated` | OKF |
| `verified` | normalised list | OKF |
| `stale_after`, `sources` | frontmatter | OKF |
| `doc_status`, `doc_kind`, `section`, `href`, `authors`, `updated` | DocKitty | `doc_kind` is the frontmatter `kind` |

Absent optional fields are omitted. Object keys are written in a fixed order.

### Edge

`{ id, source, target, rel, note? }`. `id = source + "|" + rel + "|" + target`. The `rel` values are:

| rel | from | to | resolver |
|---|---|---|---|
| `related` | page | page | `resolveRelated` (`metadata.ts:558`) |
| `audience` | page | persona page | `resolveProfile` (:602) |
| `cites` | page | `catalog:<key>` or external URL target | `resolveCitation` (:647) |
| `in-section` | page | its section index page | route table and `sectionOf` |
| `derived-from` | page | page or `resource:<uri>` | `sources[].resource` |

Duplicates collapse by `id`. Drafts are dropped through `draftRoutesOf`, along with every edge that touches one.

## Export file mapping

| source | export |
|---|---|
| `<dir>/<page>.md` (published) | `<dir>/<page>.md`: frontmatter `type`, `title`, `description`, `status`, `generated{by,at,content_hash}`, `authors` (actors), `tags`, `resource`, `verified`, `stale_after`, `sources`; body = source body + generated relation sections |
| bundle-root index (`README.md`) | `index.md`: frontmatter exactly `okf_version: "0.2"`; body = §8 entry list |
| section index (`README.md`/`index.md`) | `<dir>/index.md` with no frontmatter and a §8 entry list (`- [title](/path.md): description`), plus `<dir>/_index.meta.yaml` (original frontmatter) |
| `log.md` | copied verbatim |
| draft | absent |

`generated.by` falls back to the existing `by`, then the first author, then `process:dockitty-export`. `generated.at` falls back to the existing `at`, then `updated` (FR-025).

Relation sections are appended in a fixed order: `## Related`, `## Audience`, `## References`, `## Derived from`. Each list is sorted by target. A section with no entries is not written.
