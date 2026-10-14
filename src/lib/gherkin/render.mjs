/**
 * Gherkin → Markdown body renderer (ADR-0046; mapping contract §4/§5, WP04).
 *
 * Turns one parsed `GherkinDocument` (the plain-object AST `@cucumber/gherkin`
 * builds) into the Markdown body of a generated feature page: everything AFTER
 * the frontmatter, starting with `# <Feature name>` and ending with exactly one
 * trailing newline. The frontmatter is WP03's job (`feature-core.mjs`); the page
 * assembly and writes are WP05's.
 *
 * Shape (normative in the mapping contract §4):
 *
 *  - Heading levels: Feature `#`. Without Rules, Background and Scenarios are
 *    `##`. With Rules, Rule is `##` and its children `###`; Background/Scenarios
 *    before the first Rule stay `##` (MD001-safe either way).
 *  - Keywords are rendered as written in the source (trimmed), so i18n keywords
 *    stay localised.
 *  - Steps are list items `- **<Keyword>** <escaped text>` (prose, so glossary
 *    auto-linking can reach them). Double-quoted arguments (quotes included)
 *    and, in a Scenario Outline, `<placeholder>`s become inline code.
 *  - DataTable / DocString step arguments nest under their list item (2-space
 *    indent, blank line before and after: MD031/MD058).
 *  - Examples are a bold label paragraph + inline tags + description + table.
 *  - Descriptions are dedented and passed through as Markdown (repo-committed
 *    text, the same trust boundary as authored `docs/`). The Feature's leading
 *    narrative block gets hard line breaks.
 *  - A summary line follows the Feature description.
 *
 * Step text, names and table cells are LITERAL text and go through the escapers
 * below, so none of this pipeline's active syntaxes (CommonMark, GFM — including
 * its autolink literals — smartypants aside, `remark-directive`, Markua attribute
 * lists) fire on them.
 *
 * The document walk itself (titles, narrative, tag order, counts, outline
 * placeholders, rules, backgrounds) is `view.mjs`'s, shared with the in-page
 * mdast emitter (`mdast.mjs`, ADR-0051) so the two cannot drift. This module
 * owns the Markdown syntax: the escapers and the block layout.
 *
 * PURITY CONTRACT: the only runtime imports are `./text.mjs` (itself
 * import-free), `./view.mjs` (pure; it brings the fs-free
 * `../vocabulary-core.mjs` comparator) and `./results.mjs` (pure; `node:path`
 * and `node:url` only, for the result words of an embed), so this module loads in the Astro build
 * AND in the bare-Node `generate-feature-pages.mjs --check` gate. The AST is a
 * plain object; the `@cucumber/messages` references below are type-only JSDoc
 * imports.
 *
 * @module gherkin/render
 */

import { RESULT_COLUMN, countsText, outcomeLabel, provenance } from './results.mjs';
import { GHERKIN_LOG_PREFIX } from './text.mjs';
import { cellSegments, childLevel, displayTags, featureView, resolveLevels, summaryText } from './view.mjs';

/** @typedef {import('@cucumber/messages').GherkinDocument} GherkinDocument */
/** @typedef {import('./view.mjs').FeatureView} FeatureView */
/** @typedef {import('./view.mjs').SectionView} SectionView */
/** @typedef {import('./view.mjs').StepView} StepView */
/** @typedef {import('./view.mjs').ExamplesView} ExamplesView */
/** @typedef {import('./view.mjs').HeaderMode} HeaderMode */
/** @typedef {import('./results.mjs').Outcome} Outcome */
/** @typedef {import('./results.mjs').FeatureResults} FeatureResults */
/** @typedef {import('./results.mjs').StaleResults} StaleResults */

