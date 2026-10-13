// @ts-check
/*
 * Astro config for `header-carrier.test.ts` (FR-024). It builds the EXAMPLE
 * site's pages (`astro build --root example --config <this file>`) with one
 * difference from `example/astro.config.mjs`: the theme also fills the
 * `dk:site-header` slot with the fixture header next to this file. Building the
 * same pages is what pairs the replacement test with the neutrality test.
 *
 * The options below repeat the example's, because that config does not export
 * them. If the example gains an option its pages need, repeat it here.
 */
import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';
import { specKittyTheme } from '@spec-kitty/doc-toolkit/themes/spec-kitty/index.ts';

const BASE = '/doc-kitty';
const EXAMPLE = new URL('../../../../example/', import.meta.url);

const REDIRECTS = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync(new URL('redirects.json', EXAMPLE), 'utf8'))).map(
    ([from, to]) => [from, `${BASE}${to}`],
  ),
);

export default defineConfig({
  site: 'https://spec-kitty.github.io',
  base: BASE,
  outDir: `./${process.env.DK_OUTDIR}`,
  redirects: REDIRECTS,
  integrations: defineDocKittyIntegrations({
    title: 'DocKitty Example',
    description: 'A minimal docsite built with DocKitty.',
    base: BASE,
    social: { github: 'https://github.com/spec-kitty/doc-kitty' },
    // The consumer layer over the brand: one slot, addressed by absolute path
    // (a theme inside a package would use its package-export specifier).
    theme: {
      extends: specKittyTheme,
      slots: { 'dk:site-header': fileURLToPath(new URL('./SiteHeader.astro', import.meta.url)) },
    },
    diagrams: true,
    markua: true,
    indexBasename: ['README', 'index'],
  }),
});
