/**
 * Expected registration order. Update here when an integration is added; the four
 * order tests pin against this one list.
 *
 * The plain path (no theme, diagrams, glossary, markua or gherkin). A literal on
 * purpose: deriving it from `defineDocKittyIntegrations` would make the order
 * assertions tautological.
 */
export const PINNED_INTEGRATION_ORDER: readonly string[] = [
  '@astrojs/starlight',
  'doc-kitty:draft-publication',
  'doc-kitty:route-shaping',
  'doc-kitty:toc-rail',
  'doc-kitty:deck-split',
  'doc-kitty:base-absolute-links',
  '@astrojs/sitemap',
  'doc-kitty:sitemap-order',
  'doc-kitty:manifest',
  'doc-kitty:favicon',
];

/** The same order without the third-party integrations (`doc-kitty:*` only). */
export const PINNED_DOC_KITTY_ORDER: readonly string[] = PINNED_INTEGRATION_ORDER.filter((n) =>
  n.startsWith('doc-kitty:'),
);
