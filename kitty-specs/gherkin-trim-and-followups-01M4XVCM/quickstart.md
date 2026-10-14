# Quickstart (adopters)

## Translate the sidebar "Overview" label

Add the key to each locale's Starlight UI strings, for example `src/content/i18n/fr.json`:

```json
{ "dockitty.sidebar.indexLabel": "Aperçu" }
```

A locale without the key shows the default locale's value (English: "Overview").

## Set one label for every locale

```js
defineDocKittyIntegrations({ sidebar: { indexLabel: 'Start here' } });
```

The option wins over translations. Prev/next links keep showing the page title.

## Scenario results in CI

- Produce the Cucumber report in the CI job before `astro build`, and point `gherkin.results` at it. Do not commit the report.
- Locally, a missing report only warns. In CI (`CI` set and not `false` or `0`; GitHub Actions sets `CI=true`), a missing report **fails the build**.
- A CI job that builds without tests (for example a preview deploy) opts out:

```js
gherkin: { results: { report: 'reports/cucumber.ndjson', required: false } }
```

- If you hand-mount `src/pages/api/scenarios.json.ts`, pass the same `results` to `scenarioIndexRoute`. Otherwise the build warns once and the index carries no results.
- Only statuses are published. Failure messages, stack traces and attachments never appear on the site.
