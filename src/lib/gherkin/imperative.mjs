/**
 * The IMPERATIVE-STEP LINT core (#196; FR-008..FR-013, C-002): the one rule set
 * that flags Given/When steps describing UI mechanics (`When I click "Book"`)
 * or quoting a CSS selector (`"#book-button"`) instead of behaviour.
 *
 * It reads the shared view (`view.mjs`), never the AST: a step's prose comes
 * from its `segments`, its scope from its resolved `keywordType`, its line from
 * `line`. Both production surfaces (generated feature pages and in-page fences)
 * call {@link lintSteps}, next to `warnDuplicates`, with rules compiled once by
 * {@link compileRules}; there is no second rule set. Included features and
 * `gherkin raw` fences are never linted (that is the callers' choice, ADR-0051).
 *
 * What is matched (R-04):
 *
 *  - only the PROSE of a step: `text` segments verbatim, an outline placeholder
 *    as `<…>` and a quoted argument as `"…"`. So `When I type "x" into "y"`
 *    still shows its verb, but argument content, placeholders, doc strings,
 *    data tables, Examples cells and descriptions never match;
 *  - only steps whose `keywordType` is in the rules' scope (`unknown` never is);
 *  - only English features: the phrase list is English, so a feature whose
 *    `# language:` is neither `en` nor `en-*` is skipped (FR-013). The language
 *    is passed in by the caller (`opts.language`) rather than read from the
 *    view, which deliberately carries no `language` field: the parser output
 *    holds it, and both callers have the parsed document in hand.
 *
 * One warning per step at most: a phrase match wins over the selector signal
 * (it names the more specific problem, and the selector is usually the verb's
 * own argument); between phrases, the first in list order wins.
 *
 * Suppression (R-06): `@dk:allow=imperative` on the Feature covers every step;
 * on a Rule, that Rule's Background and scenarios; on a Scenario or Outline, its
 * own steps. The Feature Background is covered by the Feature tag only. Any
 * other `@dk:allow` value warns once per tag, at the tagged node, and suppresses
 * nothing.
 *
 * PURITY CONTRACT: no I/O, no console, no globals; `warn` is the only output.
 * The runtime imports are `./text.mjs` (import-free), `./view.mjs` and
 * `./feature-core.mjs` (the `@dk:allow` authority; both fs-free), so this module loads in the Astro build and in the bare-Node CLI.
 *
 * @module gherkin/imperative
 */

import { ALLOW_VALUES, unknownAllowWarning } from './feature-core.mjs';
import { GHERKIN_LOG_PREFIX } from './text.mjs';
import { allowTagValue } from './view.mjs';

/** @typedef {import('./view.mjs').FeatureView} FeatureView */
/** @typedef {import('./view.mjs').SectionView} SectionView */
/** @typedef {import('./view.mjs').StepView} StepView */
/** @typedef {import('./view.mjs').KeywordType} KeywordType */

/**
 * One entry of a phrase list: a head verb (or verb phrase) and, optionally, a
 * word that must follow it within a few words.
 *
 * @typedef {object} ImperativePhrase
 * @property {readonly string[]} verbs Plain words or phrases. The FIRST word of
 *   each is matched in any common inflection (`click` → `clicks`, `clicked`,
 *   `clicking`; `tap` → `tapped`; `type` → `typing`); further words match as
 *   written, with any whitespace between them. Whole words only: `click` never
 *   matches `clickstream` or `click-through`.
 * @property {readonly string[]} [then] Required context: one of these words
 *   (or its plural) must follow the verb, or the entry does not match.
 * @property {readonly [number, number]} [gap] How many words may sit between
 *   the verb and the `then` word, `[min, max]`. Default `[0, 3]`.
 */

