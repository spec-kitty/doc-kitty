# Contract: `src/lib/internal-env.mjs`

The one owner of DocKitty's internal `process.env` handoffs (#167, ADR-0057).

## Exports

| Export | Contract |
|---|---|
| `DK_INDEX_BASENAME_ENV`, `DK_GHERKIN_RESULTS_ENV`, `DK_GHERKIN_ROUTE_ENV`, `DK_PUBLISH_DRAFTS_RESOLVED_ENV`, `DK_DOCS_ROOT_ENV` | The five names; string values unchanged from before the mission. The only definition of each in `src/`. |
| `INTERNAL_ENV_NAMES` | Frozen array of the five names. Clearing and test restore iterate it. |
| `clearInternalEnv(env = process.env)` | Deletes every listed name. Called as the first statement of `defineDocKittyIntegrations`. |
| `setInternalEnv(name, value, env = process.env)` | Sets a listed name; throws `[dk-config]` for an unlisted name. |
| `deleteInternalEnv(name, env = process.env)` | Deletes a listed name; throws `[dk-config]` for an unlisted name. |

## Invariants

- No imports, no I/O, no module-level copy of any value.
- Readers read `process.env` at call time (Vite SSR evaluates content config and routes in a separate module graph).
- Write times: define (`DK_INDEX_BASENAME`, `DK_GHERKIN_RESULTS`, `DK_DOCS_ROOT`); setup (`DK_GHERKIN_ROUTE` in the fence stage, `DK_PUBLISH_DRAFTS_RESOLVED` in draft publication).
- Old definition sites re-export from this module; never the reverse.
