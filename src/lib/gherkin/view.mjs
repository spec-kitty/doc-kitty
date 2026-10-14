/**
 * The Gherkin VIEW MODEL (ADR-0046 decision 8, extended by ADR-0051): the ONE
 * walk over a parsed `GherkinDocument` that every emitter shares.
 *
 * Two emitters turn a feature into output:
 *
 *  - `render.mjs` → the Markdown body of a generated feature page (slice C) and
 *    the agent Markdown of an include (its `embed` layout);
 *  - `mdast.mjs` → the mdast subtree a ```` ```gherkin ```` fence or a
 *    `::gherkin{…}` include is replaced with on a docs page (slices A/B).
 *
 * Everything the two must agree on is decided HERE, once: the Feature title
 * fallback (`featureTitle`), the narrative split (`splitNarrative`), description
 * normalisation, tag order and de-duplication, which tags an embed shows
 * (`displayTags`), the summary counts, where a step's quoted arguments and its
 * outline `<placeholder>`s are, data-table rows, doc-string languages, and the
 * scenario lines the duplicate-name warning cites. The emitters only decide
 * syntax (escaping, heading markers, node shapes). A second document walk in an
 * emitter is a review finding (drift risk): it is how a generated page and an
 * embed of the same feature would start to disagree. (`select.mjs` walks the
 * AST too, but to PRUNE it before the view is built, not to render it.)
 *
 * The view is plain data, in document order, with every keyword and name
 * trimmed. `#` comments are NOT carried: the parser keeps them in
 * `document.comments`, which the view never reads, so no emitter can render them
 * (03 §4.3).
 *
 * Synthetic levels: a fence holding only scenarios (or only steps) is parsed
 * inside a synthetic, untitled Feature (and Scenario) that `fragment.mjs` adds
 * (03 §1.3). The caller passes `{ synthetic: { feature, scenario } }` and the
 * view flags those levels, so emitters render NO heading for them; see
 * {@link resolveLevels}.
 *
 * PURITY CONTRACT: the only runtime imports are `./text.mjs` (import-free) and
 * the fs-free `../vocabulary-core.mjs` (THE code-unit comparator), so this
 * module loads in the Astro build and in the bare-Node `--check` gate. The AST
 * is a plain object; the `@cucumber/messages` references are type-only.
 *
 * @module gherkin/view
 */

import { compareCodeUnit } from '../vocabulary-core.mjs';
import { DK_TAG_PREFIX, dedent, featureTitle, splitNarrative } from './text.mjs';

/** @typedef {import('@cucumber/messages').GherkinDocument} GherkinDocument */
/** @typedef {import('@cucumber/messages').Background} Background */
/** @typedef {import('@cucumber/messages').Scenario} Scenario */
/** @typedef {import('@cucumber/messages').Rule} Rule */
/** @typedef {import('@cucumber/messages').Step} Step */
/** @typedef {import('@cucumber/messages').Examples} Examples */
/** @typedef {import('@cucumber/messages').Tag} Tag */
/** @typedef {import('@cucumber/messages').TableRow} TableRow */

/**
 * One run of step text: literal prose; an outline `<placeholder>` (kept with
 * its angle brackets, as the pickle compiler substitutes it); or a double-quoted
 * `argument` (kept WITH its quotes: `"spec-kitty init --force"`).
 *
 * Both emitters render a placeholder and an argument as inline code. For an
 * argument that is what keeps it copy-pasteable: as prose, the page's
 * typography (`remark-smartypants`) would curl its quotes and turn a `--flag`
 * into a dash, so a command or a value copied from a scenario would no
 * longer be the one the step matches. A placeholder inside an argument stays
 * part of that argument's code span (`"<name>.txt"`). A data-table or Examples
 * cell gets the same treatment for its quoted arguments ({@link cellSegments}),
 * so a `"--force"` copied from a table is the value too.
 *
 * @typedef {object} StepSegment
 * @property {'text' | 'placeholder' | 'argument'} kind
 * @property {string} value
 */

/**
 * @typedef {object} DocStringView
 * @property {string} content The doc string body, verbatim.
 * @property {string} mediaType The media type as written (`''` when none).
 * @property {string} language The code-block language both emitters use: the
 *   media type reduced to `[A-Za-z0-9+.#-]` (a fence info string must not hold
 *   spaces or backticks), or `text` when that leaves nothing (MD040 wants a
 *   language on every fence).
 */

/**
 * @typedef {object} StepView
 * @property {string} keyword The keyword as written, trimmed (`Given`, `Gegeven`).
 * @property {string} text The step text, verbatim.
 * @property {StepSegment[]} segments `text` split around double-quoted
 *   arguments and, in an outline, around the placeholders outside them. Empty
 *   prose runs are omitted.
 * @property {string[][] | null} dataTable Cell values, row by row (first row = header).
 * @property {DocStringView | null} docString
 */

