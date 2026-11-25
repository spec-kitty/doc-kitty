/**
 * `api/subprocessors.json`, injected by the `doc-kitty:subprocessors` integration
 * when the site has a valid `_meta/subprocessors.yaml` (ADR-0086). It renders the
 * catalog the integration checked; it adds no logic of its own.
 */
import type { APIRoute } from 'astro';
import { subprocessorsData } from 'virtual:doc-kitty/subprocessors';
import { renderSubprocessorsApi } from '../subprocessors-render.js';

export const GET: APIRoute = ({ site }) =>
  new Response(renderSubprocessorsApi(subprocessorsData, { site }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
