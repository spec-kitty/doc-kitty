/**
 * The presence-gated glossary integration (M4). Moved out of `config.ts`
 * verbatim (#115); imports only leaf modules, never `../config`.
 */
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { IndexBasenameOption } from '../metadata.js';
import { loadGlossary } from '../glossary/load.js';
import { generateGlossaryPages } from '../glossary/generate.js';
import glossaryTerm from '../remark/glossary-term.js';
import glossaryAutolink from '../remark/glossary-autolink.js';
import { DEFAULT_IGNORE_LIST } from '../glossary/ignore-list.js';
import { serializeDefinitionsPayload, glossaryDefinitions } from '../glossary/definitions-payload.js';
import { normalizeBasePrefix } from './shared.js';

/**
 * The presence-gated glossary seam (M4, the single integration owner — ADR-0025/
 * 0026/0027/0028, contract `autolink-and-term.md`). It is added to the integrations
 * array ONLY when a `.contextive/definitions.yaml` exists under the site root
 * (`isGlossaryActive`), mirroring the `diagrams ? [diagramsIntegration] : []` shape:
 * a glossary-free site contributes NOTHING here, so the array + corpus stay
 * byte-identical to pre-M4 (NFR-002). There is deliberately **no** config toggle —
 * the feature is presence-driven (C-005), so nothing in `DocKittyOptions` gates it.
 *
 * When active, its single `astro:config:setup` hook (pinned here — the content-layer
 * glob `sync` runs after all config hooks, so generated files are on disk before
 * `getCollection('docs')`, the sitemap filter, the sidebar, the agent API, and
 * `llms.txt` read them):
 *   (a) parses the definitions ONCE (`loadGlossary`, the single parse site INV-G1)
 *       and codegens the hub + per-context pages into `<docsDir>/glossary/**`
 *       (`generateGlossaryPages`). The generator is deterministic + idempotent
 *       (no timestamp/`generated:` field), so a dev-watcher re-run rewrites
 *       byte-identical files and never loops.
 *   (b) registers the remark plugins in the PINNED order (`updateConfig` APPENDS
 *       after Astro's built-in remark-gfm): `glossary-term → glossary-autolink`,
 *       threading the ONE shared index + `DEFAULT_IGNORE_LIST` + the site's
 *       already-normalized base prefix (#61, C-001 — the same `normalizeBasePrefix`
 *       pattern `discoveryHead` uses for `/rss.xml`/`/llms.txt`) into both factories
 *       (FR-008), plus the `glossaryDefinitions` rehype plugin that emits the
 *       hover-preview payload `<script>` (the WP06 island contract). `remarkDirective`
 *       is registered ONCE by the shared `directiveIntegration` owner (ADR-0030),
 *       prepended before this integration so the combined order still leads with it.
 *   (c) injects the preview island page-wide (M5 `injectScript('page', …)` pattern),
 *       referenced by absolute on-disk path; its own early-return keeps a
 *       glossary-free page cost-free (NFR-003) and it is a no-op on the out-of-frame
 *       deck (it keys on `a[data-glossary-term]`), so no `main.reveal` guard is
 *       needed (unlike the diagram render). `.catch` mirrors the diagram owner.
 */
export function glossaryIntegration(
  docsDir: string,
  base: string,
  indexBasename: IndexBasenameOption | undefined,
): AstroIntegration {
  return {
    name: 'doc-kitty:glossary',
    hooks: {
      'astro:config:setup': ({ updateConfig, injectScript, logger }) => {
        const root = process.cwd();
        const loaded = loadGlossary(root);
        // Defensive: the array-build gate already checked presence, but a file
        // deleted between the two reads must still no-op cleanly.
        if (!loaded.present) return;
        const { index } = loaded;

        // (a) Generate-before-glob: write docs/glossary/** now, in config:setup,
        // resolved against the same cwd the sitemap draft-filter uses.
        // The site's index-name setting decides the written file name (#129): the pages
        // must be a section index here, or the toolkit's own links to the hub point at
        // /glossary/index/ and the Hub layout and sidebar do not see it as the index.
        generateGlossaryPages(index, path.resolve(root, docsDir), indexBasename, (m) =>
          logger.warn(m),
        );

        // (b) Pinned remark order (append after remark-gfm) + payload rehype.
        // The shared index + DEFAULT_IGNORE_LIST + basePrefix thread into BOTH
        // factories so the pipeline and WP07's render-time re-derive resolve
        // identically (FR-008) and every emitted term href carries the site base
        // (#61) through the ONE shared `glossaryTermUrl` builder both factories call.
        // NOTE: `remarkDirective` is NO LONGER registered here — it is hoisted to
        // the single `directiveIntegration` owner (gated on glossary OR markua,
        // ADR-0030) and prepended BEFORE this integration, so the effective
        // combined order is still `remarkDirective → glossary-term →
        // glossary-autolink`. See the registration-site comment in
        // `defineDocKittyIntegrations`.
        const basePrefix = normalizeBasePrefix(base);
        updateConfig({
          markdown: {
            remarkPlugins: [
              [glossaryTerm, { index, ignoreList: DEFAULT_IGNORE_LIST, base: basePrefix }],
              [glossaryAutolink, { index, ignoreList: DEFAULT_IGNORE_LIST, base: basePrefix }],
            ],
            rehypePlugins: [
              [glossaryDefinitions, { json: serializeDefinitionsPayload(index) }],
            ],
          },
        });

        // (c) Inject the hover-preview island page-wide (absolute on-disk path).
        const previewOwner = fileURLToPath(
          new URL('../glossary/preview.client.ts', import.meta.url),
        );
        injectScript(
          'page',
          `import { initGlossaryPreview } from ${JSON.stringify(previewOwner)};\n` +
            // `.catch` mirrors the diagram owner: a preview-init failure must surface
            // a console warning, not an unhandled promise rejection. No `main.reveal`
            // guard — the island keys on `a[data-glossary-term]`, so a deck with no
            // glossary links is already a no-op and one with `:term` links gets it.
            `initGlossaryPreview().catch((e) => console.warn('[dk-glossary] preview init failed', e));`,
        );
      },
    },
  };
}