/**
 * @typedef {object} ExamplesView
 * @property {string} keyword Trimmed (`Examples`, `Scenarios`, `Voorbeelden`).
 * @property {string} name Trimmed; `''` when unnamed.
 * @property {string[]} tags Sorted, de-duplicated tag names (`@` kept).
 * @property {string} description Dedented Markdown; `''` when none.
 * @property {string[][]} rows Header row first; `[]` when the block has no table.
 * @property {number[]} rowLines The source line of each BODY row (`rows[i + 1]`):
 *   an outline row's result is keyed by it (ADR-0055).
 * @property {number} line
 */

/**
 * A Background or a Scenario / Scenario Outline.
 *
 * @typedef {object} SectionView
 * @property {'background' | 'scenario'} kind
 * @property {string} keyword Trimmed.
 * @property {string} name Trimmed; `''` when unnamed.
 * @property {string[]} tags Sorted, de-duplicated (always `[]` for a Background).
 * @property {string} description Dedented Markdown; `''` when none.
 * @property {boolean} outline True when the scenario has Examples (its steps
 *   carry placeholder segments).
 * @property {StepView[]} steps
 * @property {ExamplesView[]} examples
 * @property {number} line Source line of the keyword (warnings cite it).
 * @property {boolean} synthetic True for the untitled Scenario a fragment was
 *   wrapped in: emitters render no heading for it.
 */

/**
 * @typedef {object} RuleView
 * @property {'rule'} kind
 * @property {string} keyword
 * @property {string} name
 * @property {string[]} tags
 * @property {string} description
 * @property {SectionView[]} children Backgrounds and scenarios, in order.
 * @property {number} line
 */

/**
 * @typedef {object} FeatureCounts
 * @property {number} rules
 * @property {number} scenarios Scenarios and outlines, top level and in Rules.
 * @property {number} exampleRows Examples body rows across every outline.
 */

/**
 * @typedef {object} FeatureView
 * @property {string} keyword Trimmed.
 * @property {string} name Trimmed; `''` when unnamed.
 * @property {string} title The display title (`featureTitle`): what the Feature
 *   heading shows and what an include's source line cites.
 * @property {boolean} synthetic True for the untitled Feature a fragment was
 *   wrapped in: emitters render no Feature header at all.
 * @property {string[]} tags Sorted, de-duplicated (`@dk:*` included: a generated
 *   page reads them into frontmatter; an embed shows {@link displayTags}).
 * @property {string[]} narrative The leading user-story lines (`splitNarrative`).
 * @property {string} description The description after the narrative, dedented,
 *   with blank-line runs collapsed to one; `''` when none.
 * @property {FeatureCounts} counts Of the AST as given (after any selection).
 * @property {Array<SectionView | RuleView>} children In document order.
 * @property {number} line
 */

/**
 * @typedef {object} ViewOptions
 * @property {{ feature?: boolean, scenario?: boolean }} [synthetic] Which levels
 *   `fragment.mjs` synthesised. `scenario` flags the Feature's first top-level
 *   scenario (the only one a steps-only fragment has).
 */

/** Outline placeholder, as the pickle compiler substitutes it. */
const PLACEHOLDER = /<[^<>\n]+>/g;

/**
 * A double-quoted step argument, quotes included: the shape Cucumber
 * Expressions' `{string}` matches (a backslash escapes the next character, so
 * `"say \"hi\""` is one argument). An unpaired `"` is prose.
 */
const QUOTED_ARGUMENT = /"(?:[^"\\\n]|\\.)*"/g;

/**
 * Description Markdown: dedented, with runs of blank lines collapsed to one
 * (MD012). `''` when there is none.
 *
 * @param {string | undefined} description
 */
function describe(description) {
  return dedent(description).replace(/\n{3,}/g, '\n\n');
}

/**
 * Tag names, sorted by code unit and de-duplicated.
 *
 * @param {readonly Tag[] | undefined} tags
 * @returns {string[]}
 */
function tagNames(tags) {
  return [...new Set((tags ?? []).map((t) => t.name))].sort(compareCodeUnit);
}

/**
 * @param {readonly TableRow[]} rows
 * @returns {string[][]}
 */
function rowValues(rows) {
  return rows.map((r) => r.cells.map((c) => c.value));
}

/**
 * Split `text` around the matches of `pattern`: the runs between them go to
 * `between`, each match becomes a `kind` segment.
 *
 * @param {string} text
 * @param {RegExp} pattern Global.
 * @param {StepSegment['kind']} kind
 * @param {(value: string) => StepSegment[]} between
 * @returns {StepSegment[]}
 */
