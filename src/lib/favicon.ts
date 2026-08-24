// Theme favicon delivery (FR-009 asset forwarding, self-containment side).
//
// Starlight's `favicon` option is NOT a module specifier: its value is emitted
// verbatim into `<link rel="icon" href>` (base-prefixed by Starlight) and must
// therefore already be a path the site serves. A theme, however, wants to carry
// its OWN mark as a package asset — `assets.favicon` in the Spec Kitty brand is
// `@commondocs-kitty/toolkit/themes/spec-kitty/assets/favicon.svg` — so that a
// rebrand needs no consumer wiring (FR-010).
//
// Handing that specifier straight to Starlight is what produced the live 404
// `/doc-kitty/@commondocs-kitty/toolkit/themes/spec-kitty/assets/favicon.svg`,
// which Lighthouse counts as a console error and which failed the nightly
// smoke's `errors-in-console <= 0` assertion on every run.
//
// This module closes that gap: `faviconHref` maps a specifier to ONE stable
// site-root path, and `docKittyFavicon` resolves the specifier and emits the
// file at that path — served from memory in dev, copied into `dist/` at build.
// The logo/socialImage path is unaffected: those ride Astro's asset pipeline via
// real `import`s (see `lib/manifest.ts`), a mechanism `favicon` cannot use
// because Starlight needs its value at CONFIG time, before Vite exists.

import { copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/**
 * Basename of the emitted favicon, without extension. Deliberately `dk-`
 * prefixed so it can never collide with a consumer's own `public/favicon.svg`
 * (which stays reachable — a theme that wants it just declares `/favicon.svg`).
 */
export const DK_FAVICON_BASENAME = 'dk-theme-favicon';

/** Extensions Starlight can derive a MIME type for; anything else falls back. */
const KNOWN_EXTENSIONS = new Set(['.svg', '.ico', '.png', '.gif', '.jpg', '.jpeg']);

/**
 * The value Starlight should receive for a theme's declared `assets.favicon`.
 *
 * - `undefined` → `undefined` (no theme favicon; Starlight keeps its default).
 * - a site-root path (`/favicon.svg`) → passed through untouched: the consumer
 *   already ships that file in `public/`, so there is nothing to emit.
 * - anything else (a bare package specifier or a relative path) → the single
 *   emitted path `/dk-theme-favicon<ext>`, keeping the source extension so
 *   Starlight derives the right `type` attribute.
 */
export function faviconHref(favicon: string | undefined): string | undefined {
  if (!favicon) return undefined;
  if (favicon.startsWith('/')) return favicon;
  const ext = path.extname(favicon).toLowerCase();
  return `/${DK_FAVICON_BASENAME}${KNOWN_EXTENSIONS.has(ext) ? ext : '.svg'}`;
}

/** Options seam — `resolveFrom` is overridable so the unit test can point
 * resolution at a fixture package instead of the real workspace. */
export interface FaviconIntegrationOptions {
  /** Module URL to resolve the specifier against. Defaults to this module. */
  resolveFrom?: string;
}

/** Resolve a favicon specifier to an absolute file path, or null if unresolvable. */
function resolveFaviconFile(favicon: string, resolveFrom: string): string | null {
  try {
    return createRequire(resolveFrom).resolve(favicon);
  } catch {
    // Not a resolvable module specifier — try it as a path on disk (a theme may
    // legitimately declare a project-relative file).
    try {
      const abs = path.resolve(path.dirname(fileURLToPath(resolveFrom)), favicon);
      readFileSync(abs);
      return abs;
    } catch {
      return null;
    }
  }
}

/**
 * The integration that makes a theme's package-asset favicon actually servable.
 *
 * Build: copies the resolved file into the output root as
 * `dk-theme-favicon<ext>`, matching `faviconHref`. Dev: a Vite middleware serves
 * the same path (base-aware) so `astro dev` shows the branded mark too.
 *
 * A favicon that cannot be resolved WARNS rather than throwing — a missing brand
 * mark must not take down an otherwise healthy build; the nightly smoke is what
 * catches the resulting 404.
 */
export function docKittyFavicon(
  favicon: string | undefined,
  { resolveFrom = import.meta.url }: FaviconIntegrationOptions,
  base = '/',
): AstroIntegration {
  const href = faviconHref(favicon);
  // Nothing to emit when there is no theme favicon, or when the theme points at
  // a path the consumer's `public/` already serves.
  const emitting = Boolean(favicon) && href !== favicon;
  const fileName = href ? href.slice(1) : '';
  const devPath = `${base}/${fileName}`.replace(/\/{2,}/g, '/');

  return {
    name: 'doc-kitty:favicon',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        if (!emitting) return;
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'doc-kitty:favicon-dev',
                configureServer(server: {
                  middlewares: {
                    use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void;
                  };
                }) {
                  server.middlewares.use((req, res, next) => {
                    const url = (req as { url?: string }).url ?? '';
                    if (url.split('?')[0] !== devPath) return next();
                    const file = resolveFaviconFile(favicon!, resolveFrom);
                    if (!file) return next();
                    const response = res as {
                      setHeader: (k: string, v: string) => void;
                      end: (body: Buffer) => void;
                    };
                    response.setHeader('Content-Type', mimeFor(fileName));
                    response.end(readFileSync(file));
                  });
                },
              },
            ],
          },
        });
      },
      'astro:build:done': ({ dir, logger }) => {
        if (!emitting) return;
        const file = resolveFaviconFile(favicon!, resolveFrom);
        if (!file) {
          logger.warn(
            `theme favicon '${favicon}' could not be resolved — no favicon emitted, ` +
              `so ${href} will 404. Declare a resolvable specifier or a public/ path.`,
          );
          return;
        }
        copyFileSync(file, path.join(fileURLToPath(dir), fileName));
      },
    },
  };
}

function mimeFor(fileName: string): string {
  switch (path.extname(fileName).toLowerCase()) {
    case '.svg':
      return 'image/svg+xml';
    case '.ico':
      return 'image/x-icon';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}
