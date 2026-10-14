# Quickstart: verify the mission locally

```bash
corepack enable && pnpm install --frozen-lockfile
pnpm build:a11y
pnpm exec playwright test tests/a11y/reading-width.spec.ts tests/a11y/layout-geometry.spec.ts --project=light
pnpm test -- layout-css-contract
node src/scripts/assert-chrome-artifacts.mjs example/dist
```

Look at it: `pnpm preview`, open `/doc-kitty/architecture/overview/` at 1920px.
The prose column is 832px; the "Generated surfaces" table is wider and centred on it.

Restore the old width in a consuming site's theme CSS:

```css
:root { --dk-width-content: 45rem; }
```
