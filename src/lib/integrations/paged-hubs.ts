/** The paged hub listing route integration (#342). Imports nothing from `config.ts`. */
import type { AstroIntegration } from 'astro';

/** The injected route's entrypoint, a package export so a consuming site resolves it. */
export const PAGED_HUB_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/paged-hub';

/** The injected route pattern: listing page N (2 and up) of the hub at `hub`. */
export const PAGED_HUB_PATTERN = '/[...hub]/page/[page]';

/**
 * Inject `/<hub>/page/<n>/` on every site, so a paged hub's listing pages need no
 * page file. Appended unconditionally by `defineDocKittyIntegrations`: a site
 * without a paged hub gets no paths from the route, and builds what it did
 * before. `prerender` keeps the route static when a site sets `output: 'server'`.
 */
export function pagedHubsIntegration(): AstroIntegration {
  return {
    name: 'doc-kitty:paged-hubs',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        injectRoute({ pattern: PAGED_HUB_PATTERN, entrypoint: PAGED_HUB_ENTRYPOINT, prerender: true });
      },
    },
  };
}
