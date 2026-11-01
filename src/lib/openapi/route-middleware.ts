/**
 * Route-data middleware for the OpenAPI reference pages (WP03). Registered by the
 * `openapi` option's Starlight plugin. On a reference page it puts the version nav on
 * `Astro.locals.dkOpenApi`, where the `PageTitle` carrier renders it; elsewhere it
 * does nothing. The logic is `resolveOpenApiNav` in `adapters.ts`. On EVERY page it also gives
 * prev/next their page titles back: the renderer rebuilds them from the shaped sidebar (#112).
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { openApi } from 'virtual:doc-kitty/openapi';
import { restorePaginationTitles } from '../route-shaping.js';
import { resolveOpenApiNav } from './adapters.js';

const baseUrl = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';

export const onRequest = defineRouteMiddleware((context) => {
  // The renderer's own middleware ran just before this one and rebuilt prev/next from the
  // shaped sidebar, which shows a section index as "Overview"; prev/next name the page.
  const { dkRelabelled, starlightRoute } = context.locals;
  if (dkRelabelled) starlightRoute.pagination = restorePaginationTitles(starlightRoute.pagination, dkRelabelled);
  const nav = resolveOpenApiNav(context.url.pathname, baseUrl, openApi);
  if (nav) context.locals.dkOpenApi = nav;
});
