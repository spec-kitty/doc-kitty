/**
 * `diagramFigure` — the rehype half of the diagram metadata → accessible-figure
 * seam (ADR-0023 decision 2, contract `diagram-meta-transform`; FR-004/013).
 * It wraps every diagram in an accessible `<figure>` + `<figcaption>` built from
 * the caption fields the remark pass ({@link ../remark/diagram-meta}) stashed on
 * `file.data.dkDiagrams`. It is DUAL-MODE (#13): it wraps the client
 * `<pre class="mermaid">` (the fence-transform output) AND the build-rendered
 * `<svg>` (unwrapped from `@beoe/rehype-mermaid`'s `<figure class="beoe">`) into
 * the SAME `<figure role="group">` shape — only the inner node differs:
 *
 * ```html
 * <figure class="dk-diagram" role="group" aria-labelledby="dk-diagram-caption-{N}">
 *   <pre class="mermaid">…source (accTitle/accDescr injected)…</pre>
 *   <figcaption class="dk-diagram__caption" id="dk-diagram-caption-{N}">
 *     <span class="dk-diagram__desc">{description}</span>
 *     <span class="dk-diagram__attr"><a href="{source}">{attribution}</a></span>
 *   </figcaption>
 * </figure>
 * ```
 *
 * `role="group"` overrides `<figure>`'s native figcaption-based accessible-name
 * computation (HTML-AAM), so a captioned figure carries an explicit
 * `aria-labelledby` back to its `<figcaption>` (a stable, per-page-unique id
 * keyed off document order) — restoring the name the ARIA override took away.
 * A caption-less figure (the empty-safe case below) has neither id nor
 * `aria-labelledby`: it was unnamed before this fix too, and the wrapped SVG
 * keeps its own `accTitle`/`accDescr` name either way, so no content is lost.
 *
 * - `attribution` links to `source` when a source is present AND its scheme
 *   passes {@link safeHref}'s allowlist (`http:`/`https:`/`mailto:`/no scheme);
 *   otherwise it is plain text (DIAG-SEC-01 — never emit a non-allowlisted
 *   href, e.g. `javascript:`).
 * - The `<figcaption>` is OMITTED entirely when there is neither a description
 *   nor an attribution — an empty-safe figure (a diagram with no metadata still
 *   gets wrapped, just without a caption).
 * - The inner SVG is NOT `aria-hidden`: the figure lives in the searchable
 *   content region and the SVG names itself via the injected `accTitle`/
 *   `accDescr` (Mermaid emits `<title>`/`<desc>` + aria on render).
 *
 * Cross-pass key: `<pre class="mermaid">` elements are matched to stashed
 * caption fields by DOCUMENT ORDER — the Nth mermaid pre reads
 * `file.data.dkDiagrams[N]` — mirroring the order the remark pass appended them.
 *
 * Standalone: registered by nobody in this work package (WP03 wires it), so the
 * built corpus is byte-identical until then.
 */
import type { FigureFields } from '../remark/diagram-meta.internal.js';
import {
  escapeHtml,
  stripPlantumlPis,
  injectSvgAccessibleName,
} from '../remark/plantuml-meta.internal.js';
import type { PlantumlFigure } from '../remark/plantuml-meta.js';

/** Minimal structural hast node — enough to find/replace mermaid `<pre>`s. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
  [key: string]: unknown;
}

/** The subset of the rehype VFile this plugin reads. */
interface DiagramVFile {
  data?: {
    dkDiagrams?: FigureFields[];
    /** Per-plantuml-diagram caption + accessible-name stash (WP02, document
     * order) — the twin of `dkDiagrams`, populated by `plantumlMeta`. */
    dkPlantuml?: PlantumlFigure[];
    [key: string]: unknown;
  };
}