/**
 * @typedef {object} RenderOptions
 * @property {string} [file] Source path used in warnings (e.g. `features/a.feature`).
 * @property {(msg: string) => void} [warn] Warning sink (defaults to a no-op).
 * @property {number} [lineOffset] Added to the lines warnings cite. Default 0.
 * @property {number} [baseLevel] The Feature title's heading level. Default 1
 *   (a generated page's H1).
 * @property {HeaderMode} [header] Default `'full'`.
 * @property {{ feature?: boolean, scenario?: boolean }} [synthetic] Levels a
 *   fragment wrap synthesised (see `view.mjs`); they render no heading.
 * @property {FeatureView} [view] The document's view, when the caller already
 *   built it (with the same `synthetic`): saves a second walk.
 * @property {boolean} [embed] Render as an EMBED, the agent Markdown of an
 *   include, so it lists the same tags in the same places as the HTML
 *   (`mdast.mjs`): the `full` header carries the Feature's tags, every tag list
 *   follows its heading directly (before the description), and `@dk:*`
 *   metadata tags are dropped (`displayTags`). Default off: a generated page
 *   puts the Feature's tags in frontmatter and keeps its layout byte for byte.
 * @property {boolean} [inContainer] The include sits in a list item or
 *   blockquote: headings become bold lines, as the HTML renders
 *   `p[role=heading]` there, so the expansion neither reaches an outline nor
 *   breaks its container's.
 * @property {FeatureResults | StaleResults} [results] The feature's results
 *   (ADR-0052), as `mdast.mjs` shows them: a `Result: **<status>**` line after
 *   each scenario heading, a `Result` column on each Examples table and a
 *   `**Results:**` line after the summary. Only an EMBED is given results: a
 *   generated page's committed Markdown never carries them (it would drift
 *   with every run), and the in-page stage adds them when it renders the page.
 */

/**
 * Characters that can NOT start a `remark-directive` name (micromark's
 * `unicodeWhitespace` / `unicodePunctuation`): a `:` followed by anything else
 * would open a text directive.
 */
const DIRECTIVE_NAME_STOP = /[\s\p{P}\p{S}]/u;

/**
 * The inert empty HTML comment that splits a GFM autolink literal. GFM turns
 * `www.x.y`, `http(s)://…` and `a@b.cd` in plain text into links twice over:
 * micromark's literal-autolink tokenizer, and `mdast-util-gfm-autolink-literal`'s
 * post-parse transform over each mdast TEXT NODE's decoded value. A backslash or
 * entity escape (`www\.x.y`, `a&#64;b.cd`) survives only the first — the
 * decoded text is unchanged, so the transform still links it. Splitting the text
 * node is what defeats both, and an empty comment does that while rendering
 * nothing: the visible text, copy-paste, the heading ids and the TOC are all
 * unchanged (MD033 is off; markdownlint's MD034 no longer sees a bare URL).
 */
export const AUTOLINK_BREAK = '<!---->';

/**
 * Indices in `text` before which {@link AUTOLINK_BREAK} goes, one per GFM
 * autolink-literal trigger (mirroring the `unsafe` patterns
 * `mdast-util-gfm-autolink-literal` itself declares for serialising text):
 *
 * - `www` + `.` (any case) → break before the `.`;
 * - `http`/`https` + `://` (any case) → break before the `:`;
 * - an `@` between an email local-part character (`[+\-.\w]`) and a domain
 *   character (`[\-.\w]`) → break before the `@`.
 *
 * @param {string} text Raw (unescaped) literal text.
 * @returns {Set<number>}
 */
function autolinkBreaks(text) {
  /** @type {Set<number>} */
  const at = new Set();
  for (const m of text.matchAll(/www(?=\.)/gi)) at.add((m.index ?? 0) + 3);
  for (const m of text.matchAll(/https?(?=:\/\/)/gi)) at.add((m.index ?? 0) + m[0].length);
  for (const m of text.matchAll(/[-+.\w](?=@[-.\w])/g)) at.add((m.index ?? 0) + 1);
  return at;
}

