# Data model: Gherkin authoring aids and Specification layout

There is no persistent storage. The "data" is configuration, the in-memory
feature view, and generated frontmatter.

## FolderDefaultMap (`gherkin.defaultGlossaryContext`)

| Field | Type | Rules |
|---|---|---|
| key | string | A relative POSIX directory path under a source (`shipping`, `shipping/eu`). No leading `/`, no `..`, no `\`, not empty, not `__proto__` (stored via `defineProperty`). Case-sensitive, as written |
| value | string | A glossary context name. Not blank after trim |

- **Invariant**: requires `gherkin.sources`. Without it the configuration throws.
- **Lookup**: for a feature with `relPath` `a/b/c.feature`, try keys `a/b`, then
  `a`, and take the first hit (longest prefix by segment). A key never matches a
  partial segment.
- **Warnings**: a key that matches no directory containing a feature warns once,
  as `titles` does.

## Context resolution (per generated page)

```
tagContext = first non-empty @dk:context value (existing rule)
folderContext = FolderDefaultMap lookup(relPath)
glossary_context = tagContext ?? folderContext ?? (absent)
origin = tag | map(key) | none
```

- An empty `@dk:context=` still warns as today, and resolution falls through to
  `folderContext`.
- When `knownContexts` is provided (build only) and `glossary_context` is
  present but not in the set, one warning names the file, the context and its
  origin.

## StepView (additive fields)

| Field | Type | Notes |
|---|---|---|
| line | number | Source line of the step (1-based, within the parsed text; fences add `lineOffset`) |
| keywordType | `'context' \| 'action' \| 'outcome' \| 'unknown'` | `And`, `But` and `*` inherit the previous step's type in the same section; Background starts its own chain |

The existing fields (`keyword`, `text`, `segments`, arguments) are unchanged.
Rendered output must not change.

## ImperativeLintRules (`gherkin.lint.imperativeSteps`)

| Form | Meaning |
|---|---|
| `false` or absent | Off (default) |
| `true` | Default list, keyword types `['context', 'action']` |
| `{ verbs?: string[], extend?: string[], keywords?: KeywordType[] }` | `verbs` replaces the default list; `extend` appends to the effective list; `keywords` replaces the scope |

- **Validation**: unknown keys are refused. Each entry must be a non-blank
  string, and each keyword must be in the enum. An empty effective list is an
  error. `verbs` and `extend` may both be given.
- **Selector signal**: always on when the lint is on; not configurable in v1.
- **Language**: only `en` and `en-*` features are linted.

## Suppression

`@dk:allow=imperative` on a Feature, Rule, Scenario or Outline suppresses lint
warnings for every step beneath it. An unknown value warns.

## Specification page (render model, read-only)

| Source (frontmatter) | Card element |
|---|---|
| `tags` | Text chip list, omitted when empty |
| `sources[0]` | "View source" link (or plain text without a URL prefix), omitted when absent |
| `doc_status === 'draft'` | Draft notice, rendered by the shared carrier for every kind (not by the card) |