/**
 * Deny-by-default scheme allowlist for `%% source:` values (DIAG-SEC-01).
 * Mirrors `../remark/deck-split.internal.js`'s attribute allowlist precedent: a
 * `%% source:` value is placed directly into an `<a href>`, so a `javascript:`/
 * `data:`/`vbscript:` URI must never reach the DOM as a clickable link (a
 * stored/DOM-XSS vector). Returns the trimmed value when its scheme is
 * `http:`/`https:`/`mailto:`, or when the value has NO scheme at all (a
 * relative/hash-only link, e.g. `#note` or `../file.md`); returns `undefined`
 * for everything else. Robustness: strips control chars/whitespace throughout
 * (not just the edges) before scheme-matching, so a scheme smuggled via
 * embedded tabs/newlines (`java\tscript:`) still collapses to `javascript:`
 * and is rejected — Chromium's own URL parser strips those characters, so a
 * naive `^[a-z]+:` match on the raw string would under-reject.
 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);
// Matches any ASCII control character (tab, newline, etc.) so a scheme
// smuggled via embedded whitespace (e.g. a tab inside "java" + "script:")
// collapses before the scheme check runs -- browsers do the same before
// parsing a URL scheme, so a naive edge-trim would under-reject it.
// eslint-disable-next-line no-control-regex -- intentional: strips control characters a scheme could be smuggled through.
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]+/g;
export function safeHref(value: string): string | undefined {
  const trimmed = value.trim();
  const collapsed = trimmed.replace(CONTROL_CHARS_RE, '');
  // Protocol-relative ("//host/...") is rejected outright: no explicit scheme
  // to allowlist, but it resolves to a live, attacker-controlled origin.
  if (collapsed.startsWith('//')) return undefined;
  const match = /^([a-z][a-z0-9+.-]*:)/i.exec(collapsed);
  if (!match) return trimmed; // no scheme -> relative/hash link, allow.
  const scheme = match[1].toLowerCase();
  return ALLOWED_SCHEMES.has(scheme) ? trimmed : undefined;
}

/** hast text node. */
const text = (value: string): HastNode => ({ type: 'text', value });

/** hast element node with the given tag, class, and children. */
function element(
  tagName: string,
  properties: Record<string, unknown>,
  children: HastNode[],
): HastNode {
  return { type: 'element', tagName, properties, children };
}

/** Read the hast `className` (array or string form) as a list of tokens. */
function classList(node: HastNode): string[] {
  const raw = node.properties?.className;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(/\s+/).filter(Boolean);
  return [];
}

/** True for a `<pre class="mermaid">` element (the client fence-transform output). */
function isMermaidPre(node: HastNode): boolean {
  return (
    node.type === 'element' &&
    node.tagName === 'pre' &&
    classList(node).includes('mermaid')
  );
}

/** The `<svg>` child of a node, or `undefined`. */
function svgChild(node: HastNode): HastNode | undefined {
  return (node.children ?? []).find(
    (c) => c.type === 'element' && c.tagName === 'svg',
  );
}

/**
 * True for a BUILD-rendered mermaid figure: the `<figure class="beoe …">` that
 * `@beoe/rehype-mermaid` emits (inline strategy), holding the baked `<svg>`. In
 * build mode this is the shape `diagramFigure` unwraps and re-wraps into the
 * shared `dk-diagram` figure — the `<svg>` analogue of the client `pre.mermaid`.
 */
function isBuildMermaidFigure(node: HastNode): boolean {
  return (
    node.type === 'element' &&
    node.tagName === 'figure' &&
    classList(node).includes('beoe') &&
    svgChild(node) !== undefined
  );
}

/** Build the `<figcaption>` children (description span, then attribution span),
 * or `null` when neither field is present (so the caller omits the caption). */
function captionChildren(fields: FigureFields): HastNode[] | null {
  const children: HastNode[] = [];

  if (fields.description !== undefined) {
    children.push(
      element('span', { className: ['dk-diagram__desc'] }, [text(fields.description)]),
    );
  }

  if (fields.attribution !== undefined) {
    // DIAG-SEC-01: only an allowlisted scheme becomes a clickable `<a href>`;
    // a rejected (or absent) source falls back to plain text — never a
    // non-allowlisted href (e.g. `javascript:`) reaches the DOM.
    const href = fields.source !== undefined ? safeHref(fields.source) : undefined;
    const attrInner: HastNode =
      href !== undefined ? element('a', { href }, [text(fields.attribution)]) : text(fields.attribution);
    children.push(element('span', { className: ['dk-diagram__attr'] }, [attrInner]));
  }

  return children.length > 0 ? children : null;
}

/** Wrap the diagram's inner node — a client `<pre class="mermaid">` OR a
 * build-rendered `<svg>` — in the accessible `<figure>` (+ optional caption).
 * `index` is this diagram's 0-based document-order position (the same counter
 * the caller matches against `file.data.dkDiagrams`), reused to mint a stable,
 * per-page-unique caption id for `aria-labelledby` — see the header note on
 * why `role="group"` needs one. The `<figure>` shape is IDENTICAL in both modes;
 * only the wrapped inner node differs (`pre.mermaid` vs the baked `svg`). */
