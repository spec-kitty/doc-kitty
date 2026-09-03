# Quickstart — Adopter loader & migration

How a migrating adopter uses each capability once this mission lands. (doc-kitty's own defaults are unchanged; you opt in.)

## 1 · Keep your `index.md` section indexes

You already name section landing pages `index.md`. Point the toolkit at your tree and set the basename once:

```js
// astro.config — toolkit loader options
docKittyDocsLoader({ indexBasename: 'index' })
```

- `guides/index.md` → `/guides/` (owns the section slug).
- No `README.md` renames, no link rewrites.
- If a folder has both `README.md` and `index.md`, the configured basename wins and you get a warning about the other.

## 2 · Rename a section folder to your vocabulary

Say your governance calls them missions, not features. Rename the folder and describe it in the registry — no toolkit code changes:

```yaml
# docs/_meta/sections.yaml
sections:
  - id: plans
    type: Plan
    subtypes:
      - match: missions      # was: features
        type: Mission
```

Then:
1. `git mv docs/plans/features docs/plans/missions`
2. Update the `subtypes[].match` (above).
3. Add redirects for the old URLs (step 3).

Result: pages under `plans/missions/` derive `Mission`; routes regenerate; the sidebar group still renders; `related:` links stay resolved.

## 3 · Don't serve a single 404 on cutover

Before the move, capture the URLs that must keep resolving:

```
# example/url-baseline.txt (committed)
/plans/features/foo/
/plans/features/bar/
```

Declare redirects for anything whose URL changed:

```js
// astro.config
redirects: {
  '/plans/features/foo/': '/plans/missions/foo/',
  '/plans/features/bar/': '/plans/missions/bar/',
}
```

Run the gate in CI:

```
node src/scripts/check-redirect-coverage.mjs example/url-baseline.txt dist
```

- **Passes** when every baselined URL resolves or redirects to a live page.
- **Fails** (naming the URL) when one is uncovered — or when a redirect points at a page that itself 404s.

## Verifying the whole thing

`pnpm test` (toolkit + parity twins) · `pnpm build && node src/scripts/assert-build-artifacts.mjs` · `node src/scripts/check-links.mjs` · the redirect-coverage gate. All green on the default corpus with the new capabilities added.