/**
 * Escape literal text for an inline Markdown context (step text, names).
 *
 * - `\` `` ` `` `*` `_` `[` `]` `{` `}` `~` → backslash (emphasis, code, links,
 *   GFM strikethrough, Markua attribute lists).
 * - `<` `>` `&` → `&lt;` `&gt;` `&amp;` (raw HTML renders: MD033 is off).
 * - `:` followed by a character that can start a directive name → `\:`.
 *   `remark-directive` parses `word:name` (and `10:30`!) as a text directive
 *   even WITHOUT a `[label]`; a name may start with anything but whitespace or
 *   Unicode punctuation/symbols (micromark-extension-directive `factoryName`).
 * - GFM autolink literals (`www.x.y`, `https://…`, `a@b.cd`) → split with
 *   {@link AUTOLINK_BREAK} (see there for why a backslash does not work).
 *
 * `|` is NOT escaped here (only meaningful inside table cells; see
 * {@link escapeCell}). Quotes, dashes and ellipses are left for smartypants.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeInline(text) {
  const breaks = autolinkBreaks(text);
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (breaks.has(i)) out += AUTOLINK_BREAK;
    switch (ch) {
      case '\\':
      case '`':
      case '*':
      case '_':
      case '[':
      case ']':
      case '{':
      case '}':
      case '~':
        out += `\\${ch}`;
        break;
      case '<':
        out += '&lt;';
        break;
      case '>':
        out += '&gt;';
        break;
      case '&':
        out += '&amp;';
        break;
      case ':':
        out += i + 1 < text.length && !DIRECTIVE_NAME_STOP.test(text[i + 1]) ? '\\:' : ':';
        break;
      default:
        out += ch;
    }
  }
  return out;
}

/**
 * Escape literal text for a GFM table cell: {@link escapeInline} plus `\|`. A
 * newline (Gherkin's `\n` cell escape) cannot live in a GFM row, so it becomes
 * `<br>`.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeCell(text) {
  return text
    .split(/\r\n?|\n/)
    .map((line) => escapeInline(line).replace(/\|/g, '\\|'))
    .join('<br>');
}

/**
 * Escape literal text for an ATX heading (or any line-initial position):
 * {@link escapeInline}, plus a leading `#`, `>`, `-` or `+` gets a backslash, a
 * leading ordered-list marker (`1.` / `1)`) gets its `.`/`)` backslashed (a
 * backslash before a digit is not an escape in CommonMark), and a trailing run
 * of `#` that would read as an ATX closing sequence gets a backslash.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeHeading(text) {
  let out = escapeInline(text);
  if (/^[#>+-]/.test(out)) {
    out = `\\${out}`;
  } else {
    out = out.replace(/^(\d+)([.)])/, '$1\\$2');
  }
  // `## foo #` — a space-preceded trailing `#` run is a closing sequence and
  // would be stripped; `\#` breaks it. (A whole-`#` name is handled above.)
  out = out.replace(/([ \t])(#+)$/, '$1\\$2');
  return out;
}

/**
 * The backtick fence for a fenced code block holding `content`: length
 * `max(3, longest backtick run + 1)`.
 *
 * @param {string} content
 * @returns {string}
 */
export function fenceFor(content) {
  return '`'.repeat(Math.max(3, longestBacktickRun(content) + 1));
}

