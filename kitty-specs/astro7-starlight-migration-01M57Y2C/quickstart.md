# Quickstart (verification)

pnpm install --frozen-lockfile
pnpm build                     # example site
pnpm assert:artifacts
node src/scripts/assert-chrome-artifacts.mjs
pnpm -C src test               # vitest
pnpm exec playwright test      # a11y / visual (PLAYWRIGHT_BROWSERS_PATH may need the local headless shell)
# consumption: pack src/, install into tests/consumption/consumer-fixture, build (mirrors .github/workflows/consumption-test.yml)
