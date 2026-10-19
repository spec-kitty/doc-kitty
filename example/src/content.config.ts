import { defineCollection } from 'astro:content';
import {
  docKittyDocsSchema,
  docKittyDocsLoader,
  docKittyBibliographySchema,
  docKittyBibliographyLoader,
  docKittyToolsSchema,
  docKittyToolsLoader,
} from '@spec-kitty/doc-toolkit/schema';
import { fileURLToPath } from 'node:url';
import { withRepoChangelog } from './changelog-loader';

// The `docs` collection Starlight expects plus the two citation-catalog data
// collections (ADR-0018). The toolkit exports each collection's loader + schema
// so a consumer wires all three in one step; the catalog loaders read
// `docs/_meta/{bibliography,tools}.yaml` and key entries by their `id`.
export const collections = {
  docs: defineCollection({
    // The index names (`README` and `index`) are set once, in
    // `defineDocKittyIntegrations` in astro.config.mjs; the loader reads them
    // from there (FR-007).
    //
    // `changelog/releases` shows the repository's CHANGELOG.md, rendered at
    // build time, so the release history has one source (#192).
    loader: withRepoChangelog(docKittyDocsLoader({ base: 'docs' }), {
      changelogPath: fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url)),
      entryId: 'changelog/releases',
      repoBlobBase: 'https://github.com/spec-kitty/doc-kitty/blob/main/',
      repoRawBase: 'https://raw.githubusercontent.com/spec-kitty/doc-kitty/main/',
    }),
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
