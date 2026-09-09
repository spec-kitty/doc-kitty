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
// collections (ADR-0018), wired from the toolkit's public `/schema` export —
// identical shape to `example/src/content.config.ts`. Consuming these from the
// installed tarball is part of the clean-room proof: a missing `lib/schema.ts`
// in the `files` allowlist would fail resolution here (fail-closed, C-2).
export const collections = {
  docs: defineCollection({
    // Routing-authoritative `indexBasename` (config.ts invariant): MUST match the
    // `indexBasename` passed to `defineDocKittyIntegrations` in astro.config.mjs.
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
