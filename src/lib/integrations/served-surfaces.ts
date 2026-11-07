/** The always-on served-surface detection (FR-002). Imports nothing from `config.ts`. */
import type { AstroIntegration } from 'astro';
import { DK_SERVED_SURFACES_ENV, setInternalEnv } from '../internal-env.mjs';
import { detectServedSurfaces } from '../served-surfaces.js';

/**
 * Publish {@link detectServedSurfaces} for the site's resolved routes.
 *
 * A build resolves routes before `astro:config:done`, and dev and sync after it, so
 * each hook publishes with what the other has recorded. Either way the value is
 * final before anything renders. `astro:routes:resolved` fires again in dev when
 * routes change, and in a real build a second time from content sync's temporary
 * server (the logged order is routes:resolved, config:done, routes:resolved,
 * build:start): each overwrites the value rather than adding to it.
 */
export function servedSurfacesIntegration(): AstroIntegration {
  let patterns: string[] | undefined;
  let siteConfigured = false;
  const publish = () => {
    if (patterns) setInternalEnv(DK_SERVED_SURFACES_ENV, JSON.stringify(detectServedSurfaces(patterns, siteConfigured)));
  };
  return {
    name: 'doc-kitty:served-surfaces',
    hooks: {
      'astro:routes:resolved': ({ routes }) => {
        // A redirect at a surface's path serves no such surface.
        patterns = routes.filter((route) => route.type !== 'redirect').map((route) => route.pattern);
        publish();
      },
      'astro:config:done': ({ config }) => {
        siteConfigured = Boolean(config.site);
        publish();
      },
    },
  };
}
