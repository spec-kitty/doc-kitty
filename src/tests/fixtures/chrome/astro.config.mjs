// @ts-check
/*
 * The chrome fixture's Astro config (page-chrome WP11). The harness copies it
 * into each build's root under `example/.dk-test-chrome/`, so its imports resolve
 * as an adopter's do. It takes:
 *
 *  - `DK_TEST_OPTIONS`, a JSON object spread over the options below. Later suites
 *    pass, for example, `{"sidebar":{"titleIsIndex":true}}`. `"theme": null` builds
 *    with no theme, and `"site": null` with no `site`.
 *  - `DK_OUTDIR`, the output folder relative to the build's root.
 *
 * The base options repeat the example's, because that config does not export them,
 * without OpenAPI, Gherkin and diagrams, so builds and captures stay small. The
 * base path matches `tests/a11y/serve-dist.mjs`, which mounts every dist under it.
 */
import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';
import { specKittyTheme } from '@spec-kitty/doc-toolkit/themes/spec-kitty/index.ts';

const BASE = '/doc-kitty';
const { site = 'https://spec-kitty.github.io', theme = specKittyTheme, ...options } = {
  title: 'Chrome fixture',
  description: 'The frozen site the page-chrome suites build.',
  base: BASE,
  social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/spec-kitty/doc-kitty' }],
  markua: true,
  githubAlerts: true,
  indexBasename: ['README', 'index'],
  ...JSON.parse(process.env.DK_TEST_OPTIONS ?? '{}'),
};

// `sidebar.titleIsIndex` and `sidebar.collapsed` arrive with this mission's WP01.
// `defineDocKittyIntegrations` rejects unknown `sidebar` keys until then, so a build
// asking for one builds without it and says so. This stops applying by itself the
// moment the toolkit accepts the key, and any other unknown key still throws.
function integrations(resolved) {
  try {
    return defineDocKittyIntegrations(resolved);
  } catch (error) {
    const pending = /unknown key "(titleIsIndex|collapsed)" under sidebar/.exec(String(error))?.[1];
    if (!pending) throw error;
    console.warn(`[dk-test-chrome] the toolkit has no sidebar.${pending} yet: building without it`);
    const { [pending]: _dropped, ...sidebar } = resolved.sidebar;
    return integrations({ ...resolved, sidebar: Object.keys(sidebar).length ? sidebar : undefined });
  }
}

export default defineConfig({
  ...(site === null ? {} : { site }),
  base: options.base,
  ...(process.env.DK_OUTDIR ? { outDir: `./${process.env.DK_OUTDIR}` } : {}),
  integrations: integrations({ ...options, theme: theme ?? undefined }),
});
