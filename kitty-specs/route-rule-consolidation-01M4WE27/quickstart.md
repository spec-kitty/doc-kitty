# Quickstart: index names after 0.3.0

## Set index names once

In `astro.config.mjs`:

```js
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';

export default defineConfig({
  integrations: defineDocKittyIntegrations({
    title: 'My docs',
    indexBasename: ['README', 'index'], // omit for the default, 'README'
  }),
});
```

In `src/content.config.ts`, call the loader without `indexBasename`:

```ts
docs: defineCollection({
  loader: docKittyDocsLoader({ base: 'docs' }),
  schema: docKittyDocsSchema(),
}),
```

Run the link check with no `--index-basename` flag. It reads the names from
`astro.config.mjs` and prints where they came from:

```
$ npx dockitty-check-links docs --strict
index names: README,index (from astro.config.mjs)
```

## Upgrading from 0.2.x

1. Remove `indexBasename` from `docKittyDocsLoader(...)`. If you set it only
   there, move the value to `defineDocKittyIntegrations`. Leaving a different
   value in the loader now stops the build.
2. Remove `--index-basename` from your `dockitty-check-links` scripts. A flag
   that disagrees with the config now fails the check. The check's default
   changed from `README,index` to `README`, the same as the build.
3. Build once. If two files share an address (for example `guide/README.md` and
   `guide/index.md`, or `page.md` and `page.mdx`), the build lists them. Rename
   or remove one of each pair.
4. Markdown under any `_meta/` folder, or named `_meta.md`, is no longer
   published. Move pages you want published out of `_meta/`.
5. A Gherkin file named `index.feature` is rejected; rename it.

## What else changes on your site

- Feeds, `llms.txt`, related links, the Hub, the scenario index and the agent
  API list a folder's `index.md` at the folder address (`/guide/`), not
  `/guide/index/`.
- A folder whose index page is a draft next to a published `index.md` now shows
  the published page's title in the sidebar.
- A glossary term inside a reference-style link (`[term][ref]`) is no longer
  wrapped in a second link.
