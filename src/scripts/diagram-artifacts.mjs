/**
 * The built-site half of the diagram checks (#314): what one built HTML page
 * says about its diagrams. Shared by `dockitty-assert-diagrams`
 * (`assert-diagrams.mjs`) and its test. Node built-ins only.
 *
 * A page passes when every `<figure class="dk-diagram">` holds an `<svg>` and
 * none of these remain:
 *   - a raw diagram code block: a `mermaid` or `plantuml` fence shipped as code
 *     (`<pre data-language="…">` or a `language-…` class);
 *   - a client-rendered `<pre class="mermaid">` (client mode draws in the
 *     browser, so the page ships no picture);
 *   - an `astro-plantuml` `plantuml-error` block;
 *   - a plantuml.com URL (the output half of the no-plantuml.com guard).
 */
import { PLANTUML_COM_URL_RE } from './plantuml-guard.mjs';
import { REDIRECT_STUB_RE } from '../lib/legacy-html-redirects.mjs';

const DIAGRAM_LANGUAGE = '(?:mermaid|plantuml)';
const FIGURE_RE = /<figure\b[^>]*\bclass="[^"]*\bdk-diagram\b[^"]*"[^>]*>[\s\S]*?<\/figure>/g;
const CHECKS = [
  [new RegExp(`<pre\\b[^>]*\\bdata-language="${DIAGRAM_LANGUAGE}"`, 'gi'), 'raw diagram code block (the fence shipped as code)'],
  [new RegExp(`\\bclass="[^"]*\\blanguage-${DIAGRAM_LANGUAGE}\\b`, 'gi'), 'raw diagram code block (the fence shipped as code)'],
  [/<pre\b[^>]*\bclass="[^"]*\bmermaid\b[^"]*"/gi, 'client-rendered <pre class="mermaid"> (not drawn at build time)'],
  [/\bclass="[^"]*\bplantuml-error\b/gi, 'plantuml-error block (the diagram failed to render)'],
];

/** True for a redirect stub page: it shares its target's route, so it is not the page. */
export const isRedirectStub = (html) => REDIRECT_STUB_RE.test(html);

/**
 * @param {string} html one built page
 * @returns {{ figures: number, defects: string[] }}
 */
export function diagramDefects(html) {
  const defects = [];
  const figures = html.match(FIGURE_RE) ?? [];
  figures.forEach((figure, index) => {
    if (!/<svg\b/i.test(figure)) defects.push(`dk-diagram figure ${index + 1} holds no <svg>`);
  });
  for (const [re, label] of CHECKS) {
    const count = html.match(re)?.length ?? 0;
    if (count > 0) defects.push(count === 1 ? label : `${label} ×${count}`);
  }
  const url = PLANTUML_COM_URL_RE.exec(html);
  if (url) defects.push(`plantuml.com URL (${url[0]})`);
  return { figures: figures.length, defects };
}