function splitOn(text, pattern, kind, between) {
  /** @type {StepSegment[]} */
  const out = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const at = m.index ?? 0;
    out.push(...between(text.slice(last, at)));
    out.push({ kind, value: m[0] });
    last = at + m[0].length;
  }
  out.push(...between(text.slice(last)));
  return out;
}

/**
 * Split step text into prose, double-quoted arguments and (in an outline)
 * placeholders. Arguments are found first, so a placeholder inside one stays
 * part of it.
 *
 * @param {string} text
 * @param {boolean} outline
 * @returns {StepSegment[]}
 */
function segment(text, outline) {
  /** @type {(value: string) => StepSegment[]} */
  const prose = (value) => (value ? [{ kind: 'text', value }] : []);
  return splitOn(text, QUOTED_ARGUMENT, 'argument', (run) =>
    outline ? splitOn(run, PLACEHOLDER, 'placeholder', prose) : prose(run),
  );
}

/**
 * Split one line of a data-table or Examples cell into prose and double-quoted
 * arguments, as step text is split (placeholders are not: an Examples cell is a
 * value, and a data-table cell keeps its `<…>` as text, as before). Both emitters
 * call it per line of a cell, after splitting on a Gherkin `\n` cell escape, so
 * an argument never spans a line break.
 *
 * @param {string} line
 * @returns {StepSegment[]}
 */
export function cellSegments(line) {
  return segment(line, false);
}

/**
 * @param {Step} step
 * @param {boolean} outline
 * @returns {StepView}
 */
