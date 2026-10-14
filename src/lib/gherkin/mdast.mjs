/**
 * Gherkin → mdast emitter (ADR-0051; rendering contract 03 §4, normative).
 *
 * Turns a {@link FeatureView} into the mdast subtree that replaces a
 * ```` ```gherkin ```` fence or a `::gherkin{…}` include on a docs page. It
 * builds mdast DIRECTLY rather than re-parsing `render.mjs`'s Markdown: that
 * Markdown's whole-document escapes (`\:`, `<!---->`, heading escapes) are
 * pointless or harmful inside a tree, and Markdown has no hook for the
 * container or the classes below (02 §Why build mdast directly). The two
 * emitters agree because both read the same view (`view.mjs`): this module
 * only decides node shapes.
 *
 * Shape (03 §4):
 *
 *  - RETURNS THE CONTAINER: one `dkGherkin` node (`data.hName: 'div'`,
 *    `className: ['dk-gherkin']`, no role, no accessible name) holding
 *    everything below. The remark stage swaps it in for the fence/directive
 *    node, so the container's markup lives in exactly one module.
 *  - Headings: real mdast `heading` nodes at the top level of a page (they reach
 *    the TOC and `rehypeHeadingIds`); with `inContainer`, a `paragraph` with
 *    `hName: 'p'` and `hProperties: { role: 'heading', ariaLevel }`, so a block
 *    inside a list item, blockquote or aside neither breaks that container's
 *    outline nor reaches the TOC (02 §Headings). Levels follow the view's shared
 *    plan, capped at 6. NO heading ever carries a preset id: the slugger must
 *    see every heading to keep ids unique on the page.
 *  - Feature header (`header: 'full'`): title, tags, narrative (one paragraph,
 *    lines joined by `break`), description, summary line. `title` keeps only the
 *    title; `none` (an include with a selection, or a synthetic Feature) none.
 *  - Sections: heading, tags, description, steps, Examples. Rules: heading,
 *    tags, description, then their Backgrounds and scenarios one level down.
 *  - Tags: one paragraph (class `dk-gherkin__tags`) of `inlineCode` nodes,
 *    sorted and de-duplicated by the view; `@dk:*` metadata tags are dropped
 *    (`displayTags`, shared with the agent Markdown of an include).
 *  - Steps: an unordered `list` (class `dk-gherkin__steps`), each item
 *    `strong.dk-gherkin__kw` (the keyword as written) + a space + the text, with
 *    double-quoted arguments (quotes included) and outline placeholders as
 *    `inlineCode`, so typography never rewrites them; so are the quoted arguments
 *    in a table cell. A data table is a GFM `table` (first
 *    row = header) and a doc string a `code` node (`lang` = the view's language,
 *    `data.dkGherkin = 'docstring'` so the stage never revisits it), both inside
 *    the step's list item.
 *  - Examples: a paragraph `strong("<Keyword>:") <name>`, then tags,
 *    description and a `table`.
 *  - Source line (includes only, last): `Source: <path>` or, with a selection,
 *    `From <Feature title>, <path>`; `<path>` is `inlineCode`, linked when an
 *    `href` is given.
 *  - Comments (`#`) never render: the view does not carry them.
 *
 * Descriptions and the narrative are Markdown, as they are in `render.mjs`
 * (which writes the narrative lines through verbatim, so a generated page shows
 * `` `spec-kitty init` `` in an "I want" line as code). They are parsed by the
 * INJECTED `parseMarkdown`
 * (the stage builds it from the host processor's micromark/from-markdown
 * extensions, so GFM and directives behave as in the page), which keeps this
 * module free of unified. Typography (`remark-smartypants`) is the stage's job,
 * over the whole returned subtree.
 *
 * PURITY CONTRACT: the only runtime import is `./view.mjs` (pure; it brings the
 * import-free `./text.mjs`), so this module loads in bare Node. Nodes are plain
 * objects typed structurally below (`@types/mdast` is not a toolkit dependency).
 *
 * @module gherkin/mdast
 */

