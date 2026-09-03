import { defineCollection } from 'astro:content';
import {
  docKittyDocsSchema,
  docKittyDocsLoader,
  docKittyBibliographySchema,
  docKittyBibliographyLoader,
  docKittyToolsSchema,
  docKittyToolsLoader,
} from '@commondocs-kitty/toolkit/schema';

// The `docs` collection Starlight expects plus the two citation-catalog data
// collections (ADR-0018). The toolkit exports each collection's loader + schema
// so a consumer wires all three in one step; the catalog loaders read
// `docs/_meta/{bibliography,tools}.yaml` and key entries by their `id`.
export const collections = {
  docs: defineCollection({
    // WP04 out-of-map edit (adopter-loader-migration-01M1KKYA #37/#48/#42;
    // recorded per the WP02 review): `indexBasename` here is what actually
    // drives route collapse — the SAME option on `defineDocKittyIntegrations`
    // in astro.config.mjs only reaches the sitemap draft filter. This loader
    // is the routing-authoritative one, so its `indexBasename` MUST match the
    // integration's (config.ts's documented invariant); WP04's `plans/`
    // section (index.md-indexed) needs this to resolve to `/plans/` instead
    // of `/plans/index/`.
    loader: docKittyDocsLoader({ base: 'docs', indexBasename: ['README', 'index'] }),
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
