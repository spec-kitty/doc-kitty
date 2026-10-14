// @ts-check
import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';
// WP02: the editorial/press CONSUMER theme (Layer 3), extending the shipped brand.
import { pressTheme } from './src/theme/index.ts';

// A net-new consumer docsite that wires the toolkit ONLY through its published
// `exports` (mirrors `example/astro.config.mjs`), but consumes the PACKED
// `file:./toolkit.tgz` — never the workspace symlink. It stands in for a real
// external adopter's config, so nothing here reaches into the toolkit's `src/`.
//
// A non-root `base` is deliberate: it exercises the toolkit's base-prefix seam
// (base-absolute-links rehype plugin, discovery-head hrefs, feed absolute URLs),
// the same surface a based GitHub-Pages deployment hits.
const SITE = 'https://consumer.example.com';
const BASE = '/consumer-fixture';

export default defineConfig({
  site: SITE,
  base: BASE,
  integrations: defineDocKittyIntegrations({
    title: 'Consumer Fixture',
    description: 'A clean-room consumer docsite built from the packed @spec-kitty/doc-toolkit tarball.',
    // MUST equal the site `base` above (config invariant, config.ts line ~99):
    // the sitemap draft filter strips this prefix to compare routes anchored.
    base: BASE,
    // WP02: layer the editorial/press CONSUMER theme (Layer 3), proving reuse at
    // N=2 (default → brand → consumer) through the tarball's public surface only.
    theme: pressTheme,
    // Markua ON, diagrams OFF (no PlantUML/Chromium in CI — research D5).
    markua: true,
    diagrams: false,
    // In-page Gherkin (ADR-0051) from the tarball: `guides/scenarios.md` holds a
    // ```gherkin fence and a ::gherkin include of `scenarios/…`. No `sources`, so
    // no generated feature pages and an empty /api/scenarios.json.
    gherkin: { includeRoots: ['scenarios'] },
  }),
});
