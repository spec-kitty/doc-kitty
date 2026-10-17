# Research: Gate config hardening

The research comes from the pre-spec grounding squad and the post-spec squad, both on main a76c5563.

## R1 — How to evaluate the config from a gate (#173)
- **Decision:** reuse `site-index-names.mjs`'s child-process Vite `runnerImport(configPath, { configFile: false })`, which has a per-path cache, a timeout, and throws "could not load". Extract it into one shared `evaluateSiteConfig(root|configPath)`.
- **Rationale:** it is already proven by `check-links`. It follows imports, so a base config in another file is honoured. It needs no new dependency.
- **Alternatives:**
  - Astro `resolveConfig` plus running the hooks. Rejected: it is a private API and the hooks have side effects. This is the `updateConfig` limit.
  - Keep the text search. Rejected: it is fail-open.

## R2 — Failure policy
- **Decision:** a config that exists but throws or times out makes the gate exit 2. `--env-dir` skips evaluation. With no config, behaviour is unchanged. The operator made this call.

## R3 — The index-path source (#172)
- **Decision:** an `--index-path` flag only, relative to dist. `indexPath` is a route-module option (`src/pages/api/index.json.ts`), so evaluating the config cannot see it. The operator rejected discovery from built output.

## R4 — The home of `sitemapDraftFilter` (#174)
- **Decision:** `integrations/route-shaping.ts`, re-exported from `./config`, with helpers imported from `draft-publication`/`route-shaping`, never `../config`.

## Contested findings disposition
All ten post-spec findings were folded into spec rev 2 (commit 104548c). None were dropped.
