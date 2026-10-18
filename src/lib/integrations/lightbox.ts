/** The diagram/image lightbox client-script integration. Imports nothing from `config.ts`. */
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

/**
 * The lightbox client seam (#185, always-on). It injects the expand-to-viewport
 * island page-wide with the same `injectScript('page', …)` mechanics as
 * `tocRailIntegration`: the module is referenced by its absolute on-disk path, so
 * it resolves without a package-exports entry. There is no option to turn it off,
 * because expanding a diagram is baseline reading behaviour; the island returns
 * before creating anything on a page with no diagram or image. It augments the
 * rendered DOM in the browser and overrides no `components` carrier.
 */
export const lightboxIntegration: AstroIntegration = {
  name: 'doc-kitty:lightbox',
  hooks: {
    'astro:config:setup': ({ injectScript }) => {
      const clientPath = fileURLToPath(new URL('../lightbox/lightbox.client.ts', import.meta.url));
      injectScript('page', `import { initLightbox } from ${JSON.stringify(clientPath)};\ninitLightbox();`);
    },
  },
};
