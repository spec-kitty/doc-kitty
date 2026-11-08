// @ts-check
/*
 * The OpenAPI fixtures' Astro config (mission openapi-second-slice-01M6WXJ4,
 * WP01). The helper in `src/tests/helpers/openapi-build.ts` copies it into each
 * build's root under `example/.dk-test-openapi/<key>/`, so its imports resolve
 * the way an adopter's do (through `example/node_modules`).
 *
 * It takes, like the chrome fixture's config:
 *
 *  - `DK_TEST_OPTIONS`, a JSON object spread over the doc-kitty options below.
 *    Its `openapi` key is the option minus `renderer`, which this config
 *    injects — the adopter's own import of the pinned renderer.
 *  - `DK_OUTDIR`, the output folder relative to the build's root.
 *
 * The sitemap, the content-graph route and the OKF export come with
 * `defineDocKittyIntegrations` itself, so a fixture site gets every surface the
 * seam suites assert over without listing them here.
 */
import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';
import starlightOpenAPI from 'starlight-openapi';

const { openapi = null, ...options } = {
  title: 'OpenAPI fixture',
  description: 'The site the OpenAPI seam suites build.',
  ...JSON.parse(process.env.DK_TEST_OPTIONS ?? '{}'),
};

export default defineConfig({
  site: 'https://docs.example.test',
  base: options.base ?? '/',
  ...(process.env.DK_OUTDIR ? { outDir: `./${process.env.DK_OUTDIR}` } : {}),
  integrations: defineDocKittyIntegrations({
    ...options,
    ...(openapi === null ? {} : { openapi: { renderer: starlightOpenAPI, ...openapi } }),
  }),
});
