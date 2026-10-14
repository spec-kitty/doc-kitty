# Contract: hand-mounted scenario route without results (FR-008)

Conditions: `gherkin.results` is configured, **and** the site mounts its own `src/pages/api/scenarios.json.*` endpoint, **and** that endpoint calls `scenarioIndexRoute(options)` with no `options.results`.

Output: **one** warning per build (console, `[dk-gherkin]` prefix):

```
[dk-gherkin] <route file> calls scenarioIndexRoute() without `results` while gherkin.results is set; api/scenarios.json will carry no results. Pass { results: '<report>' } (the same value as gherkin.results).
```

`<route file>` is the detected path relative to the project root, or `src/pages/api/scenarios.json` when it cannot be detected. `<report>` is the configured report path.

There is no warning when the route passes `results`, when `gherkin.results` is not set, or for the injected route.