/**
 * The DEFAULT phrase list (D2): deliberately narrow, so a docs site's own
 * domain language does not trip it. Every entry names UI mechanics:
 *
 * | Entry | Matches | Does not match |
 * |---|---|---|
 * | `click`, `double-click`, `right-click` | `When I click "Book"` | `the clickstream` |
 * | `tap`, `hover`, `scroll`, `drag` | `When I tap "Pay"` | `the tape` |
 * | `fill in`, `fill out` | `When I fill in "size" with "12"` | `fill the gap in` |
 * | `navigate to` | `Given I navigate to the bookings` | `the system navigates the route` |
 * | `type` … `into` (one word between) | `When I type "x" into "y"` | `the leave type is entered into …` |
 * | `press` … `button` / `key` | `When I press the submit button` | `the press release`, `presses charges` |
 * | `refresh` / `reload` … `page` | `When I refresh the page` | `reload the data` |
 * | `check` / `uncheck` / `tick` … `box` / `checkbox` | `When I tick the "agree" box` | `checks the balance` |
 * | `visit` … `page` / `url` / `link` | `Given I visit the home page` | `the inspector visits the warehouse` |
 *
 * Known-ambiguous verbs are left out on purpose: `enter` ("enters a contract"),
 * `select` ("select a plan"), `submit` ("submit the declaration"), `open` and
 * bare UI nouns. A site adds them with `extend`.
 *
 * @type {readonly ImperativePhrase[]}
 */
export const DEFAULT_IMPERATIVE_PHRASES = deepFreeze([
  { verbs: ['click', 'double-click', 'right-click'] },
  { verbs: ['tap'] },
  { verbs: ['hover'] },
  { verbs: ['scroll'] },
  { verbs: ['drag'] },
  { verbs: ['fill in', 'fill out'] },
  { verbs: ['navigate to'] },
  { verbs: ['type'], then: ['into'], gap: [1, 1] },
  { verbs: ['press'], then: ['button', 'key'] },
  { verbs: ['refresh', 'reload'], then: ['page'], gap: [0, 2] },
  { verbs: ['check', 'uncheck', 'tick'], then: ['box', 'checkbox'] },
  { verbs: ['visit'], then: ['page', 'url', 'link'] },
]);

/** The scope `imperativeSteps: true` means: Given and When (and their conjunctions). */
const DEFAULT_KEYWORDS = /** @type {const} */ (['context', 'action']);

/** The one `@dk:allow` value that suppresses (R-06); the allowed set lives in feature-core. */
const ALLOW_IMPERATIVE = ALLOW_VALUES[0];

/** A word boundary that also refuses a hyphen, so `click` misses `click-through`. */
const BEFORE = '(?<![\\w-])';
const AFTER = '(?![\\w-])';

/**
 * The option as WP01 normalises `gherkin.lint.imperativeSteps` (on):
 * `verbs` replaces the default list, `extend` appends to the effective list,
 * `keywords` is the scope.
 *
 * @typedef {object} NormalisedImperativeOption
 * @property {readonly string[]} [verbs]
 * @property {readonly string[]} [extend] Default `[]`.
 * @property {readonly KeywordType[]} [keywords] Default `['context', 'action']`.
 */

/**
 * Compiled rules: build them once per surface, lint many views with them.
 *
 * @typedef {object} CompiledImperativeRules
 * @property {readonly RegExp[]} patterns One per phrase entry, in list order.
 *   Group 1 is the verb as written in the step (what the warning quotes).
 * @property {ReadonlySet<KeywordType>} keywords The keyword types checked.
 */

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/** @param {string} text */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The inflections of an English verb the lint accepts: the base form, `-s` /
 * `-es`, `-ed` / `-d`, `-ing`, a doubled final consonant (`tap` → `tapped`,
 * `tapping`) and a dropped silent `e` (`type` → `typing`).
 *
 * @param {string} word Lower case.
 * @returns {string[]}
 */
