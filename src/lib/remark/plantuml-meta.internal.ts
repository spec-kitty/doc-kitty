/**
 * Pure, Astro-free string logic for the PlantUML metadata transform — the TWIN
 * of `diagram-meta.internal.ts` (#13 WP02, FR-006/007/008; ADR-0023 build-render
 * seam). Mermaid names its figure from a leading `%% key: value` block; PlantUML
 * comments start with a single quote (`'`), so this module parses a leading
 * `' key: value` block over the SAME closed field set, strips it, injects the
 * `skinparam` sentinel preamble that makes the rendered SVG carry the six
 * `--dk-diagram-*` colours (surfaced to the shared `sentinelThemeRewrite`), and
 * exposes the small SVG-string helpers the figure wrapper needs.
 *
 * Nothing here imports remark, hast, unified, vfile, or Astro — it is plain
 * functions over the fence's `value` string (and, for the SVG helpers, over the
 * raw HTML `astro-plantuml` emits), so the vitest matrix exercises it with zero
 * build runtime. `plantuml-meta.ts` (the remark plugin) walks the mdast and
 * delegates all string work here; `diagram-figure.ts` (the rehype plugin)
 * consumes the caption shape {@link plantumlFigureFields} and the SVG helpers.
 *
 * Load-bearing guard: the metadata regex requires whitespace after `'`
 * (`^'\s+…`), never a `'{…}` form — parity with the `%%`/`%%{` guard the Mermaid
 * twin uses (a `'` immediately followed by `{` can never be mistaken for a
 * metadata line).
 *
 * Twin note: the field set, the leading-block scan, the first-occurrence-wins
 * capture, and the caption projection all MIRROR `diagram-meta.internal.ts`
 * one-to-one — the shared {@link DiagramMeta}/{@link FigureFields} types are
 * reused directly so the two parsers stay definitionally in step.
 */
import type {
  DiagramMeta,
  DiagramMetaKey,
  FigureFields,
} from './diagram-meta.internal.js';

export type { DiagramMeta, FigureFields } from './diagram-meta.internal.js';

/** Result of {@link parsePlantumlMeta}: the captured fields + the source with
 * the matched metadata lines removed (everything else byte-preserved). */
export interface ParsePlantumlMetaResult {
  fields: DiagramMeta;
  strippedCode: string;
}

/**
 * A leading metadata line: `'`, at least one space, a reserved key, `:`, and a
 * non-empty value. The mandatory `\s+` after `'` is the reserved-form guard —
 * a `'{` (no space) never matches, mirroring the Mermaid twin's `%%{` guard.
 */
const META_LINE = /^'\s+(title|description|attribution|source):\s*(.+)$/;

/** True when a line is a PlantUML line comment (`'…`). */
const isComment = (line: string): boolean => line.trimStart().startsWith("'");

/**
 * Parse the leading `' key: value` block and strip the matched lines (twin of
 * {@link ../remark/diagram-meta.internal.parseMeta}).
 *
 * The "leading block" runs from the top of the source and ends at the first line
 * that is neither blank nor a `'` comment. Within it, lines matching the closed
 * set are captured (first occurrence wins) and removed; every other line — blank
 * lines and non-metadata `'` comments — is left exactly in place. Lines after
 * the block are never scanned.
 */
export function parsePlantumlMeta(code: string): ParsePlantumlMetaResult {
  const lines = code.split('\n');
  const fields: DiagramMeta = {};
  const kept: string[] = [];
  let inLeadingBlock = true;

  for (const line of lines) {
    if (inLeadingBlock) {
      const match = META_LINE.exec(line);
      if (match) {
        const key = match[1] as DiagramMetaKey;
        if (fields[key] === undefined) fields[key] = match[2].trim();
        // Matched metadata lines are stripped (not pushed to `kept`).
        continue;
      }
      if (line.trim() === '' || isComment(line)) {
        // Blank lines and non-metadata `'` comments stay in the source and keep
        // the leading block open.
        kept.push(line);
        continue;
      }
      // First non-blank, non-`'` line: the leading block is over.
      inLeadingBlock = false;
    }
    kept.push(line);
  }

  return { fields, strippedCode: kept.join('\n') };
}

/**
 * Project the caption shape the `<figcaption>` is built from (twin of
 * {@link ../remark/diagram-meta.internal.figureFields}). `title` feeds the
 * accessible NAME only, so it is deliberately excluded; each of
 * `description`/`attribution`/`source` is carried through only when present.
 */
export function plantumlFigureFields(fields: DiagramMeta): FigureFields {
  const out: FigureFields = {};
  if (fields.description !== undefined) out.description = fields.description;
  if (fields.attribution !== undefined) out.attribution = fields.attribution;
  if (fields.source !== undefined) out.source = fields.source;
  return out;
}

/**
 * The build-render sentinel table for PlantUML, MIRRORING config.ts
 * `DIAGRAM_SENTINELS` (kept in a local, Astro-free copy so this module stays
 * import-light; `plantuml-meta.test.ts` asserts byte-parity with the
 * config-owned table so the two can never drift). Each of the six
 * `--dk-diagram-*` tokens maps to ONE distinct sentinel hex; the D8 spike proved
 * that injecting these as `skinparam` colours surfaces EXACTLY these six hexes in
 * the emitted SVG with ZERO derived shades — so the shared `sentinelThemeRewrite`
 * rewrites each to its `var(--dk-diagram-*)` unchanged, and the chromatic-hex
 * gate passes trivially (no PlantUML derived-shade leak, unlike Mermaid).
 */
