import { defineCollection } from 'astro:content';
import {
  docKittyDocsSchema,
  docKittyDocsLoader,
} from '@commondocs-kitty/toolkit/schema';

// The single `docs` collection Starlight expects. The toolkit's loader reads the
// repo-root `docs/` tree (Common Docs' native location) and applies the
// README-as-index rule; the schema adds the convention's frontmatter.
export const collections = {
  docs: defineCollection({
    loader: docKittyDocsLoader({ base: 'docs' }),
    schema: docKittyDocsSchema(),
  }),
};
