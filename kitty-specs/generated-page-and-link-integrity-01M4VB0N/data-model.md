# Data model

No persisted data. Three in-memory shapes matter.

## Route table

Built from the shared walk's list of docs-relative file paths, the site's index names, and the file paths of drafts that are not published.

| Field | Meaning |
|---|---|
| `routes` | plain object: docs-relative file path (POSIX separators, as on disk) → root-absolute route (`/adr/0001-x/`, `/` for the root index) |

Invariants:
- Plain JSON only (no `Map`, `Set`, function), so it can be a plugin option and take part in Astro's config digest.
- Keys are sorted by code unit before serialising, so two builds of one tree give identical bytes.
- A file absent from the table is not a published page: not Markdown, a demoted duplicate has its own route, an unpublished draft has none.
- Where a folder holds two index-named files, the table follows the loader: one collapses to the folder route, the other keeps a route of its own.

## Link resolution

Input: source file path (docs-relative), href as written. Output: route with the original `?query` and `#fragment` appended, or nothing.

Resolves to nothing when the href is not relative, does not end in `.md`/`.mdx` before any query or fragment, leaves the docs root, or names a file absent from the route table. The path is URL-decoded before lookup; lookup is case-sensitive.

## Gherkin options (extended)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `allowEmpty` | boolean | `false` | allow an empty source set to remove generated pages |

Any other type is rejected at validation.

## Glossary target name

`index` when the normalised index names include it (compared case-insensitively), otherwise the first normalised index name.