function stepView(step, outline) {
  const doc = step.docString;
  const mediaType = (doc?.mediaType ?? '').trim();
  return {
    keyword: step.keyword.trim(),
    text: step.text,
    segments: segment(step.text, outline),
    dataTable: step.dataTable ? rowValues(step.dataTable.rows) : null,
    docString: doc
      ? {
          content: doc.content,
          mediaType,
          language: mediaType.replace(/[^A-Za-z0-9+.#-]/g, '') || 'text',
        }
      : null,
  };
}

/**
 * @param {Examples} examples
 * @returns {ExamplesView}
 */
function examplesView(examples) {
  return {
    keyword: examples.keyword.trim(),
    name: examples.name.trim(),
    tags: tagNames(examples.tags),
    description: describe(examples.description),
    rows: examples.tableHeader ? rowValues([examples.tableHeader, ...examples.tableBody]) : [],
    rowLines: examples.tableHeader ? examples.tableBody.map((r) => r.location.line) : [],
    line: examples.location.line,
  };
}

/**
 * @param {Background | Scenario} node
 * @param {'background' | 'scenario'} kind
 * @param {boolean} synthetic
 * @returns {SectionView}
 */
function sectionView(node, kind, synthetic) {
  const examples = 'examples' in node ? node.examples : [];
  const outline = examples.length > 0;
  return {
    kind,
    keyword: node.keyword.trim(),
    name: node.name.trim(),
    tags: 'tags' in node ? tagNames(node.tags) : [],
    description: describe(node.description),
    outline,
    steps: node.steps.map((s) => stepView(s, outline)),
    examples: examples.map(examplesView),
    line: node.location.line,
    synthetic,
  };
}

/**
 * Build the view of a parsed document.
 *
 * @param {GherkinDocument} document The parser output (possibly pruned by a selection).
 * @param {ViewOptions} [opts]
 * @returns {FeatureView | null} `null` when the document has no Feature.
 */
export function featureView(document, opts = {}) {
  const feature = document.feature;
  if (!feature) return null;
  const synthetic = opts.synthetic ?? {};

  const counts = { rules: 0, scenarios: 0, exampleRows: 0 };
  /** @param {Scenario} s */
  const tally = (s) => {
    counts.scenarios += 1;
    for (const ex of s.examples) counts.exampleRows += ex.tableBody.length;
  };

  let syntheticScenarioPending = Boolean(synthetic.scenario);
  /** @type {Array<SectionView | RuleView>} */
  const children = [];
  for (const child of feature.children) {
    if (child.background) children.push(sectionView(child.background, 'background', false));
    if (child.scenario) {
      tally(child.scenario);
      children.push(sectionView(child.scenario, 'scenario', syntheticScenarioPending));
      syntheticScenarioPending = false;
    }
    if (child.rule) {
      const rule = child.rule;
      counts.rules += 1;
      /** @type {SectionView[]} */
      const ruleChildren = [];
      for (const rc of rule.children) {
        if (rc.background) ruleChildren.push(sectionView(rc.background, 'background', false));
        if (rc.scenario) {
          tally(rc.scenario);
          ruleChildren.push(sectionView(rc.scenario, 'scenario', false));
        }
      }
      children.push({
        kind: 'rule',
        keyword: rule.keyword.trim(),
        name: rule.name.trim(),
        tags: tagNames(rule.tags),
        description: describe(rule.description),
        children: ruleChildren,
        line: rule.location.line,
      });
    }
  }

  const { narrative, rest } = splitNarrative(feature.description);
  return {
    keyword: feature.keyword.trim(),
    name: feature.name.trim(),
    title: featureTitle(feature.name, feature.keyword),
    synthetic: Boolean(synthetic.feature),
    tags: tagNames(feature.tags),
    narrative,
    description: rest.replace(/\n{3,}/g, '\n\n'),
    counts,
    children,
    line: feature.location.line,
  };
}

/**
 * The tags an EMBED shows (an in-page block, and the agent Markdown of an
 * include): the view's sorted list without the reserved `@dk:*` metadata tags,
 * which only feed a generated page's frontmatter (03 §1.5). One filter, so the
 * HTML and the agent Markdown of the same include list the same tags.
 *
 * @param {readonly string[]} tags A view node's `tags`.
 * @returns {string[]}
 */
export function displayTags(tags) {
  return tags.filter((t) => !t.startsWith(DK_TAG_PREFIX));
}

/**
 * Does the view carry a reserved `@dk:*` metadata tag anywhere (feature, rule,
 * scenario, examples)? A fence warns about them: an embed has no frontmatter
 * for them to feed, so they have no effect (03 §1.5).
 *
 * @param {FeatureView} view
 * @returns {boolean}
 */
export function hasMetadataTag(view) {
  /** @param {readonly string[]} tags */
  const dk = (tags) => tags.length !== displayTags(tags).length;
  /** @param {SectionView | RuleView} node @returns {boolean} */
  const any = (node) =>
    node.kind === 'rule'
      ? dk(node.tags) || node.children.some(any)
      : dk(node.tags) || node.examples.some((ex) => dk(ex.tags));
  return dk(view.tags) || view.children.some(any);
}

/**
 * Pluralised count (`1 rule`, `2 rules`).
 *
 * @param {number} n
 * @param {string} noun
 */
function count(n, noun) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * The summary line's text (`2 rules · 5 scenarios · 3 example rows`), or `''`
 * when the feature has no scenarios. Both emitters print it, so a generated
 * page and an embed count alike.
 *
 * @param {FeatureCounts} counts
 * @returns {string}
 */
export function summaryText(counts) {
  if (counts.scenarios === 0) return '';
  const parts = [];
  if (counts.rules > 0) parts.push(count(counts.rules, 'rule'));
  parts.push(count(counts.scenarios, 'scenario'));
  if (counts.exampleRows > 0) parts.push(count(counts.exampleRows, 'example row'));
  return parts.join(' · ');
}

/**
 * `<Keyword>: <name>`, or just `<Keyword>` when unnamed: the heading text of a
 * Background, Scenario, Rule or Examples label, unescaped. (`render.mjs` escapes
 * keyword and name separately, so it composes its own from the same parts.)
 *
 * @param {{ keyword: string, name: string }} node
 * @returns {string}
 */
export function titleOf(node) {
  return node.name ? `${node.keyword}: ${node.name}` : node.keyword;
}

/** The deepest heading level HTML (and ATX Markdown) has. */
export const MAX_HEADING_LEVEL = 6;

/**
 * The header modes both emitters accept:
 *
 * - `full`: Feature title, tags (embeds only), narrative, description, summary;
 * - `title`: the Feature title alone;
 * - `none`: no Feature header (an include with a selection, 03 §2.5).
 *
 * @typedef {'full' | 'title' | 'none'} HeaderMode
 */

/**
 * @typedef {object} Levels
 * @property {HeaderMode} header The EFFECTIVE mode: `none` for a synthetic Feature.
 * @property {number} feature The Feature title's level.
 * @property {number} section Top-level Background/Scenario/Rule level: one below
 *   the Feature title when it is rendered, otherwise the base level (03 §4.2).
 *   A Rule's children use {@link childLevel}.
 */

/**
 * Cap a heading level at {@link MAX_HEADING_LEVEL} (and floor it at 1).
 *
 * @param {number} level
 * @returns {number}
 */
export function capLevel(level) {
  return Math.min(MAX_HEADING_LEVEL, Math.max(1, Math.trunc(level)));
}

/**
 * One level below `level`, capped.
 *
 * @param {number} level
 * @returns {number}
 */
export function childLevel(level) {
  return capLevel(level + 1);
}

/**
 * The heading-level plan shared by both emitters, so a generated page and an
 * embed outline a feature the same way.
 *
 * @param {FeatureView} view
 * @param {{ baseLevel: number, header: HeaderMode }} opts
 * @returns {Levels}
 */
export function resolveLevels(view, { baseLevel, header }) {
  const effective = view.synthetic ? 'none' : header;
  const feature = capLevel(baseLevel);
  return { header: effective, feature, section: effective === 'none' ? feature : childLevel(feature) };
}