function buildFigure(inner: HastNode, fields: FigureFields, index: number): HastNode {
  const children: HastNode[] = [inner];
  const caption = captionChildren(fields);
  const properties: Record<string, unknown> = { className: ['dk-diagram'], role: 'group' };
  if (caption) {
    const captionId = `dk-diagram-caption-${index}`;
    children.push(
      element('figcaption', { className: ['dk-diagram__caption'], id: captionId }, caption),
    );
    properties['aria-labelledby'] = captionId;
  }
  return element('figure', properties, children);
}

// --- PlantUML build figure (#13 WP02, FR-006/007/008) ----------------------
//
// `astro-plantuml` is a REMARK plugin: it replaces a ```plantuml fence with a
// raw HTML node (`<figure class="plantuml-diagram"><svg …>…</svg></figure>`).
// Astro's markdown pipeline runs its terminal `rehype-raw` parse AFTER the user
// rehype plugins, so by the time THIS pass runs that HTML is still a single
// `type: 'raw'` STRING node — not parsed hast elements. So the PlantUML figure
// cannot be built with the hast-node `buildFigure` above; it is re-wrapped by
// string surgery here instead, into the SAME `dk-diagram` shape (the shared
// figure contract is preserved, only the node representation differs). The
// shared `sentinelThemeRewrite` runs BEFORE this pass and has already rewritten
// the sentinel hexes in the raw string to `var(--dk-diagram-*)`, so this builder
// only strips the PlantUML PIs, injects the accessible `<title>`/`<desc>`, and
// re-wraps the `<svg>` in the `dk-diagram` figure + caption.

/** True for the raw HTML node `astro-plantuml` emits (a `plantuml-diagram`
 * `<figure>` holding the rendered `<svg>`). */
function isPlantumlRaw(node: HastNode): boolean {
  return (
    node.type === 'raw' &&
    typeof node.value === 'string' &&
    node.value.includes('plantuml-diagram') &&
    /<svg\b/i.test(node.value)
  );
}

/**
 * True for `astro-plantuml`'s RENDER-ERROR fallback node (#13 WP03, renata WP02
 * INFO). On a failed render `astro-plantuml` splices a `<div class="plantuml-error">`
 * (NOT a `plantuml-diagram` `<figure><svg>`) in place of the fence. Two hazards
 * this creates:
 *   1. it is a SILENT degrade — a broken diagram would ship a bare error `<div>`
 *      into the page; and
 *   2. on a page with MULTIPLE plantuml diagrams it DESYNCS the figure-builder's
 *      document-order index: `plantumlMeta` stashed one `dkPlantuml` entry per
 *      fence (errors included), but this pass only advances `plantumlIndex` on a
 *      real rendered figure — so a figure AFTER a skipped error would read the
 *      wrong stash entry (a later diagram wearing an earlier diagram's caption/name).
 * So a render error must FAIL THE BUILD LOUDLY here (never silently degrade),
 * which also keeps the index alignment robust by construction: with an error
 * always throwing, the rendered-figure sequence can never skip a stashed entry. */
function plantumlErrorRaw(node: HastNode): string | null {
  if (node.type !== 'raw' || typeof node.value !== 'string') return null;
  if (!node.value.includes('class="plantuml-error"')) return null;
  const msg = /Error generating PlantUML diagram:\s*([^<]*)/i.exec(node.value);
  return (msg?.[1] ?? 'unknown error').trim();
}

/** The `<figcaption>` inner HTML (description span, then attribution span), or
 * `''` when neither field is present — the string twin of {@link captionChildren}
 * (same fields, same DIAG-SEC-01 allowlist, same class names). */
function captionHtml(fields: PlantumlFigure): string {
  let html = '';
  if (fields.description !== undefined) {
    html += `<span class="dk-diagram__desc">${escapeHtml(fields.description)}</span>`;
  }
  if (fields.attribution !== undefined) {
    const href = fields.source !== undefined ? safeHref(fields.source) : undefined;
    const inner =
      href !== undefined
        ? `<a href="${escapeHtml(href)}">${escapeHtml(fields.attribution)}</a>`
        : escapeHtml(fields.attribution);
    html += `<span class="dk-diagram__attr">${inner}</span>`;
  }
  return html;
}

