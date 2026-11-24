/**
 * The paged hub listing route (#342): where it is mounted and from which file.
 * Injected by the route-shaping integration, and only when the site has a paged
 * hub: the route's module graph would otherwise change how Vite splits every
 * site's CSS, and a site without a paged hub must build exactly as before.
 */

/** The injected route's entrypoint, a package export so a consuming site resolves it. */
export const PAGED_HUB_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/paged-hub';

/** The injected route pattern: listing page N (2 and up) of the hub at `hub`. */
export const PAGED_HUB_PATTERN = '/[...hub]/page/[page]';

/** The route as `injectRoute` takes it. `prerender` keeps it static under `output: 'server'`. */
export const PAGED_HUB_ROUTE = { pattern: PAGED_HUB_PATTERN, entrypoint: PAGED_HUB_ENTRYPOINT, prerender: true } as const;
