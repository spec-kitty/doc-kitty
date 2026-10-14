# Data model

Only the option shapes and internal values that change. Everything else stays as ADR-0055 defines it.

## `gherkin.results` (extended)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `report` | relative POSIX path | — | The Cucumber report (Messages NDJSON or JSON). |
| `root` | relative POSIX path | `'.'` | The directory Cucumber ran in. |
| `required` | boolean | unset (treated as `true`) | **New.** When unset or `true`, a missing report fails the build if `CI` is set. When `false`, it only ever warns. |

`NormalizedGherkinResults` gains `required?: boolean`, present only when it was given. The string form leaves it unset.

## `sidebar` (new top-level `defineDocKittyIntegrations` option)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `indexLabel` | non-blank string | unset | The label of a group's index entry. It wins over the UI string. |

## Route-shaping virtual module data (`virtual:doc-kitty/route-shaping`)

Adds `indexLabel?: string`, copied from `sidebar.indexLabel`.

## UI string

`dockitty.sidebar.indexLabel`. The `en` value is `Overview`, injected by the `doc-kitty:i18n` Starlight plugin.

## Process env bridges (internal)

| Name | Set by | Read by |
|---|---|---|
| `DK_GHERKIN_RESULTS_ENV` (existing) | config.ts | the docs loader; **now also** `scenarioIndexRoute` (FR-008) |
| `DK_GHERKIN_INDEX_ROUTE` (new) | config.ts, hand-mounted branch only; cleared otherwise | `scenarioIndexRoute`, which uses it to name the route file in the warning |

## Derived

`isCiEnv(raw: string | undefined): boolean` returns true when `raw` trimmed and lower-cased is non-empty and not `false` or `0`.