import { cellSegments, childLevel, displayTags, resolveLevels, summaryText, titleOf } from './view.mjs';

/** @typedef {import('./view.mjs').FeatureView} FeatureView */
/** @typedef {import('./view.mjs').SectionView} SectionView */
/** @typedef {import('./view.mjs').RuleView} RuleView */
/** @typedef {import('./view.mjs').StepView} StepView */
/** @typedef {import('./view.mjs').ExamplesView} ExamplesView */
/** @typedef {import('./view.mjs').HeaderMode} HeaderMode */

/**
 * Minimal structural mdast node: enough to build the subtree and for the stage
 * to splice it in.
 *
 * @typedef {object} MdNode
 * @property {string} type
 * @property {MdNode[]} [children]
 * @property {string} [value]
 * @property {Record<string, unknown>} [data]
 */

/**
 * @typedef {object} SourceLine
 * @property {string} path The included file, project-root relative (POSIX).
 * @property {string} [href] Link target for the path (`sourceUrlPrefix` + path
 *   relative to `sourceRoot`); unlinked when absent.
 * @property {string} [featureTitle] Cited with a selection; defaults to the
 *   view's title.
 * @property {boolean} [selected] True when `scenario`/`tags` selected part of
 *   the file (03 §4.6).
 */

/**
 * @typedef {object} MdastOptions
 * @property {number} [baseLevel] `B` from 03 §4.2 (the stage computes it from
 *   the page). Default 2: an embed never adds a second H1.
 * @property {HeaderMode} [header] Default `'full'`.
 * @property {SourceLine} [source] Emit the include source line (never for a fence).
 * @property {(markdown: string) => MdNode[]} [parseMarkdown] Description and
 *   narrative Markdown → block nodes. Without it a description is one literal
 *   paragraph and the narrative literal lines.
 * @property {boolean} [inContainer] The block sits inside a list item,
 *   blockquote, aside or other non-root parent: headings become
 *   `p[role=heading]`.
 */

/** The class names of 03 §4 (styled in `src/styles/dk-components.css`). */
export const GHERKIN_CLASSES = Object.freeze({
  container: 'dk-gherkin',
  steps: 'dk-gherkin__steps',
  keyword: 'dk-gherkin__kw',
  tags: 'dk-gherkin__tags',
  source: 'dk-gherkin__source',
});

/** The marker on emitted doc-string `code` nodes (03 §3: never revisited). */
export const DOCSTRING_MARK = 'docstring';

/**
 * @param {string} value
 * @returns {MdNode}
 */
const text = (value) => ({ type: 'text', value });

/**
 * @param {string} value
 * @returns {MdNode}
 */
const inlineCode = (value) => ({ type: 'inlineCode', value });

/**
 * `data` that gives a node a class (merged into the hast element's properties).
 *
 * @param {string} className
 */
const classed = (className) => ({ hProperties: { className: [className] } });

/**
 * A heading, or its in-container `p[role=heading]` stand-in. Never an id.
 *
 * @param {number} level Already capped by the level plan.
 * @param {string} value Plain heading text.
 * @param {boolean} inContainer
 * @returns {MdNode}
 */
function heading(level, value, inContainer) {
  if (!inContainer) return { type: 'heading', depth: level, children: [text(value)] };
  return {
    type: 'paragraph',
    data: { hName: 'p', hProperties: { role: 'heading', ariaLevel: level } },
    children: [text(value)],
  };
}

/**
 * The tags paragraph, or nothing when no displayable tag is left.
 *
 * @param {readonly string[]} tags
 * @returns {MdNode[]}
 */
function tagsParagraph(tags) {
  const shown = displayTags(tags);
  if (shown.length === 0) return [];
  /** @type {MdNode[]} */
  const children = [];
  shown.forEach((t, i) => {
    if (i > 0) children.push(text(' '));
    children.push(inlineCode(t));
  });
  return [{ type: 'paragraph', data: classed(GHERKIN_CLASSES.tags), children }];
}

