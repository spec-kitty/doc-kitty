import { defineCollection } from 'astro:content';
import {
  docKittyDocsSchema,
  docKittyDocsLoader,
  docKittyBibliographySchema,
  docKittyBibliographyLoader,
  docKittyToolsSchema,
  docKittyToolsLoader,
} from '@spec-kitty/doc-toolkit/schema';

// The `docs` collection Starlight expects plus the two citation-catalog data
// collections (ADR-0018). The toolkit exports each collection's loader + schema
// so a consumer wires all three in one step; the catalog loaders read
// `docs/_meta/{bibliography,tools}.yaml` and key entries by their `id`.
export const collections = {
  docs: defineCollection({
    // The index names (`README` and `index`) are set once, in
    // `defineDocKittyIntegrations` in astro.config.mjs; the loader reads them
    // from there (FR-007).
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
