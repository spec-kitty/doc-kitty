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
 *      and sets each entry's authored icon on the shaped tree;
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
import { sidebarIcons } from 'virtual:doc-kitty/sidebar-icons';
import {
  decorateSidebarIcons,
  expandCappedGroups,
  relabelledLinks,
  resolveCappedLabel,
  resolveIndexLabel,
  shapePagination,
  shapeSidebar,
  shapeToc,
  shapingWarningSink,
} from './route-shaping.js';
import { slugFromEntryId } from './metadata.js';

const directoryMeta = new Map(routeShaping.directoryMeta);
// The hubs over their sidebar child cap (#341). Empty on a site with no large hub,
// and then every step below runs exactly as it did before the cap existed.
const hubCaps = new Map(routeShaping.hubCaps);
const iconMaps = { links: new Map(sidebarIcons.links), groups: new Map(sidebarIcons.groups) };

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;

  if (routeShaping.shapeSidebar) {
    const currentSlug = slugFromEntryId(route.id);
    const translate = context.locals.t as (key: string) => unknown;
    const { sidebar, warnings } = shapeSidebar(route.sidebar, directoryMeta, {
      base: routeShaping.base,
      unpublishedDirs: routeShaping.unpublishedDirs,
      collapse: routeShaping.collapse,
      annotate: routeShaping.annotate,
      indexLabel: resolveIndexLabel(routeShaping.indexLabel, translate),
      ...(hubCaps.size > 0
        ? { hubCaps, currentSlug, cappedLabel: (count: number) => resolveCappedLabel(count, routeShaping.cappedLabel, translate) }
        : {}),
    });
    // Collected, not printed: every page shapes the same tree, and the
    // integration reports the set once when the build finishes.
    const sink = shapingWarningSink();
    for (const warning of warnings) sink.add(warning);

    // `prev`/`next` front matter left unset means "follow the sidebar".
    const { prev, next } = route.entry.data;
    const follows = {
      prev: routeShaping.pagination && prev === undefined,
      next: routeShaping.pagination && next === undefined,
    };
    // A capped hub's children are not in the shaped sidebar, so prev/next walk a copy
    // where they are, in the hub's order (the shaped tree itself when nothing is capped).
    route.pagination = shapePagination(route.sidebar, expandCappedGroups(sidebar, hubCaps, currentSlug), route.pagination, follows);
    // Handed on for a later middleware that rebuilds prev/next from the shaped sidebar
    // (the OpenAPI renderer's, which runs after this one on every page): the relabelled
    // links, and with a capped hub what it needs to put the hub order back (#341).
    context.locals.dkRelabelled = relabelledLinks(route.sidebar, sidebar);
    if (hubCaps.size > 0) context.locals.dkHubOrder = { hubCaps, currentSlug, follows, pagination: route.pagination };
    route.sidebar = decorateSidebarIcons(sidebar, iconMaps, routeShaping.base);
  }

  route.toc = shapeToc(route.toc);
});
