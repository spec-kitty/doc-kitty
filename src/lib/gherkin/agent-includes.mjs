/**
 * PURE agent-surface support for `::gherkin{src scenario tags}` includes
 * (ADR-0051; 02 §Agent surface).
 *
 * `/api/pages/<id>.json` (`routes/agent-page.ts`) hands an agent a page's raw
 * Markdown body. An include would reach it as an opaque `::gherkin{…}` line,
 * and the route cannot resolve one itself: like the content loader it is
 * mounted by the site, so it has no `includeRoots`/`sourceRoot`, and it must not
 * pull `@cucumber/gherkin` into its module graph (the same reason
 * `scenario-index-filter.ts` exists). So the work is split at the render seam:
 *
 * 1. The fence stage (`remark/gherkin-fence.ts`), which has already resolved,
 *    parsed and selected each include for the HTML, also renders it as Markdown
 *    (`renderFeatureBody` at the same base level, plus the source line, see
 *    `renderSourceLine`) and records one {@link AgentInclude} per directive under
 *    {@link AGENT_INCLUDES_KEY} in `file.data.astro.frontmatter`. Astro keeps
 *    that object as the entry's `rendered.metadata.frontmatter` (Astro 5:
 *    `@astrojs/markdown-remark` returns `result.data.astro.frontmatter`, the
 *    glob loader stores it with the rendered HTML in the data store), which is
 *    SEPARATE from the schema-validated `entry.data`: the key never reaches
 *    validation, `<head>`, the sitemap or `llms.txt`.
 * 2. The route reads the records back ({@link readAgentIncludes}) and splices
 *    them into `entry.body` ({@link spliceAgentIncludes}). Offsets are the
 *    directive node's `position.*.offset`, and Astro renders exactly the string
 *    it stores as `entry.body` (the frontmatter stripped, then trimmed), so they
 *    index the body directly. Only real directive nodes are recorded, so a
 *    `::gherkin{…}` shown inside a code fence is text and is never touched.
 *
 * PURITY CONTRACT: no imports at all: the route's graph must stay parser-free
 * (enforced by the route's module-graph check in `agent-page-includes.test.ts`).
 *
 * TYPING: JSDoc only — the repo forbids `.d.ts` sidecars.
 *
 * @module gherkin/agent-includes
 */

/**
 * The key the fence stage writes to the render-time frontmatter. Prefixed so it
 * cannot collide with an authored frontmatter field.
 */
export const AGENT_INCLUDES_KEY = 'dkGherkinIncludes';

/**
 * One include, as the fence stage records it.
 *
 * @typedef {object} AgentInclude
 * @property {number} start The directive's start offset in the rendered body.
 * @property {number} end The directive's end offset (exclusive).
 * @property {string} src The `src` attribute as authored.
 * @property {string} [scenario] The `scenario` attribute, when set.
 * @property {string} [tags] The `tags` attribute as authored, when set.
 * @property {string} markdown The include as re-parse-safe Markdown, source
 *   line last, with no trailing newline (it replaces the directive in place).
 */

/**
 * What the agent payload lists per include: the directive's attributes.
 *
 * @typedef {object} AgentIncludeRef
 * @property {string} src
 * @property {string} [scenario]
 * @property {string} [tags]
 */

/** The text every recorded span must start with (a sanity check on offsets). */
const DIRECTIVE_PREFIX = '::gherkin';

/**
 * The records under {@link AGENT_INCLUDES_KEY} in a rendered entry's
 * frontmatter; `[]` when the key is absent (a page with no include) or the
 * value is not the shape the stage writes. Malformed records are dropped
 * one by one rather than trusted.
 *
 * @param {unknown} frontmatter `entry.rendered?.metadata?.frontmatter`.
 * @returns {AgentInclude[]}
 */
export function readAgentIncludes(frontmatter) {
  if (!frontmatter || typeof frontmatter !== 'object') return [];
  const raw = /** @type {Record<string, unknown>} */ (frontmatter)[AGENT_INCLUDES_KEY];
  if (!Array.isArray(raw)) return [];
  /** @type {AgentInclude[]} */
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = /** @type {Record<string, unknown>} */ (item);
    if (!Number.isInteger(r.start) || !Number.isInteger(r.end)) continue;
    if (typeof r.src !== 'string' || typeof r.markdown !== 'string') continue;
    out.push({
      start: /** @type {number} */ (r.start),
      end: /** @type {number} */ (r.end),
      src: r.src,
      ...(typeof r.scenario === 'string' ? { scenario: r.scenario } : {}),
      ...(typeof r.tags === 'string' ? { tags: r.tags } : {}),
      markdown: r.markdown,
    });
  }
  return out;
}

/**
 * The prefix every continuation line of an include needs to stay inside the
 * directive's container: the text between the start of the directive's line
 * and the directive, with list markers blanked (a list item's content column)
 * and blockquote `>` markers kept. `''` for a top-level directive.
 *
 * @param {string} body
 * @param {number} start
 * @returns {string}
 */
function continuationPrefix(body, start) {
  const lineStart = body.lastIndexOf('\n', start - 1) + 1;
  return body.slice(lineStart, start).replace(/[-*+]|\d{1,9}[.)]/g, (m) => ' '.repeat(m.length));
}

/**
 * Replace every recorded directive in `body` with its Markdown, last first so
 * earlier offsets stay valid. A record whose span is out of range, overlaps the
 * one after it, or does not start with `::gherkin` (the body it was recorded
 * against is not this one) is skipped and its directive left as written: a
 * stale record must never corrupt the payload.
 *
 * @param {string} body `entry.body`.
 * @param {readonly AgentInclude[]} records From {@link readAgentIncludes}.
 * @returns {{ markdown: string, includes: AgentIncludeRef[] }} The spliced body,
 *   and the attributes of each include spliced, in document order (`[]`, and
 *   `markdown === body`, when there is none).
 */
export function spliceAgentIncludes(body, records) {
  const sorted = [...records].sort((a, b) => a.start - b.start);
  /** @type {AgentInclude[]} */
  const valid = [];
  let floor = 0;
  for (const r of sorted) {
    if (r.start < floor || r.end <= r.start || r.end > body.length) continue;
    if (!body.startsWith(DIRECTIVE_PREFIX, r.start)) continue;
    valid.push(r);
    floor = r.end;
  }

  let markdown = body;
  for (let i = valid.length - 1; i >= 0; i -= 1) {
    const { start, end } = valid[i];
    const prefix = continuationPrefix(body, start);
    const blank = prefix.trimEnd();
    const text = prefix
      ? valid[i].markdown
          .split('\n')
          .map((line, n) => (n === 0 ? line : line === '' ? blank : `${prefix}${line}`))
          .join('\n')
      : valid[i].markdown;
    markdown = `${markdown.slice(0, start)}${text}${markdown.slice(end)}`;
  }
  const includes = valid.map(({ src, scenario, tags }) => ({
    src,
    ...(scenario !== undefined ? { scenario } : {}),
    ...(tags !== undefined ? { tags } : {}),
  }));
  return { markdown, includes };
}
