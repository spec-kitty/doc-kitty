# Quickstart: verifying page chrome

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm assert:artifacts && pnpm assert:no-broken-links
# WP11 adds one script that builds every dist Playwright serves
pnpm test:a11y
```

Then, in `example/dist/`:

1. A deep page's HTML has `<details open>` only on its own branch.
2. `behaviour/shipping/index.html` has `dk-hub` before `dk-panel--related`.
3. A page's footer lists JSON, OKF and Atom, and each href exists in `dist/`.
4. `api/pages/<slug>.atom.xml` parses as an Atom entry.