/**
 * Re-wrap `astro-plantuml`'s raw `<figure class="plantuml-diagram">` string into
 * the shared `dk-diagram` figure (the string twin of {@link buildFigure}): strip
 * the PlantUML PIs, inject the accessible `<title>`/`<desc>` into the `<svg>`,
 * drop the `plantuml-diagram` wrapper, and emit `<figure class="dk-diagram"
 * role="group"[ aria-labelledby]>` + `<svg>` + optional `<figcaption>`. The
 * caption id is namespaced (`…-plantuml-{index}`) so a page mixing Mermaid and
 * PlantUML figures never collides ids. Returns the raw HTML for a new `raw`
 * node; Astro's terminal `rehype-raw` parses it into real hast at the end.
 */
function buildPlantumlFigureHtml(rawValue: string, fields: PlantumlFigure, index: number): string {
  let svg = stripPlantumlPis(rawValue);
  // Extract the `<svg>…</svg>` (drop astro-plantuml's `plantuml-diagram` wrapper).
  const svgMatch = /<svg\b[\s\S]*<\/svg>/i.exec(svg);
  svg = svgMatch ? svgMatch[0] : svg;
  svg = injectSvgAccessibleName(svg, fields.name, fields.desc);

  const caption = captionHtml(fields);
  if (caption === '') {
    return `<figure class="dk-diagram" role="group">${svg}</figure>`;
  }
  const captionId = `dk-diagram-caption-plantuml-${index}`;
  return (
    `<figure class="dk-diagram" role="group" aria-labelledby="${captionId}">` +
    svg +
    `<figcaption class="dk-diagram__caption" id="${captionId}">${caption}</figcaption>` +
    `</figure>`
  );
}

/**
 * Rehype plugin factory. Returns the transformer Astro runs over each page's
 * hast; assignable to Astro's `RehypePlugin` (a unified `Plugin<[], Root>`).
 */
export default function diagramFigure() {
  return function transformer(tree: HastNode, file: DiagramVFile): void {
    const diagrams = file.data?.dkDiagrams ?? [];
    const plantuml = file.data?.dkPlantuml ?? [];
    let index = 0;
    let plantumlIndex = 0;

    const walk = (node: HastNode): void => {
      const children = node.children;
      if (!Array.isArray(children)) return;
      for (let k = 0; k < children.length; k++) {
        const child = children[k];
        if (isMermaidPre(child)) {
          // Client mode: wrap the `<pre class="mermaid">` in place.
          children[k] = buildFigure(child, diagrams[index] ?? {}, index);
          index++;
          // Do not descend into the wrapped `<pre>` (it is a leaf we just moved).
        } else if (isBuildMermaidFigure(child)) {
          // Build mode: UNWRAP `@beoe`'s `<figure class="beoe">` and re-wrap its
          // baked `<svg>` in the shared `dk-diagram` figure — so the output shape
          // (and its document-order correlation to `dkDiagrams`) matches client
          // mode exactly, just with the `<svg>` in place of the `<pre>`.
          const svg = svgChild(child) as HastNode;
          children[k] = buildFigure(svg, diagrams[index] ?? {}, index);
          index++;
        } else if (isPlantumlRaw(child)) {
          // Build mode (PlantUML): re-wrap the raw `astro-plantuml` figure string
          // into the shared `dk-diagram` shape (document-order correlation to the
          // `dkPlantuml` stash, mirroring the Mermaid counter). ROBUST INDEX (#13
          // WP03): a rendered figure with no matching stash entry means the two
          // passes desynced (only possible if a non-throwing error node were
          // skipped) — fail loudly rather than mint a mis-captioned figure.
          if (plantuml.length > 0 && plantumlIndex >= plantuml.length) {
            throw new Error(
              `[doc-kitty] diagramFigure: rendered PlantUML figure #${plantumlIndex + 1} has no ` +
                `matching \`dkPlantuml\` metadata entry (stash holds ${plantuml.length}) — the ` +
                `figure-order index desynced from the metadata stash (#13 WP03)`,
            );
          }
          child.value = buildPlantumlFigureHtml(
            child.value as string,
            plantuml[plantumlIndex] ?? {},
            plantumlIndex,
          );
          plantumlIndex++;
        } else {
          // A PlantUML render ERROR must fail the build LOUDLY (never ship a broken
          // figure, never silently desync the figure index) — renata WP02 INFO.
          const errText = plantumlErrorRaw(child);
          if (errText !== null) {
            throw new Error(
              `[doc-kitty] astro-plantuml failed to render a plantuml diagram: ${errText} — a diagram ` +
                `render error fails the build (#13 WP03, renata WP02 INFO). Check the self-hosted PlantUML ` +
                `server (DK_PLANTUML_SERVER_URL) and the diagram source.`,
            );
          }
          walk(child);
        }
      }
    };

    walk(tree);
  };
}
