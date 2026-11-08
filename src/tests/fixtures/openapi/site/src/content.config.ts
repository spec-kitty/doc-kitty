import { defineCollection } from 'astro:content';
import { docKittyDocsLoader, docKittyDocsSchema } from '@spec-kitty/doc-toolkit/schema';

export const collections = {
  docs: defineCollection({ loader: docKittyDocsLoader({ base: 'docs' }), schema: docKittyDocsSchema() }),
};
