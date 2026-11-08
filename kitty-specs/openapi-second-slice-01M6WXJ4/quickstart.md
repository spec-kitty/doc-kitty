# Quickstart: verify the second slice

```bash
corepack enable && pnpm install
pnpm --filter example build            # two spec versions in example/astro.config
pnpm assert:openapi
jq '[.pages[] | select(.tags|index("openapi"))] | length' example/dist/api/index.json   # = versions
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-seam.test.ts tests/openapi-agent-entries.test.ts
( cd src && ./node_modules/.bin/vitest run --root ../tests/consumption openapi-optin.test.ts )
pnpm validate:docs
pnpm test:a11y -- openapi
DOCKITTY_OFFLINE=1 pnpm --filter example build   # warm cache, 0 requests
```

Check: sha256 in `/api/pages/reference/api/<label>.json` equals the `.sha256` sidecar; unreleased pages lack `data-pagefind-body` and sitemap entries; `astro dev` serves the raw document URLs.
