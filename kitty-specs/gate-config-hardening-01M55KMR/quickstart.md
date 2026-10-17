# Quickstart: verifying Gate config hardening

```bash
pnpm --filter example build
node src/scripts/assert-build-artifacts.mjs                 # evaluates example/astro.config.mjs
node src/scripts/assert-build-artifacts.mjs --env-dir false # skips evaluation
node src/scripts/assert-build-artifacts.mjs --index-path api/index.json
cd src && node_modules/.bin/vitest run tests/draft-publication.test.ts tests/agent-links-gating.test.ts tests/config-invariants.test.ts tests/sitemap-feeds.test.ts
```

To check that the site is byte-identical, build the example on `main` and on the branch, then run `diff -r` on the two dists. Expect 0 differences.