function inflections(word) {
  const forms = new Set([word]);
  forms.add(/(?:s|sh|ch|x|z)$/.test(word) ? `${word}es` : `${word}s`);
  if (/[^e]e$/.test(word)) {
    forms.add(`${word}d`);
    forms.add(`${word.slice(0, -1)}ing`);
  } else {
    forms.add(`${word}ed`);
    forms.add(`${word}ing`);
  }
  // Consonant-vowel-consonant ending (not w, x, y): the consonant doubles.
  if (/(?:^|[^aeiou])[aeiou][b-df-hj-np-tvz]$/.test(word)) {
    const doubled = word + word.slice(-1);
    forms.add(`${doubled}ed`);
    forms.add(`${doubled}ing`);
  }
  return [...forms];
}

/**
 * The regex source of a plain word or phrase: the first word in any
 * inflection, the rest literal, `\s+` between words. Throws on a blank phrase
 * (it would otherwise match a bare suffix).
 *
 * @param {string} phrase
 * @returns {string}
 */
function headSource(phrase) {
  const words = phrase.trim().toLowerCase().split(/\s+/);
  if (!words[0]) throw new Error(`${GHERKIN_LOG_PREFIX} an imperative-step phrase must not be blank`);
  const [first, ...rest] = words;
  // Longest first, so the alternation reports `clicked`, not `click` + junk.
  const forms = inflections(first)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  return [`(?:${forms.join('|')})`, ...rest.map(escapeRegExp)].join('\\s+');
}

/**
 * Compile one phrase entry. The verb is captured as group 1.
 *
 * @param {ImperativePhrase} phrase
 * @returns {RegExp}
 */
function phrasePattern({ verbs, then, gap = [0, 3] }) {
  let source = `${BEFORE}((?:${verbs.map(headSource).join('|')}))${AFTER}`;
  if (then && then.length > 0) {
    const words = then.map((w) => escapeRegExp(w.toLowerCase())).join('|');
    // Bounded, and `\s` / `\S` are disjoint: no catastrophic backtracking.
    source += `(?:\\s+\\S+){${gap[0]},${gap[1]}}?\\s+(?:${words})(?:es|s)?${AFTER}`;
  }
  return new RegExp(source, 'i');
}

/**
 * Compile a user's plain word or phrase (a `verbs` or `extend` entry) to the
 * case-insensitive, whole-word, inflection-tolerant pattern the lint uses. The
 * text is literal: regex syntax in it is escaped, never interpreted.
 *
 * @param {string} phrase
 * @returns {RegExp}
 */
export function compilePhrase(phrase) {
  return phrasePattern({ verbs: [phrase] });
}

/**
 * Compile the normalised option into rules.
 *
 * @param {NormalisedImperativeOption} option
 * @returns {CompiledImperativeRules}
 */
export function compileRules({ verbs, extend = [], keywords = DEFAULT_KEYWORDS }) {
  /** @param {string} v @returns {ImperativePhrase} */
  const entry = (v) => ({ verbs: [v] });
  const phrases = [...(verbs ? verbs.map(entry) : DEFAULT_IMPERATIVE_PHRASES), ...extend.map(entry)];
  return Object.freeze({ patterns: Object.freeze(phrases.map(phrasePattern)), keywords: new Set(keywords) });
}

/**
 * Is a quoted argument's content shaped like a CSS selector (`#id`, `.class`,
 * `[attr=value]`)? The guide's own bad example.
 *
 * @param {string} content The argument without its quotes.
 */
