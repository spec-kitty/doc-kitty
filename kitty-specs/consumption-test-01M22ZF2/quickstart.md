# Quickstart: Consumption Test + Consumer-Layer Proof

## Run the consumption test locally

From the repo root, one command packs the toolkit, installs the tarball into the
fixture, builds it, and runs the gates:

```sh
node tests/consumption/scripts/run-consumption-test.mjs
```

Expected: `npm pack` produces the `0.1.0` tarball; the fixture installs it (plus
pinned astro/starlight/sitemap peers); `astro build` emits the site + `rss.xml`,
`llms.txt`, `sitemap*.xml`, and the `api/*.json` agent-API; the four portable gate
scripts and `assert-consumer-artifacts.mjs` all pass. Exit 0 means the packaged
toolkit is install-provable against a net-new consumer.

Run the fail-closed self-test on its own:

```sh
pnpm --filter @commondocs-kitty/toolkit exec vitest run tests/consumption/consumption-gap.test.ts
# or the fixture's own test runner, per its package.json
```

## What "green" proves

- **SC-001**: the fixture built from the tarball alone (no toolkit source on its
  resolution path — asserted, INV-1).
- **SC-002**: the consumer's feeds + agent-API exist and are well-formed.
- **SC-003**: the editorial `press` theme's `--dk-*` values (≥5) appear in the built
  CSS/HTML, overriding default/brand.
- **SC-004**: removing an allowlisted file the fixture imports fails the run (self-test).

## How an external adopter reproduces this (the shipped path)

1. `pnpm add @commondocs-kitty/toolkit astro @astrojs/starlight @astrojs/sitemap`
2. `astro.config.mjs`:
   ```js
   import { defineConfig } from 'astro/config';
   import { defineDocKittyIntegrations } from '@commondocs-kitty/toolkit/config';
   import { myTheme } from './src/theme';   // extends a brand or the default
   export default defineConfig({
     site: 'https://you.example', base: '/docs',
     integrations: defineDocKittyIntegrations({
       title: 'My Docs', description: '…', base: '/docs',
       theme: myTheme, markua: true, indexBasename: ['README','index'],
     }),
   });
   ```
3. `src/content.config.ts`: register the `docs`/`bibliography`/`tools` collections from
   `@commondocs-kitty/toolkit/schema` (keep the loader `base` equal to the integration `base`).
4. `src/pages/`: add the `rss.xml.ts`, `llms.txt.ts`, `api/*.json.ts`, and
   `presentations/[...slug].astro` route endpoints from `@commondocs-kitty/toolkit/routes`.
5. A consumer theme: `{ name, extends: <brand-or-undefined>, tokens: { '--dk-*': … },
   customCss: ['./src/theme/mine.css'] }`. Put mode-varying colour in the CSS sheet
   (`:root` + `:root[data-theme='dark']`); never set a `--sl-*` token.
6. `astro build`. Every step above references a **published** toolkit entrypoint or a
   consumer-owned file — no doc-kitty repo-internal paths (SC-005).

The consumer-path guide (`docs/guides/`) is the canonical, maintained version of these
steps, linked from the roadmap "Where we are now" section.