/** @param {string} text */
function longestBacktickRun(text) {
  let longest = 0;
  for (const run of text.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  return longest;
}

/**
 * An inline code span holding `text` verbatim (fence one longer than its longest
 * backtick run; padded when it starts/ends with a backtick).
 *
 * @param {string} text
 * @returns {string}
 */
function codeSpan(text) {
  const fence = '`'.repeat(longestBacktickRun(text) + 1);
  const pad = /^`|`$/.test(text) ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/**
 * Step text: escaped prose, with quoted arguments and `<placeholder>`s
 * (segmented by the view) as inline code.
 *
 * @param {StepView} step
 */
function renderStepText(step) {
  return step.segments.map((s) => (s.kind === 'text' ? escapeInline(s.value) : codeSpan(s.value))).join('');
}

/**
 * A heading/label title: `<Keyword>: <name>`, or just `<Keyword>` when unnamed.
 * Keyword and name are escaped separately (each may sit line-initially).
 *
 * @param {{ keyword: string, name: string }} node A view node (both trimmed).
 */
function titled({ keyword, name }) {
  const k = escapeHeading(keyword);
  return name ? `${k}: ${escapeHeading(name)}` : k;
}

/**
 * An ATX heading at `level` (already capped by the view's level plan).
 *
 * @param {number} level
 * @param {string} text Escaped heading text.
 */
function heading(level, text) {
  return `${'#'.repeat(level)} ${text}`;
}

/**
 * Tags as inline code (`` `@a` `@b` ``); `''` when none. The view has already
 * sorted and de-duplicated them.
 *
 * @param {readonly string[]} tags
 */
function renderTags(tags) {
  return tags.map(codeSpan).join(' ');
}

/**
 * One table cell: escaped prose, with its quoted arguments (segmented by the
 * view) as inline code, as in step text; lines joined by `<br>` as in
 * {@link escapeCell}, which this equals for a cell without a quoted argument.
 *
 * Every `|` gets a backslash, inside a code span too: a GFM row splits on a bare
 * `|` even there, and removes that backslash again before the span is parsed.
 * An argument holding `\|` cannot be written as a code span in a cell at all (a
 * GFM row reads `\\|` as a cell boundary), so it stays escaped text.
 *
 * @param {string} cell
 * @returns {string}
 */
function renderCell(cell) {
  return cell
    .split(/\r\n?|\n/)
    .map((line) =>
      cellSegments(line)
        .map((s) =>
          s.kind === 'text' || s.value.includes('\\|') ? escapeCell(s.value) : codeSpan(s.value).replace(/\|/g, '\\|'),
        )
        .join(''),
    )
    .join('<br>');
}

/**
 * GFM table lines (header = first row; a 1-row table is header + delimiter).
 *
 * @param {readonly string[][]} rows Cell values.
 * @returns {string[]}
 */
function tableLines(rows) {
  if (rows.length === 0) return [];
  const row = (/** @type {readonly string[]} */ r) =>
    `|${r.map((c) => (c === '' ? ' ' : ` ${renderCell(c)} `)).join('|')}|`;
  const [head, ...body] = rows;
  const delimiter = `|${head.map(() => ' --- ').join('|')}|`;
  return [row(head), delimiter, ...body.map(row)];
}

/**
 * A step argument's lines (DataTable or DocString), un-indented.
 *
 * @param {StepView} step
 * @returns {string[] | null}
 */
function argumentLines(step) {
  if (step.dataTable) return tableLines(step.dataTable);
  if (step.docString) {
    const { content, language } = step.docString;
    const fence = fenceFor(content);
    return [`${fence}${language}`, ...(content === '' ? [] : content.split(/\r\n?|\n/)), fence];
  }
  return null;
}

/**
 * The steps list. An item carrying an argument nests it (2-space indent) behind
 * a blank line and is followed by a blank line before the next item.
 *
 * @param {readonly StepView[]} steps
 */
function renderSteps(steps) {
  let out = '';
  steps.forEach((step, i) => {
    out += `- **${escapeInline(step.keyword)}** ${renderStepText(step)}`;
    const arg = argumentLines(step);
    if (arg) {
      out += `\n\n${arg.map((l) => (l === '' ? '' : `  ${l}`)).join('\n')}`;
    }
    if (i < steps.length - 1) out += arg ? '\n\n' : '\n';
  });
  return out;
}

/**
 * One Examples block: bold label (+ inline tags), description, table (with a
 * `Result` column when the feature has current results).
 *
 * @param {ExamplesView} examples
 * @param {Layout} layout
 * @param {FeatureResults | StaleResults} [results]
 * @returns {string[]}
 */
function renderExamples(examples, layout, results) {
  const tags = renderTags(layout.tags(examples.tags));
  const label = `**${titled(examples)}**${tags ? ` ${tags}` : ''}`;
  const blocks = [label];
  if (examples.description) blocks.push(examples.description);
  if (examples.rows.length > 0) {
    const lines = tableLines(examples.rows);
    if (results?.state === 'current') {
      // The `Result` column (ADR-0052): the header, the delimiter, then one
      // status word per body row, as `mdast.mjs`'s `addResultColumn` adds it.
      const extra = [
        RESULT_COLUMN,
        '---',
        ...examples.rowLines.map((line) => outcomeLabel(results.rows.get(line) ?? { status: 'not-run' })),
      ];
      lines.forEach((l, i) => {
        lines[i] = `${l} ${extra[i]} |`;
      });
    }
    blocks.push(lines.join('\n'));
  }
  return blocks;
}

/**
 * A scenario's result line: `Result: **Failed** (1 passed, 1 failed)`.
 *
 * @param {Outcome} outcome
 */
function resultLine(outcome) {
  const counts = outcome.counts ? countsText(outcome.counts) : '';
  return `Result: **${outcomeLabel(outcome)}**${counts ? ` (${counts})` : ''}`;
}

/**
 * The feature's results line: `**Results:** 1 failed, 3 passed · as of
 * 2026-10-14 · commit \`3f1c2a9\``, or the "not shown" note for a stale report.
 *
 * @param {FeatureResults | StaleResults} results
 */
function resultsSummaryLine(results) {
  if (results.state === 'stale') {
    return '**Results not shown:** the test report was made from a different version of this file.';
  }
  const { day, revision } = provenance(results.run);
  let line = `**Results:** ${countsText(results.counts) || 'none'}`;
  if (day) line += ` · as of ${day}`;
  if (revision) line += ` · commit ${codeSpan(revision)}`;
  return line;
}

/**
 * How one rendering lays out headings and tags: a generated page's (slice C)
 * or an embed's (see `embed` / `inContainer` in {@link RenderOptions}).
 *
 * @typedef {object} Layout
 * @property {(level: number, text: string) => string} heading
 * @property {(tags: readonly string[]) => string[]} tags The tags shown, sorted.
 * @property {boolean} tagsFirst Tags directly after the heading (embeds) rather
 *   than after the description (generated pages).
 */

/** @type {Layout} */
const PAGE_LAYOUT = { heading, tags: (tags) => [...tags], tagsFirst: false };

/**
 * @param {Pick<RenderOptions, 'embed' | 'inContainer'>} opts
 * @returns {Layout}
 */
function layoutFor({ embed = false, inContainer = false }) {
  return {
    heading: inContainer ? (_level, text) => `**${text}**` : heading,
    tags: embed ? displayTags : PAGE_LAYOUT.tags,
    tagsFirst: embed,
  };
}

/**
 * A heading (or label) block, then its tags and description in the layout's
 * order.
 *
 * @param {string} head The heading block.
 * @param {{ tags: readonly string[], description: string }} node
 * @param {Layout} layout
 * @returns {string[]}
 */
function headed(head, { tags, description }, layout) {
  const shown = renderTags(layout.tags(tags));
  const after = layout.tagsFirst ? [shown, description] : [description, shown];
  return [head, ...after].filter(Boolean);
}

/**
 * A Background or Scenario (incl. Outline) section. A synthetic scenario (a
 * wrapped fragment) has no heading.
 *
 * @param {SectionView} section
 * @param {number} level Heading depth.
 * @param {Layout} layout
 * @param {FeatureResults | StaleResults} [results]
 * @returns {string[]}
 */
function renderSection(section, level, layout, results) {
  const blocks = headed(section.synthetic ? '' : layout.heading(level, titled(section)), section, layout);
  const outcome = results?.state === 'current' && section.kind === 'scenario' ? results.scenarios.get(section.line) : undefined;
  // Directly after the heading, as the HTML puts it (ADR-0052).
  if (outcome) blocks.splice(section.synthetic ? 0 : 1, 0, resultLine(outcome));
  if (section.steps.length > 0) blocks.push(renderSteps(section.steps));
  for (const ex of section.examples) blocks.push(...renderExamples(ex, layout, results));
  return blocks;
}

/**
 * @typedef {object} DuplicateOptions
 * @property {string} [file] Source path used in warnings.
 * @property {(msg: string) => void} [warn] Warning sink (defaults to a no-op).
 * @property {number} [lineOffset] Added to every cited line (a fence's lines are
 *   relative to its content; 03 §5). Default 0.
 */

/**
 * Warn on duplicate sibling scenario headings (MD024 `siblings_only` rejects
 * them; the scenario anchor would also be suffixed). Siblings are the top-level
 * scenarios, then each Rule's scenarios, in document order.
 *
 * @param {FeatureView} view
 * @param {DuplicateOptions} [opts]
 */
export function warnDuplicates(view, opts = {}) {
  const { file = '<unknown>', warn = () => {}, lineOffset = 0 } = opts;
  /** @type {SectionView[][]} */
  const groups = [[]];
  for (const c of view.children) {
    if (c.kind === 'rule') groups.push(c.children.filter((rc) => rc.kind === 'scenario'));
    else if (c.kind === 'scenario') groups[0].push(c);
  }
  for (const group of groups) {
    /** @type {Map<string, number>} */
    const seen = new Map();
    for (const s of group) {
      const key = titled(s);
      const line = s.line + lineOffset;
      const first = seen.get(key);
      if (first === undefined) {
        seen.set(key, line);
      } else {
        warn(
          `${GHERKIN_LOG_PREFIX} ${file}:${line} duplicate scenario name "${s.name}" ` +
            `(also at line ${first}) — markdownlint MD024 will reject the duplicate heading`,
        );
      }
    }
  }
}

/**
 * Render a parsed Gherkin document as Markdown: by default, the body of its
 * generated feature page.
 *
 * `baseLevel`, `header`, `embed` and `inContainer` exist for embeds (the agent
 * Markdown of an include, 02 §Agent surface); the defaults (`1`, `'full'`, off,
 * off) are slice C's output, byte for byte. Levels follow the view's shared
 * plan (`resolveLevels`, 03 §4.2) and are capped at 6. Without `embed` the
 * `full` header carries no tags: on a generated page the Feature's tags become
 * frontmatter.
 *
 * @param {GherkinDocument} document The parser output.
 * @param {RenderOptions} [opts]
 * @returns {string} The body (from `# <Feature name>`), ending in exactly one
 *   newline; `''` when the document has no Feature.
 */
export function renderFeatureBody(document, opts = {}) {
  const { baseLevel = 1, header = 'full', synthetic } = opts;
  const view = opts.view ?? featureView(document, { synthetic });
  if (!view) return '';
  const levels = resolveLevels(view, { baseLevel, header });
  const layout = opts.embed || opts.inContainer ? layoutFor(opts) : PAGE_LAYOUT;

  /** @type {string[]} */
  const blocks = [];
  if (levels.header !== 'none') {
    // The ONE unnamed-Feature fallback (`featureTitle`, via the view), shared
    // with the page title.
    blocks.push(layout.heading(levels.feature, escapeHeading(view.title)));
  }
  if (levels.header === 'full') {
    // The tags lead the header in an embed only (see `embed`).
    if (layout.tagsFirst) {
      const tags = renderTags(layout.tags(view.tags));
      if (tags) blocks.push(tags);
    }
    if (view.narrative.length > 0) blocks.push(view.narrative.join('\\\n'));
    if (view.description) blocks.push(view.description);
    const summary = summaryText(view.counts);
    if (summary) blocks.push(`*${summary}*`);
    if (opts.results) blocks.push(resultsSummaryLine(opts.results));
  }

  const { results } = opts;
  for (const child of view.children) {
    if (child.kind !== 'rule') {
      blocks.push(...renderSection(child, levels.section, layout, results));
      continue;
    }
    blocks.push(...headed(layout.heading(levels.section, titled(child)), child, layout));
    for (const rc of child.children) blocks.push(...renderSection(rc, childLevel(levels.section), layout, results));
  }
  warnDuplicates(view, opts);

  return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}

/**
 * The include source line (03 §4.6) as Markdown: the agent-surface twin of
 * `mdast.mjs`'s source paragraph, with the same text. `Source: <path>` for a
 * whole file, `From <Feature title>, <path>` for a selection; `<path>` is a code
 * span, linked when `href` is set. The title is literal text and is escaped.
 *
 * @param {{ path: string, href?: string, featureTitle: string, selected: boolean }} source
 * @returns {string} One line, no trailing newline.
 */
export function renderSourceLine({ path, href, featureTitle, selected }) {
  const code = codeSpan(path);
  // A destination with whitespace, parentheses or angle brackets needs the
  // `<…>` form (angle brackets themselves percent-encoded inside it).
  const dest = href && /[\s()<>]/.test(href) ? `<${href.replace(/[<>]/g, encodeURIComponent)}>` : href;
  const target = dest ? `[${code}](${dest})` : code;
  return selected ? `From ${escapeInline(featureTitle)}, ${target}` : `Source: ${target}`;
}
