/**
 * The toolkit's Starlight route-data middleware (T022; research R5/R7).
 *
 * Registered by `defineDocKittyIntegrations` as the package-export specifier
 * `@spec-kitty/doc-toolkit/route-middleware`, ahead of any middleware the
 * consumer lists under `starlight.routeMiddleware` (C-004: the consumer runs
 * after and has the last word). For each Starlight page it:
 *
 *   1. shapes the sidebar — group labels and order from index pages, each index
 *      first — and re-derives prev/next to match; skipped when the consumer
 *      supplied their own `sidebar`;
 *   2. drops a table of contents that would hold one entry or fewer, so no rail
 *      is reserved for it.
 *
 * All the logic is in the pure `route-shaping` module. This file only wires it
 * to the build: the directory metadata arrives through the
 * `virtual:doc-kitty/route-shaping` module that `config.ts` serves (the same
 * transport `manifest.ts` uses for slot components), read once at module scope;
 * its ambient types are in `route-shaping-module.d.ts`.
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { routeShaping } from 'virtual:doc-kitty/route-shaping';
import { shapePagination, shapeSidebar, shapeToc, shapingWarningSink } from './route-shaping.js';

const directoryMeta = new Map(routeShaping.directoryMeta);

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;

  if (routeShaping.shapeSidebar) {
    const { sidebar, warnings } = shapeSidebar(route.sidebar, directoryMeta, {
      base: routeShaping.base,
      unpublishedDirs: routeShaping.unpublishedDirs,
    });
    // Collected, not printed: every page shapes the same tree, and the
    // integration reports the set once when the build finishes.
    const sink = shapingWarningSink();
    for (const warning of warnings) sink.add(warning);

    // `prev`/`next` front matter left unset means "follow the sidebar".
    const { prev, next } = route.entry.data;
    route.pagination = shapePagination(route.sidebar, sidebar, route.pagination, {
      prev: routeShaping.pagination && prev === undefined,
      next: routeShaping.pagination && next === undefined,
    });
    route.sidebar = sidebar;
  }

  route.toc = shapeToc(route.toc);
});
