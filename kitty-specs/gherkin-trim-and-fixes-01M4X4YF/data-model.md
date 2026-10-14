# Data model: Gherkin test trim and fixes

## Hub (generated `kind: Hub` page)

| Field | Value |
|-------|-------|
| `title` | `titles[<source-relative dir>]` when set, else the humanised directory name; the section root takes the registry label |
| `description` | `Behaviour specifications for <title>, generated from Gherkin feature files.` (root: the hub intro) |
| `kind` | `Hub` |
| `doc_status` | `active` when at least one non-draft feature lies below the directory (the root is always `active`); otherwise `draft` |
| `generated.by` / `generated.at` | unchanged (`doc-kitty/gherkin`, hash of the sorted child list) |

State rule: a hub is `draft` exactly when every feature below it is a draft.
Publishing one feature below it makes it `active` and makes its parent list it.

Listing rule (unchanged): a hub lists only published children; a draft hub is
never listed by any hub.

## Titles map (`gherkin.titles`)

- Type: plain object, `string → string`.
- Key: POSIX directory path relative to a source root; no empty, `.` or `..`
  segment; no leading `/`, drive letter, scheme or `\`.
- Value: non-blank string, used verbatim (escaped where Markdown needs it).
- Requires `sources`. Unknown key (no directory holding a feature) → warning.

## Status shorthand

- `@wip` → `doc_status: draft`; `@deprecated` → `doc_status: deprecated` (exact match).
- Case-only near miss (`@WIP`, `@Deprecated`, ...) → warning; tag kept as a page tag.

## Scenario-index advertisement

- Advertised: `llms.txt` has a line starting `Scenario index: `.
- Present: `api/scenarios.json` exists in the build output.
- Advertised and not present → build error.
