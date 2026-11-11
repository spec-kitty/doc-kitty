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
 *   - a plantuml.com URL the page would load (a render endpoint anywhere, or a
 *     plantuml.com URL in `src`/`srcset`/`data`/`poster`): the output half of
 *     the no-plantuml.com guard. A plain link to PlantUML's documentation passes.
 */
import { REDIRECT_STUB_RE } from '../lib/legacy-html-redirects.mjs';

const DIAGRAM_LANGUAGE = '(?:mermaid|plantuml)';
/** An attribute value, quoted either way or unquoted: `name="… x …"`, `name='x'`, `name=x`. */
const attrHas = (name, word) => `\\b${name}\\s*=\\s*(?:"[^"]*\\b${word}\\b[^"]*"|'[^']*\\b${word}\\b[^']*'|${word}\\b)`;
const FIGURE_OPEN_RE = new RegExp(`<figure\\b[^>]*${attrHas('class', 'dk-diagram')}[^>]*>`, 'gi');
const CHECKS = [
  [new RegExp(`<pre\\b[^>]*${attrHas('data-language', DIAGRAM_LANGUAGE)}`, 'gi'), 'raw diagram code block (the fence shipped as code)'],
  [new RegExp(attrHas('class', `language-${DIAGRAM_LANGUAGE}`), 'gi'), 'raw diagram code block (the fence shipped as code)'],
  [new RegExp(`<pre\\b[^>]*${attrHas('class', 'mermaid')}`, 'gi'), 'client-rendered <pre class="mermaid"> (not drawn at build time)'],
  [new RegExp(attrHas('class', 'plantuml-error'), 'gi'), 'plantuml-error block (the diagram failed to render)'],
];
const PLANTUML_LOAD_RE =
  /plantuml\.com\/plantuml\/(?:svg|png|img|txt|uml)\/[^\s"'<>]*|\b(?:src|srcset|data|poster)\s*=\s*["']?[^"'\s>]*plantuml\.com[^"'\s>]*/i;

/** True for a redirect stub page: it shares its target's route, so it is not the page. */
export const isRedirectStub = (html) => REDIRECT_STUB_RE.test(html);

/**
 * @param {string} html one built page
 * @returns {{ figures: number, defects: string[] }}
 */
export function diagramDefects(html) {
  const defects = [];
  // Each figure runs from its opening tag to the next one (or the page end), so
  // a nested <figure> inside a diagram cannot cut the search for its <svg> short.
  const opens = [...html.matchAll(FIGURE_OPEN_RE)].map((m) => m.index);
  opens.forEach((start, index) => {
    const segment = html.slice(start, opens[index + 1] ?? html.length);
    const svg = segment.search(/<svg\b/i);
    const close = segment.search(/<\/figure>/i);
    if (svg === -1 || (close !== -1 && close < svg && !/<figure\b/i.test(segment.slice(1, close)))) {
      defects.push(`dk-diagram figure ${index + 1} holds no <svg>`);
    }
  });
  for (const [re, label] of CHECKS) {
    const count = html.match(re)?.length ?? 0;
    if (count > 0) defects.push(count === 1 ? label : `${label} ×${count}`);
  }
  const url = PLANTUML_LOAD_RE.exec(html);
  if (url) defects.push(`plantuml.com URL (${url[0]})`);
  return { figures: opens.length, defects };
}