/**
 * Description block nodes (`[]` when there is none).
 *
 * @param {string} description Dedented Markdown from the view.
 * @param {MdastOptions['parseMarkdown']} parseMarkdown
 * @returns {MdNode[]}
 */
function descriptionNodes(description, parseMarkdown) {
  if (!description) return [];
  if (parseMarkdown) return parseMarkdown(description);
  return [{ type: 'paragraph', children: [text(description)] }];
}

/**
 * The narrative paragraph (`[]` when there is none): the lines joined by hard
 * breaks. With `parseMarkdown` it is parsed from EXACTLY the string `render.mjs`
 * writes (`lines.join('\\\n')`), so inline code, emphasis and links in a user
 * story render as they do on a generated page; without it, literal lines and
 * `break` nodes.
 *
 * @param {readonly string[]} narrative
 * @param {MdastOptions['parseMarkdown']} parseMarkdown
 * @returns {MdNode[]}
 */
function narrativeNodes(narrative, parseMarkdown) {
  if (narrative.length === 0) return [];
  if (parseMarkdown) return parseMarkdown(narrative.join('\\\n'));
  return [{ type: 'paragraph', children: linesWithBreaks(narrative) }];
}

/**
 * Literal text with its line breaks as `break` nodes (a Gherkin `\n` cell
 * escape; the narrative's lines).
 *
 * @param {readonly string[]} lines
 * @returns {MdNode[]}
 */
function linesWithBreaks(lines) {
  /** @type {MdNode[]} */
  const out = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push({ type: 'break' });
    if (line) out.push(text(line));
  });
  return out;
}

/**
 * One table cell's content: its lines joined by `break` nodes, each line's
 * quoted arguments (segmented by the view) as `inlineCode`, as in step text.
 *
 * @param {string} cell
 * @returns {MdNode[]}
 */
function cellNodes(cell) {
  /** @type {MdNode[]} */
  const out = [];
  cell.split(/\r\n?|\n/).forEach((line, i) => {
    if (i > 0) out.push({ type: 'break' });
    for (const s of cellSegments(line)) out.push(s.kind === 'text' ? text(s.value) : inlineCode(s.value));
  });
  return out;
}

/**
 * A GFM table; the first row is the header row.
 *
 * @param {readonly string[][]} rows
 * @returns {MdNode}
 */
function table(rows) {
  return {
    type: 'table',
    align: rows[0].map(() => null),
    children: rows.map((row) => ({
      type: 'tableRow',
      children: row.map((cell) => ({ type: 'tableCell', children: cellNodes(cell) })),
    })),
  };
}

/**
 * One step's list item: keyword, text, and its argument (if any).
 *
 * @param {StepView} step
 * @returns {MdNode}
 */
function stepItem(step) {
  /** @type {MdNode[]} */
  const line = [
    { type: 'strong', data: classed(GHERKIN_CLASSES.keyword), children: [text(step.keyword)] },
    text(' '),
  ];
  for (const s of step.segments) {
    if (s.kind !== 'text') line.push(inlineCode(s.value));
    // Adjacent prose (the space after the keyword) merges into one text node.
    else if (line[line.length - 1].type === 'text') line[line.length - 1].value += s.value;
    else line.push(text(s.value));
  }
  /** @type {MdNode[]} */
  const children = [{ type: 'paragraph', children: line }];
  if (step.dataTable && step.dataTable.length > 0) children.push(table(step.dataTable));
  if (step.docString) {
    children.push({
      type: 'code',
      lang: step.docString.language,
      meta: null,
      value: step.docString.content,
      data: { dkGherkin: DOCSTRING_MARK },
    });
  }
  return { type: 'listItem', spread: false, checked: null, children };
}

/**
 * @param {readonly StepView[]} steps
 * @returns {MdNode[]}
 */
