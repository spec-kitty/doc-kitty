/**
 * The FULL registered order, every opt-in seam on: diagrams, directive owner
 * (glossary or markua), markua, glossary, gherkin codegen, gherkin fence stage,
 * then Starlight and the always-on tail. Update here when an integration is
 * added; the order tests pin against this one list. A literal on purpose:
 * deriving it from `defineDocKittyIntegrations` would make the order assertions
 * tautological.
 */
export const PINNED_FULL_INTEGRATION_ORDER: readonly string[] = [
  'doc-kitty:diagrams',
  'doc-kitty:remark-directive',
  'doc-kitty:markua',
  'doc-kitty:glossary',
  'doc-kitty:gherkin',
  'doc-kitty:gherkin-fence',
  '@astrojs/starlight',
  'doc-kitty:draft-publication',
  'doc-kitty:route-shaping',
  'doc-kitty:toc-rail',
  'doc-kitty:content-graph',
  'doc-kitty:deck-split',
  'doc-kitty:base-absolute-links',
  '@astrojs/sitemap',
  'doc-kitty:sitemap-order',
  'doc-kitty:manifest',
  'doc-kitty:favicon',
];

/** The opt-in seams registered BEFORE Starlight, each absent on the plain path. */
const OPT_IN_SEAMS: readonly string[] = [
  'doc-kitty:diagrams',
  'doc-kitty:remark-directive',
  'doc-kitty:markua',
  'doc-kitty:glossary',
  'doc-kitty:gherkin',
  'doc-kitty:gherkin-fence',
];

/**
 * The plain path (no theme, diagrams, glossary, markua or gherkin): the full
 * order minus the opt-in seams.
 */
export const PINNED_INTEGRATION_ORDER: readonly string[] = PINNED_FULL_INTEGRATION_ORDER.filter(
  (n) => !OPT_IN_SEAMS.includes(n),
);

/** The same order without the third-party integrations (`doc-kitty:*` only). */
export const PINNED_DOC_KITTY_ORDER: readonly string[] = PINNED_INTEGRATION_ORDER.filter((n) =>
  n.startsWith('doc-kitty:'),
);
