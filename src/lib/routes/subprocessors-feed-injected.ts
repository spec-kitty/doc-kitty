/**
 * `subprocessors.xml`, the sub-processor change feed, injected by the
 * `doc-kitty:subprocessors` integration when the site has a valid
 * `_meta/subprocessors.yaml` (ADR-0086). It renders the catalog the integration
 * checked; it adds no logic of its own.
 */
import type { APIRoute } from 'astro';
import { subprocessorsData } from 'virtual:doc-kitty/subprocessors';
import { renderSubprocessorsFeed } from '../subprocessors-render.js';

export const GET: APIRoute = ({ site }) =>
  new Response(renderSubprocessorsFeed(subprocessorsData, { site, siteTitle: subprocessorsData.siteTitle }), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
