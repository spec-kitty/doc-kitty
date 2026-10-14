/**
 * Results on a GENERATED feature page (ADR-0055 decision 5).
 *
 * A generated page's Markdown is committed and drift-gated
 * (`generate-feature-pages.mjs --check`), so it can never carry the results of
 * the last test run. Instead the in-page stage, which leaves a generated page's
 * Gherkin alone (ADR-0051 decision 7), hands the page's mdast to
 * {@link overlayResults} with the view of its re-parsed `.feature` source, and
 * the overlay inserts the SAME nodes `mdast.mjs` emits for an include:
 *
 *  - a result line directly after each scenario heading;
 *  - a `Result` column on each outline's Examples tables;
 *  - the results summary after the `*N scenarios*` summary line.
 *
 * MATCHING. The page was rendered from the view by `render.mjs`, so its
 * scenario headings are at the levels the shared plan gives a generated page
 * (`resolveLevels` with base level 1: scenarios at 2, a Rule's at 3) and in
 * document order. Each scenario takes the NEXT heading at its level whose text
 * folds (`headingKey`, shared with the scenario index) to its title; each
 * Examples block the next root-level table, before the scenario's section ends,
 * whose shape (row count, header cells) is the block's. A data table is never
 * a root-level node (it sits inside its step's list item), so it cannot be
 * mistaken for one. A scenario with no heading is REPORTED, not guessed: the
 * page is out of date with its source, which the drift gate fails anyway.
 *
 * PURITY CONTRACT: imports only the pure `./mdast.mjs`, `./results.mjs`,
 * `./text.mjs` and `./view.mjs`. It mutates the tree it is given and reads no
 * file.
 *
 * @module gherkin/results-overlay
 */

import { addResultColumn, resultParagraph, resultsSummaryParagraph, rowOutcomes } from './mdast.mjs';
import { headingKey } from './text.mjs';
import { childLevel, resolveLevels, summaryText, titleOf } from './view.mjs';

/** @typedef {import('./mdast.mjs').MdNode} MdNode */
/** @typedef {import('./view.mjs').FeatureView} FeatureView */
/** @typedef {import('./view.mjs').SectionView} SectionView */
/** @typedef {import('./results.mjs').FeatureResults} FeatureResults */
/** @typedef {import('./results.mjs').StaleResults} StaleResults */

/**
 * The plain text of a node: its `value`, or its children's, concatenated.
 *
 * @param {MdNode} node
 * @returns {string}
 */
function textOf(node) {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

/**
 * Every scenario of the view with the heading depth a generated page gives it.
 *
 * @param {FeatureView} view
 * @returns {Array<{ section: SectionView, depth: number }>}
 */
function scenarioDepths(view) {
  const levels = resolveLevels(view, { baseLevel: 1, header: 'full' });
  /** @type {Array<{ section: SectionView, depth: number }>} */
  const out = [];
  for (const child of view.children) {
    if (child.kind === 'rule') {
      for (const rc of child.children) if (rc.kind === 'scenario') out.push({ section: rc, depth: childLevel(levels.section) });
    } else if (child.kind === 'scenario') {
      out.push({ section: child, depth: levels.section });
    }
  }
  return out;
}

/**
 * Does `node` (a `table`) have the Examples block's shape?
 *
 * @param {MdNode} node
 * @param {readonly string[][]} rows Header first.
 */
function sameTable(node, rows) {
  const tableRows = node.children ?? [];
  if (tableRows.length !== rows.length) return false;
  const header = (tableRows[0]?.children ?? []).map((cell) => headingKey(textOf(cell)));
  return header.length === rows[0].length && rows[0].every((h, i) => headingKey(h) === header[i]);
}

/**
 * @typedef {object} OverlayOutcome
 * @property {string[]} missing Titles of scenarios with no matching heading
 *   (the page is out of date with its source).
 */

/**
 * Add a generated page's results to its mdast, in place.
 *
 * @param {MdNode} tree The page's root.
 * @param {FeatureView} view The view of the page's `.feature` source.
 * @param {FeatureResults | StaleResults} results
 * @returns {OverlayOutcome}
 */
export function overlayResults(tree, view, results) {
  const children = (tree.children ??= []);
  /** @type {string[]} */
  const missing = [];

  if (results.state === 'current') {
    let cursor = 0;
    for (const { section, depth } of scenarioDepths(view)) {
      const want = headingKey(titleOf(section));
      let at = -1;
      for (let i = cursor; i < children.length; i += 1) {
        const node = children[i];
        if (node.type === 'heading' && node.depth === depth && headingKey(textOf(node)) === want) {
          at = i;
          break;
        }
      }
      if (at === -1) {
        missing.push(titleOf(section));
        continue;
      }
      const outcome = results.scenarios.get(section.line);
      if (outcome) children.splice(at + 1, 0, resultParagraph(outcome));
      cursor = at + (outcome ? 2 : 1);

      // The outline's Examples tables, in order, inside this scenario's section.
      for (const ex of section.examples) {
        if (ex.rows.length === 0) continue;
        for (let j = cursor; j < children.length; j += 1) {
          const node = children[j];
          if (node.type === 'heading' && typeof node.depth === 'number' && node.depth <= depth) break;
          if (node.type === 'table' && sameTable(node, ex.rows)) {
            addResultColumn(node, rowOutcomes(ex, results));
            cursor = j + 1;
            break;
          }
        }
      }
    }
  }

  // The summary: after the `*N scenarios*` line, else before the first section.
  const summary = summaryText(view.counts);
  let after = children.findIndex(
    (node) =>
      node.type === 'paragraph' &&
      node.children?.length === 1 &&
      node.children[0].type === 'emphasis' &&
      textOf(node.children[0]) === summary,
  );
  if (after === -1) {
    const firstSection = children.findIndex((node) => node.type === 'heading' && (node.depth ?? 0) >= 2);
    after = firstSection === -1 ? children.length - 1 : firstSection - 1;
  }
  children.splice(after + 1, 0, resultsSummaryParagraph(results));
  return { missing };
}

