# Contract: missing report and CI (FR-006)

`CI` is read once in `astro:config:setup`. "CI is set" means `process.env.CI`, trimmed and lower-cased, is non-empty and not `false` or `0`.

| Report | CI set | `required` | Outcome |
|---|---|---|---|
| missing | no | any | warn: `[dk-gherkin] gherkin.results report not found: <report>; scenarios render without results`. The build continues. |
| missing | yes | unset / `true` | **throw**: `[dk-gherkin] gherkin.results report not found: <report> (CI is set; set gherkin.results.required: false to build without results)` |
| missing | yes | `false` | warn (same text as the first row) |
| present but unreadable, empty, over the cap or malformed | any | any | throw as today (unchanged) |
| present, all steps skipped | any | any | warn as today (unchanged) |

Validation: `required` must be a boolean, otherwise `[dk-gherkin] gherkin.results.required must be a boolean`. `scenarioIndexRoute({ results })` accepts the key and ignores it.