function isSelector(content) {
  return /^[#.][A-Za-z_-]/.test(content) || (content.includes('[') && content.includes('='));
}

/**
 * The text the phrases are matched against: prose verbatim, every placeholder
 * as `<…>` and every quoted argument as `"…"`.
 *
 * @param {StepView} step
 */
function proseOf(step) {
  return step.segments
    .map((s) => (s.kind === 'text' ? s.value : s.kind === 'placeholder' ? '<…>' : '"…"'))
    .join('');
}

/**
 * The warning's middle part for one step, or `null` when it is clean.
 *
 * @param {StepView} step
 * @param {CompiledImperativeRules} rules
 * @returns {string | null}
 */
function problemOf(step, rules) {
  const prose = proseOf(step);
  for (const pattern of rules.patterns) {
    const m = pattern.exec(prose);
    if (m) return `names a UI action ("${m[1]}")`;
  }
  for (const s of step.segments) {
    if (s.kind === 'argument' && isSelector(s.value.slice(1, -1))) return `quotes a CSS selector ("${s.value.slice(1, -1)}")`;
  }
  return null;
}

/**
 * @typedef {object} LintOptions
 * @property {CompiledImperativeRules} rules From {@link compileRules}.
 * @property {string} [file] Source path used in warnings (a fence: the host page).
 * @property {(msg: string) => void} [warn] Warning sink (defaults to a no-op).
 * @property {number} [lineOffset] Added to every cited line, exactly as
 *   `warnDuplicates` does (a fence's lines are relative to its content). Default 0.
 * @property {string} [language] The document's `# language:` (the parsed
 *   `feature.language`). Absent means English. Steps are linted only for `en`
 *   and `en-*`; unknown `@dk:allow` values are reported in any language.
 * @property {boolean} [checkFeatureAllow] Also warn about an unknown Feature-level
 *   `@dk:allow` value. Default `false`: on a generated page feature-core already
 *   warns about it (it is a Feature-level metadata key there), so the page caller
 *   leaves this off to warn once. A fence runs no feature-core metadata, so the
 *   fence caller turns it on. Rule- and Scenario-level values are always checked.
 */

/**
 * Lint a feature's steps: one warning per imperative step, plus one per unknown
 * `@dk:allow` value. Pure: `warn` is the only output.
 *
 * Warnings cite `step.line + lineOffset`; an unknown `@dk:allow` value cites
 * the tagged node's keyword line (the view keeps no per-tag lines).
 *
 * @param {FeatureView} view
 * @param {LintOptions} opts
 */
export function lintSteps(view, opts) {
  const { rules, file = '<unknown>', warn = () => {}, lineOffset = 0, language, checkFeatureAllow = false } = opts;
  const english = !language || /^en(?:-|$)/i.test(language);

  /**
   * Does `tags` carry `@dk:allow=imperative`? Reports every other allow value.
   *
   * @param {readonly string[]} tags
   * @param {number} line
   * @param {boolean} report
   */
  const allowed = (tags, line, report) => {
    let allow = false;
    for (const tag of tags) {
      const value = allowTagValue(tag);
      if (value === null) continue;
      if (value === ALLOW_IMPERATIVE) allow = true;
      else if (report) {
        warn(unknownAllowWarning(`${file}:${line + lineOffset}`, value));
      }
    }
    return allow;
  };

  /**
   * @param {SectionView} section
   * @param {boolean} covered Suppressed by an enclosing Feature or Rule tag.
   */
  const lintSection = (section, covered) => {
    const own = allowed(section.tags, section.line, true);
    if (covered || own || !english) return;
    for (const step of section.steps) {
      if (!rules.keywords.has(step.keywordType)) continue;
      const problem = problemOf(step, rules);
      if (problem) {
        warn(
          `${GHERKIN_LOG_PREFIX} ${file}:${step.line + lineOffset} step "${step.keyword} ${step.text}" ${problem} ` +
            `— describe the behaviour instead; silence with @dk:allow=${ALLOW_IMPERATIVE}`,
        );
      }
    }
  };

  const featureCovered = allowed(view.tags, view.line, checkFeatureAllow);
  for (const child of view.children) {
    if (child.kind === 'rule') {
      const ruleCovered = allowed(child.tags, child.line, true) || featureCovered;
      for (const rc of child.children) lintSection(rc, ruleCovered);
    } else {
      lintSection(child, featureCovered);
    }
  }
}
