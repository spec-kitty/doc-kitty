import { defineCollection } from 'astro:content';
import {
  docKittyBibliographyLoader,
  docKittyBibliographySchema,
  docKittyDocsLoader,
  docKittyDocsSchema,
  docKittyToolsLoader,
  docKittyToolsSchema,
} from '@spec-kitty/doc-toolkit/schema';

export const collections = {
  docs: defineCollection({ loader: docKittyDocsLoader({ base: 'docs' }), schema: docKittyDocsSchema() }),
  bibliography: defineCollection({ loader: docKittyBibliographyLoader(), schema: docKittyBibliographySchema() }),
  tools: defineCollection({ loader: docKittyToolsLoader(), schema: docKittyToolsSchema() }),
};
