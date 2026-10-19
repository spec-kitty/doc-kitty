import type { AstroIntegration } from 'astro';

/**
 * Pin `compressHTML: true` (#145, spike B11).
 *
 * Astro 7 defaults to `compressHTML: 'jsx'`, which removes the inline
 * whitespace between elements, so extracted text (copy, search excerpts) reads
 * "status:activeUpdated". `true` keeps the pre-Astro-7 whitespace output.
 * Operator decision 2026-10-18: parity with the pre-Astro-7 output.
 */
export const compressHtmlIntegration: AstroIntegration = {
  name: 'doc-kitty:compress-html',
  hooks: {
    'astro:config:setup': ({ updateConfig }) => {
      updateConfig({ compressHTML: true });
    },
  },
};