function stepsList(steps) {
  if (steps.length === 0) return [];
  return [
    {
      type: 'list',
      ordered: false,
      start: null,
      spread: false,
      data: classed(GHERKIN_CLASSES.steps),
      children: steps.map(stepItem),
    },
  ];
}

/**
 * @param {ExamplesView} examples
 * @param {MdastOptions['parseMarkdown']} parseMarkdown
 * @returns {MdNode[]}
 */
function examplesNodes(examples, parseMarkdown) {
  /** @type {MdNode[]} */
  const label = [{ type: 'strong', children: [text(`${examples.keyword}:`)] }];
  if (examples.name) label.push(text(` ${examples.name}`));
  return [
    { type: 'paragraph', children: label },
    ...tagsParagraph(examples.tags),
    ...descriptionNodes(examples.description, parseMarkdown),
    ...(examples.rows.length > 0 ? [table(examples.rows)] : []),
  ];
}

/**
 * A Background or Scenario; a synthetic scenario has no heading.
 *
 * @param {SectionView} section
 * @param {number} level
 * @param {MdastOptions} opts
 * @returns {MdNode[]}
 */
function sectionNodes(section, level, opts) {
  return [
    ...(section.synthetic ? [] : [heading(level, titleOf(section), Boolean(opts.inContainer))]),
    ...tagsParagraph(section.tags),
    ...descriptionNodes(section.description, opts.parseMarkdown),
    ...stepsList(section.steps),
    ...section.examples.flatMap((ex) => examplesNodes(ex, opts.parseMarkdown)),
  ];
}

/**
 * @param {RuleView} rule
 * @param {number} level
 * @param {MdastOptions} opts
 * @returns {MdNode[]}
 */
function ruleNodes(rule, level, opts) {
  return [
    heading(level, titleOf(rule), Boolean(opts.inContainer)),
    ...tagsParagraph(rule.tags),
    ...descriptionNodes(rule.description, opts.parseMarkdown),
    ...rule.children.flatMap((c) => sectionNodes(c, childLevel(level), opts)),
  ];
}

/**
 * The include source line (03 §4.6).
 *
 * @param {SourceLine} source
 * @param {FeatureView} view
 * @returns {MdNode}
 */
function sourceParagraph(source, view) {
  /** @type {MdNode} */
  const pathNode = source.href
    ? { type: 'link', url: source.href, title: null, children: [inlineCode(source.path)] }
    : inlineCode(source.path);
  const lead = source.selected ? `From ${source.featureTitle ?? view.title}, ` : 'Source: ';
  return { type: 'paragraph', data: classed(GHERKIN_CLASSES.source), children: [text(lead), pathNode] };
}

/**
 * Emit a feature view as the `dkGherkin` container node of 03 §4.
 *
 * @param {FeatureView} view
 * @param {MdastOptions} [opts]
 * @returns {MdNode} The container; its `children` are the rendered feature.
 */
export function featureMdast(view, opts = {}) {
  const { baseLevel = 2, header = 'full', source, parseMarkdown, inContainer = false } = opts;
  const levels = resolveLevels(view, { baseLevel, header });

  /** @type {MdNode[]} */
  const children = [];
  if (levels.header !== 'none') children.push(heading(levels.feature, view.title, inContainer));
  if (levels.header === 'full') {
    children.push(...tagsParagraph(view.tags));
    children.push(...narrativeNodes(view.narrative, parseMarkdown));
    children.push(...descriptionNodes(view.description, parseMarkdown));
    const summary = summaryText(view.counts);
    if (summary) children.push({ type: 'paragraph', children: [{ type: 'emphasis', children: [text(summary)] }] });
  }
  for (const child of view.children) {
    if (child.kind === 'rule') children.push(...ruleNodes(child, levels.section, opts));
    else children.push(...sectionNodes(child, levels.section, opts));
  }
  if (source) children.push(sourceParagraph(source, view));

  return {
    type: 'dkGherkin',
    data: { hName: 'div', hProperties: { className: [GHERKIN_CLASSES.container] } },
    children,
  };
}
