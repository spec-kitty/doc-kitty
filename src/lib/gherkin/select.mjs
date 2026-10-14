/**
 * PURE scenario selection for the `::gherkin{src scenario tags}` include
 * directive (ADR-0051, rendering contract §2.2 and §2.4).
 *
 * {@link selectScenarios} takes a parsed `GherkinDocument` and returns a PRUNED
 * COPY holding only the selected scenarios, or a structured failure the include
 * stage turns into its fatal message (contract §5). The input is never mutated:
 * the copy is a `structuredClone`, pruned in place.
 *
 * SELECTION:
 *
 * - **`scenario`** — exact, case-sensitive match on the trimmed scenario name
 *   (the parser already trims AST names; the attribute value is trimmed here),
 *   across top-level scenarios and
 *   those inside Rules; Scenario and Scenario Outline alike. A matched outline
 *   keeps all of its Examples. No match is `notFound` (with every name, for the
 *   error to list); several matches are `ambiguous` (with their lines).
 * - **`tags`** — any-of over the INHERITED tags (feature + rule + scenario, and
 *   for an outline row, its Examples block). Inheritance is not re-derived here:
 *   the document is compiled to pickles with `@cucumber/gherkin` `compile`, whose
 *   pickle tags are exactly that union, and each matching pickle is mapped back
 *   to the AST through `astNodeIds` (`[scenario]`, or `[outline, row]`). An
 *   outline keeps only the Examples blocks with a matching row. Every row of a
 *   block shares the block's tags, so "a row matched" means "every row matched"
 *   and the block is kept whole. Tag comparison is case-sensitive (`@Smoke` does
 *   not match `@smoke`), as in Cucumber.
 * - **Outlines `tags` cannot reach.** An outline whose Examples blocks have no
 *   rows yields no pickles (an outline with NO Examples block compiles as a
 *   plain scenario and is selectable). When such a block's inherited tags match,
 *   the outline is listed in `emptyOutlines` on a `noTagMatch` failure, so the
 *   error can say why it was not selected: it can be selected by `scenario` only.
 * - **Both set** is a `conflict` (Q7: no intersection in v1). **Neither set**
 *   returns the input document itself, unchanged.
 *
 * PRUNING (contract §2.4): the Feature Background always stays. A Rule stays
 * only when it still holds a selected scenario, and then with its own
 * Background, tags and description. Every other scenario and Rule is dropped.
 * Feature tags, description and comments are untouched; the header mode is the
 * caller's decision.
 *
 * MESSAGES are not formatted here: the include stage owns the
 * `<page>:<L> ::gherkin src="x" — …` text (contract §5), and every failure
 * carries the data it needs.
 *
 * PURITY CONTRACT: imports only `@cucumber/gherkin` and `@cucumber/messages`. NO
 * fs, path or `astro`/`@astrojs/*` (enforced by the import-scan table in
 * `gherkin-feature-core.test.ts`).
 *
 * TYPING: JSDoc only — the repo forbids `.d.ts` sidecars.
 *
 * @module gherkin/select
 */

import { compile } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';

/** @typedef {import('@cucumber/messages').GherkinDocument} GherkinDocument */
/** @typedef {import('@cucumber/messages').Scenario} Scenario */
/** @typedef {import('@cucumber/messages').Tag} Tag */

/**
 * @typedef {object} SelectOptions
 * @property {string} [scenario] A scenario name; set means "select by name".
 * @property {string[]} [tags] Tags, with or without the leading `@` (the caller
 *   splits the attribute on whitespace). Set — even empty — means "select by
 *   tag"; an empty list matches nothing.
 */

/**
 * @typedef {object} ScenarioRef
 * @property {string} id The AST node id.
 * @property {string} name The name, as the parser trimmed it.
 * @property {number} line The `Scenario:` line, in the document's coordinates.
 */

/**
 * @typedef {{ ok: true, document: GherkinDocument, selected: ScenarioRef[] }
 *   | { ok: false, reason: 'notFound', scenario: string, names: string[] }
 *   | { ok: false, reason: 'ambiguous', scenario: string, lines: number[] }
 *   | { ok: false, reason: 'noTagMatch', tags: string[], emptyOutlines: ScenarioRef[] }
 *   | { ok: false, reason: 'conflict' }} SelectResult
 *   `selected` lists the kept scenarios in document order (all of them when no
 *   selection was asked for). `names` lists every scenario name in document
 *   order; `tags` is the normalised (`@`-prefixed) list.
 */

/**
 * One scenario with the tags it inherits from its Feature and Rule (for
 * {@link emptyOutlinesMatching}).
 *
 * @typedef {object} ScenarioEntry
 * @property {Scenario} scenario
 * @property {readonly Tag[]} inherited
 */

/**
 * Every scenario in document order, top level and inside Rules.
 *
 * @param {GherkinDocument} document
 * @returns {ScenarioEntry[]}
 */
