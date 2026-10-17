/** The collapsible-TOC-rail client-script integration. Imports nothing from `config.ts`. */
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/**
 * The collapsible-TOC-rail client seam (FR-006, IC-04, D2 always-on). It injects
 * WP02's collapse-toggle island page-wide via the documented `injectScript('page',
 * …)` pattern, mirroring ONLY the injection mechanics of `diagramsIntegration` /
 * `glossaryIntegration` — the module is referenced by its absolute on-disk path so
 * it resolves without a package-exports entry.
 *
 * Unlike the diagrams/glossary seams there is NO presence/opt-in gate: this is
 * appended UNCONDITIONALLY to the integrations array (D2 — the TOC rail is a
 * baseline chrome behavior on every site, so it must not sit behind a
 * `DocKittyOptions` toggle). The island itself early-returns on any page whose DOM
 * carries no `.right-sidebar` TOC, so a TOC-free page stays cost-free at runtime,
 * and it augments Starlight's rendered sidebar with one native `<button>` rather
 * than overriding a `components` carrier (the five-carrier lock, DIRECTIVE_001).
 */
export const tocRailIntegration: AstroIntegration = {
  name: 'doc-kitty:toc-rail',
  hooks: {
    'astro:config:setup': ({ injectScript }) => {
      const clientPath = fileURLToPath(
        new URL('../toc-rail/toc-rail.client.ts', import.meta.url),
      );
      injectScript(
        'page',
        `import { initTocRail } from ${JSON.stringify(clientPath)};\ninitTocRail();`,
      );
    },
  },
};