export const PLANTUML_SENTINELS = {
  'node-fill': '#e1f0c1',
  'node-border': '#c14f8a',
  'node-text': '#1a2b3c',
  edge: '#7a3ff0',
  'subgraph-title': '#0f9d58',
  'cluster-fill': '#f4b400',
} as const;

/**
 * The `skinparam` preamble injected ahead of every PlantUML diagram body so the
 * SVG the server renders is coloured entirely from the six sentinels — the
 * six-token → PlantUML-colour-param map (D8):
 *   - `--dk-diagram-node-fill`     → `rectangle.BackgroundColor` (element fill)
 *   - `--dk-diagram-node-border`   → `rectangle/package.BorderColor` (element +
 *     cluster border)
 *   - `--dk-diagram-node-text`     → `defaultFontColor` / `rectangle.FontColor`
 *     / `ArrowFontColor` (all body + edge-label text)
 *   - `--dk-diagram-edge`          → `ArrowColor` (links / arrows)
 *   - `--dk-diagram-subgraph-title`→ `package.FontColor` (cluster/subgraph title)
 *   - `--dk-diagram-cluster-fill`  → `package.BackgroundColor` (cluster fill)
 * `backgroundColor transparent` keeps the page theme showing through (no forced
 * chromatic canvas), and `shadowing false` removes the grey drop-shadow the
 * default theme would otherwise emit as an off-token colour.
 */
export const SKINPARAM_PREAMBLE = [
  'skinparam backgroundColor transparent',
  'skinparam shadowing false',
  `skinparam defaultFontColor ${PLANTUML_SENTINELS['node-text']}`,
  `skinparam ArrowColor ${PLANTUML_SENTINELS.edge}`,
  `skinparam ArrowFontColor ${PLANTUML_SENTINELS['node-text']}`,
  'skinparam rectangle {',
  `  BackgroundColor ${PLANTUML_SENTINELS['node-fill']}`,
  `  BorderColor ${PLANTUML_SENTINELS['node-border']}`,
  `  FontColor ${PLANTUML_SENTINELS['node-text']}`,
  '}',
  'skinparam package {',
  `  BackgroundColor ${PLANTUML_SENTINELS['cluster-fill']}`,
  `  BorderColor ${PLANTUML_SENTINELS['node-border']}`,
  `  FontColor ${PLANTUML_SENTINELS['subgraph-title']}`,
  '}',
].join('\n');

/** True when a line opens the PlantUML document (`@startuml …`). */
const isStartUml = (line: string): boolean => line.trimStart().startsWith('@startuml');

/**
 * Inject the {@link SKINPARAM_PREAMBLE} into the (metadata-stripped) source so
 * the rendered SVG is themed by the six sentinels. When the body already opens
 * with an explicit `@startuml` line the preamble is inserted immediately AFTER
 * it (skinparams must live inside the document); otherwise it is prepended (and
 * `astro-plantuml` wraps the whole thing in `@startuml`/`@enduml` at encode
 * time, so the preamble still lands inside the document).
 */
export function injectSkinparam(code: string): string {
  const lines = code.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i < lines.length && isStartUml(lines[i])) {
    lines.splice(i + 1, 0, SKINPARAM_PREAMBLE);
    return lines.join('\n');
  }
  return `${SKINPARAM_PREAMBLE}\n${code}`;
}

/**
 * Escape the HTML metacharacters in a text value bound for an HTML string
 * context (the injected `<title>`/`<desc>` and the `<figcaption>` spans). The
 * figure wrapper emits raw HTML (the PlantUML SVG is a raw string at rehype
 * time, before Astro's terminal `rehype-raw` parse), so interpolated metadata
 * MUST be escaped here rather than relying on hast's own serialiser.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strip the PlantUML processing instructions the server embeds in the SVG — the
 * leading `<?plantuml VERSION?>` and the trailing `<?plantuml-src …?>` (which
 * carries the full encoded source). Neither is a real SVG element; left in place
 * Astro's HTML parser turns each into a bogus comment node, and the `-src` PI in
 * particular would leak the diagram source and bloat the page.
 */
export function stripPlantumlPis(html: string): string {
  return html.replace(/<\?plantuml[\s\S]*?\?>/g, '');
}

/**
 * Inject an accessible `<title>` (+ optional `<desc>`) as the first children of
 * the SVG so it is NAMED (PlantUML omits them; #13 FR-007/NFR-004 — axe
 * `svg-img-alt`). `name` is the `title`, or the `description` when `title` is
 * absent (the same accessible-name fallback the Mermaid twin uses); `desc` is
 * the `description` when present. With no name available the SVG is returned
 * unchanged (an unnamed diagram, empty-safe, matching the Mermaid path).
 */
export function injectSvgAccessibleName(
  svgHtml: string,
  name: string | undefined,
  desc: string | undefined,
): string {
  if (name === undefined) return svgHtml;
  const open = /<svg\b[^>]*>/.exec(svgHtml);
  if (!open) return svgHtml;
  const at = open.index + open[0].length;
  let inject = `<title>${escapeHtml(name)}</title>`;
  if (desc !== undefined) inject += `<desc>${escapeHtml(desc)}</desc>`;
  return svgHtml.slice(0, at) + inject + svgHtml.slice(at);
}