function scenarioEntries(document) {
  const feature = document.feature;
  if (!feature) return [];
  /** @type {ScenarioEntry[]} */
  const out = [];
  for (const child of feature.children) {
    if (child.scenario) out.push({ scenario: child.scenario, inherited: feature.tags });
    const rule = child.rule;
    if (!rule) continue;
    const inherited = [...feature.tags, ...rule.tags];
    for (const ruleChild of rule.children) {
      if (ruleChild.scenario) out.push({ scenario: ruleChild.scenario, inherited });
    }
  }
  return out;
}

/** @param {Scenario} s @returns {ScenarioRef} */
const refOf = (s) => ({ id: s.id, name: s.name, line: s.location.line });

/**
 * `smoke` → `@smoke`; `@smoke` is kept as written.
 *
 * @param {string} tag
 * @returns {string}
 */
const normaliseTag = (tag) => (tag.startsWith('@') ? tag : `@${tag}`);

/**
 * A pruned copy keeping the Feature Background, the scenarios in `keep` and —
 * for outlines in `rowsOf` — only the Examples blocks with a row in that set.
 * Rules left with no scenario are dropped.
 *
 * @param {GherkinDocument} document
 * @param {Set<string>} keep Scenario ids to keep.
 * @param {Set<string> | undefined} rows Examples row ids to keep; `undefined`
 *   keeps every Examples block of a kept outline.
 * @returns {GherkinDocument}
 */
function prune(document, keep, rows) {
  const copy = structuredClone(document);
  const feature = copy.feature;
  if (!feature) return copy;
  /** @param {Scenario} s */
  const trimExamples = (s) => {
    if (rows) s.examples = s.examples.filter((ex) => ex.tableBody.some((r) => rows.has(r.id)));
  };
  feature.children = feature.children.filter((child) => {
    if (child.background) return true;
    if (child.scenario) {
      if (!keep.has(child.scenario.id)) return false;
      trimExamples(child.scenario);
      return true;
    }
    if (child.rule) {
      child.rule.children = child.rule.children.filter((rc) => {
        if (rc.background) return true;
        if (!rc.scenario || !keep.has(rc.scenario.id)) return false;
        trimExamples(rc.scenario);
        return true;
      });
      return child.rule.children.some((rc) => rc.scenario);
    }
    return false;
  });
  return copy;
}

/**
 * Outlines with an Examples block that has no rows (so `compile` gives it no
 * pickle) but whose inherited tags — feature + rule + outline + that block —
 * contain one of `wanted`.
 *
 * @param {ScenarioEntry[]} entries
 * @param {Set<string>} wanted
 * @returns {ScenarioRef[]}
 */
function emptyOutlinesMatching(entries, wanted) {
  return entries
    .filter(({ scenario, inherited }) =>
      // On a miss, a block whose tags match is necessarily rowless (rows would
      // have compiled to a matching pickle); the row check keeps this helper
      // correct on its own.
      scenario.examples.some(
        (ex) =>
          ex.tableBody.length === 0 &&
          [...inherited, ...scenario.tags, ...ex.tags].some((t) => wanted.has(t.name)),
      ),
    )
    .map(({ scenario }) => refOf(scenario));
}

/**
 * Select scenarios of a parsed feature by name or by tags (see the module doc).
 * Never throws and never mutates `document`.
 *
 * @param {GherkinDocument} document
 * @param {SelectOptions} [options]
 * @returns {SelectResult}
 */
export function selectScenarios(document, { scenario, tags } = {}) {
  const entries = scenarioEntries(document);

  if (scenario !== undefined && tags !== undefined) return { ok: false, reason: 'conflict' };

  if (scenario !== undefined) {
    const wanted = scenario.trim();
    const hits = entries.filter((e) => e.scenario.name === wanted).map((e) => refOf(e.scenario));
    if (hits.length === 0) {
      return { ok: false, reason: 'notFound', scenario: wanted, names: entries.map((e) => e.scenario.name) };
    }
    if (hits.length > 1) {
      return { ok: false, reason: 'ambiguous', scenario: wanted, lines: hits.map((h) => h.line) };
    }
    return { ok: true, document: prune(document, new Set([hits[0].id]), undefined), selected: hits };
  }

  if (tags !== undefined) {
    const normalised = tags.map(normaliseTag);
    const wanted = new Set(normalised);
    const keep = new Set();
    const rows = new Set();
    for (const pickle of compile(document, '', IdGenerator.incrementing())) {
      if (!pickle.tags.some((t) => wanted.has(t.name))) continue;
      const [scenarioId, rowId] = pickle.astNodeIds;
      keep.add(scenarioId);
      if (rowId !== undefined) rows.add(rowId);
    }
    if (keep.size === 0) {
      return { ok: false, reason: 'noTagMatch', tags: normalised, emptyOutlines: emptyOutlinesMatching(entries, wanted) };
    }
    const selected = entries.filter((e) => keep.has(e.scenario.id)).map((e) => refOf(e.scenario));
    return { ok: true, document: prune(document, keep, rows), selected };
  }

  return { ok: true, document, selected: entries.map((e) => refOf(e.scenario)) };
}
