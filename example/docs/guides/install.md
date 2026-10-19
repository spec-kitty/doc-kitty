---
title: Install the toolkit
description: Install @spec-kitty/doc-toolkit 0.4.0 from GitHub Packages with its Astro 7 and Starlight 0.42 peers, wire it into a new site, and build it.
doc_status: active
updated: 2026-10-19T00:00:00Z
type: Guide
kind: How-To
tags: [setup, install, consumer, release]
related:
  - guides/getting-started
  - changelog/releases
---

# Install the toolkit

This guide is for a project that **uses** DocKitty: you want your own
documentation site built from the published `@spec-kitty/doc-toolkit` package.
It covers release 0.4.0. Every step matches the consumption-test fixture that CI
builds from the packed package on every change, and a test keeps this page in
line with that fixture and with the package's declared requirements.

Upgrading a site from toolkit 0.3? Read the
[0.3 to 0.4 migration guide](https://github.com/spec-kitty/doc-kitty/blob/main/docs/migrations/0.3-to-0.4.md)
first: 0.4.0 moves to Astro 7 and Starlight 0.42 and removes what 0.3.0
deprecated.

## What you need

- **Node `>=22.22.0`**, the toolkit's `engines.node` floor, locally and in
  every CI job that builds the site.
- **pnpm** (`corepack enable`).
- **A GitHub token with the `read:packages` scope.** The toolkit is published
  to the GitHub Packages npm registry, which never serves a package anonymously.

The toolkit declares these peers. Your project installs them:

| Peer | Range the toolkit accepts |
| --- | --- |
| `astro` | `>=7.2.10 <8` |
| `@astrojs/starlight` | `>=0.42.0 <0.43.0` |
| `@astrojs/markdown-remark` | `>=7.3.0 <8` |

## 1. Point the `@spec-kitty` scope at GitHub Packages

Two `.npmrc` files, because pnpm expands `${GITHUB_TOKEN}` only in the
user-level one. The project file holds no secret; commit it:

```ini
# <project>/.npmrc — commit this
@spec-kitty:registry=https://npm.pkg.github.com
```

```ini
# ~/.npmrc — the credential; never commit this
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

In GitHub Actions, use `actions/setup-node` with
`registry-url: https://npm.pkg.github.com` and `scope: '@spec-kitty'`, pass the
workflow token as `NODE_AUTH_TOKEN`, and grant `permissions: packages: read`.

## 2. Install the toolkit and its peers

```sh
pnpm add @spec-kitty/doc-toolkit@0.4.0 astro@^7.4.0 @astrojs/starlight@^0.42.6 @astrojs/markdown-remark@^7.3.3
```

`@astrojs/sitemap` comes with the toolkit as a regular dependency, so you do
not add it yourself.

A `401 Unauthorized` usually means the `_authToken` line sits in the project
`.npmrc` (pnpm ignores it there), the token lacks `read:packages`, or your
account cannot read the package.

## 3. Wire the integrations in `astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';

const SITE = 'https://you.example.com';
const BASE = '/docs'; // drop `base` when you deploy at the domain root

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: defineDocKittyIntegrations({
    title: 'My Docs',
    description: 'What this documentation set is.',
    base: BASE, // must equal the `base` above
    markua: true,
  }),
});
```

Do not set `markdown.processor` yourself: the toolkit sets it, and remark or
rehype plugins you add through `markdown.remarkPlugins` keep working.

## 4. Declare the collections in `src/content.config.ts`

```ts
import { defineCollection } from 'astro:content';
import {
  docKittyDocsSchema,
  docKittyDocsLoader,
  docKittyBibliographySchema,
  docKittyBibliographyLoader,
  docKittyToolsSchema,
  docKittyToolsLoader,
} from '@spec-kitty/doc-toolkit/schema';

export const collections = {
  docs: defineCollection({
    loader: docKittyDocsLoader({ base: 'docs' }),
    schema: docKittyDocsSchema(),
  }),
  bibliography: defineCollection({
    loader: docKittyBibliographyLoader(),
    schema: docKittyBibliographySchema(),
  }),
  tools: defineCollection({
    loader: docKittyToolsLoader(),
    schema: docKittyToolsSchema(),
  }),
};
```

## 5. Build

Add a `docs/README.md` with frontmatter (`title`, `description`, `doc_status`,
`updated`, `type`, `kind`), then:

```sh
pnpm astro build
```

The build writes your pages plus `sitemap.xml`, `rss.xml`, `llms.txt` and the
`/api/*.json` agent API.

## Next

- The full [consumer setup guide](https://github.com/spec-kitty/doc-kitty/blob/main/docs/guides/consumer-setup.md)
  covers theming, diagrams, Gherkin feature pages and the optional settings.
- The [release history](/changelog/releases/) lists what changed in each
  release.
