# Contracts: build state and agent-API links

Mission `build-context-and-config-split` (#115, #103). Recorded in ADR-0058.

## `src/lib/build-state.ts`

| Export | Contract |
|---|---|
| `createBuildState()` | A fresh, empty state. `defineDocKittyIntegrations` creates one per call and passes it to the draft-publication integration (writer) and the route-shaping integration (reader). Nothing else holds it, so a second config or a dev-server reload starts empty. |
| `shapingWarningSink()` | The one `globalThis` (`Symbol.for`) channel in the build: route-shaping warnings raised by the render-time middleware, which runs in a second module instance. Per process; cleared at each build's `astro:config:setup`, printed and cleared at `astro:build:done`. |

## `_links` (agent-API index version `'2'`)

| Where | Relations |
|---|---|
| `/api/index.json` top level | `self`, `llms`, `sitemap`; plus `rss`, `bibliography`, `scenarios` when declared. No `pages` (the folder has no index). |
| Each index record | `self` (its per-page JSON, when `links.pages`), `html`, `related: [{ href, title }]` for resolved entries. No `source` (the record's `source` field is already the per-page JSON). |
| `/api/pages/<slug>.json` | `self`, `up` (when `links.index`), `html`, `related`. |

- Hrefs are absolute and base-prefixed, built like `url`.
- `agentIndexRoute({ links })` / `agentPageRoute({ links })` default every optional surface to on; a site passes `false` for one it does not mount.
- Additive keys do not bump the index `version` (DIRECTIVE_018).
