/** Public API for `@commondocs-kitty/toolkit`. */

// Config preset
export { defineDocKittyIntegrations } from './lib/config.js';
export type { DocKittyOptions } from './lib/config.js';

// Schema + README-as-index loader
export {
  docKittyDocsSchema,
  docKittyDocsLoader,
  docKittyFields,
  expectedTypeForPath,
  expectedTypeForPathInRoot,
} from './lib/schema.js';
export type { DocKittyLoaderOptions } from './lib/schema.js';

// Route handlers
export {
  rssRoute,
  llmsTxtRoute,
  agentIndexRoute,
  agentPageRoute,
} from './lib/routes/index.js';

// Metadata model + helpers
export * from './lib/metadata.js';
