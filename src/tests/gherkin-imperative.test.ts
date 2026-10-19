/**
 * The imperative-step lint core (`imperative.mjs`, #196; FR-008..FR-013, C-002).
 *
 * `lintSteps` is the ONE rule set both production surfaces call (generated
 * pages and in-page fences, wired by WP04). These tests drive it with real
 * Gherkin text, parsed with `@cucumber/gherkin` directly and walked by
 * `featureView`, exactly as the callers do, and record what reaches `warn`.
 *
 * Every "no warning" case has a positive control on the same fixture, so a
 * silent result proves the rule declined to fire rather than never ran
 * (acceptance-criteria non-vacuity).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser, AstBuilder, GherkinClassicTokenMatcher } from '@cucumber/gherkin';
import { IdGenerator, type GherkinDocument } from '@cucumber/messages';
import { featureView, type FeatureView } from '../lib/gherkin/view.mjs';
import {
  DEFAULT_IMPERATIVE_PHRASES,
  compilePhrase,
  compileRules,
  lintSteps,
  type CompiledImperativeRules,
} from '../lib/gherkin/imperative.mjs';

const SRC_ROOT = fileURLToPath(new URL('../', import.meta.url));
const EXAMPLE_FEATURES = fileURLToPath(new URL('../../example/features/', import.meta.url));

function parse(source: string): GherkinDocument {
  const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
  return parser.parse(source);
}

function view(source: string): FeatureView {
  const v = featureView(parse(source));
  if (!v) throw new Error('no feature');
  return v;
}

const lines = (...ls: string[]) => `${ls.join('\n')}\n`;

/** The option `true` normalises to (WP01): default list, Given/When scope. */
const DEFAULTS = compileRules({ extend: [], keywords: ['context', 'action'] });

/** Lint `source` and return every warning. */
function lint(
  source: string,
  opts: { rules?: CompiledImperativeRules; language?: string; lineOffset?: number; checkFeatureAllow?: boolean } = {},
): string[] {
  const warnings: string[] = [];
  lintSteps(view(source), {
    rules: opts.rules ?? DEFAULTS,
    file: 'f.feature',
    warn: (m) => warnings.push(m),
    lineOffset: opts.lineOffset,
    language: opts.language,
    checkFeatureAllow: opts.checkFeatureAllow,
  });
  return warnings;
}

/** One-scenario feature around `steps` (step lines start at 3). */
const scenario = (...steps: string[]) => lines('Feature: F', '  Scenario: S', ...steps.map((s) => `    ${s}`));

const imperative = (line: number, step: string, match: string) =>
  `[dk-gherkin] f.feature:${line} step "${step}" names a UI action ("${match}") — describe the behaviour instead; silence with @dk:allow=imperative`;
const selector = (line: number, step: string, arg: string) =>
  `[dk-gherkin] f.feature:${line} step "${step}" quotes a CSS selector ("${arg}") — describe the behaviour instead; silence with @dk:allow=imperative`;
const badAllow = (line: number, value: string) =>
  `[dk-gherkin] f.feature:${line} unknown @dk:allow value "${value}" (expected imperative); ignored`;

describe('compilePhrase: a plain word or phrase, never a raw regex (R-04)', () => {
  it('matches the inflections of the first word, whole words only, any case', () => {
    const click = compilePhrase('click');
    for (const yes of ['click', 'clicks', 'clicked', 'clicking', 'Click', 'CLICKED']) expect(click.test(`I ${yes} it`)).toBe(true);
    for (const no of ['clickstream', 'unclick', 'click-through', 'clickety']) expect(click.test(`the ${no} rate`)).toBe(false);
  });

  it('doubles a final consonant and drops a silent e', () => {
    const tap = compilePhrase('tap');
    for (const yes of ['taps', 'tapped', 'tapping']) expect(tap.test(yes)).toBe(true);
    expect(tap.test('tape')).toBe(false);
    const type = compilePhrase('type');
    for (const yes of ['types', 'typed', 'typing']) expect(type.test(yes)).toBe(true);
    expect(type.test('typewriter')).toBe(false);
    const press = compilePhrase('press');
    expect(press.test('presses')).toBe(true);
    expect(press.test('pressed')).toBe(true);
  });

  it('inflects only the first word of a phrase and allows any whitespace between words', () => {
    const fill = compilePhrase('fill in');
    expect(fill.test('she filled  in the form')).toBe(true);
    expect(fill.test('filling in')).toBe(true);
    expect(fill.test('fill ins')).toBe(false);
    expect(fill.test('fill the gap in')).toBe(false);
  });

  it('escapes regex syntax: user text is literal', () => {
    const dotted = compilePhrase('a.b');
    expect(dotted.test('a.b')).toBe(true);
    expect(dotted.test('axb')).toBe(false);
    expect(compilePhrase('(x').test('(x')).toBe(true);
  });

  it('refuses a blank phrase (it would match a bare suffix)', () => {
    expect(() => compilePhrase('  ')).toThrow(/\[dk-gherkin\] an imperative-step phrase must not be blank/);
  });
});

describe('DEFAULT_IMPERATIVE_PHRASES: documented data, not regex (D2)', () => {
  it('is frozen plain data covering the documented heads', () => {
    expect(Object.isFrozen(DEFAULT_IMPERATIVE_PHRASES)).toBe(true);
    const heads = DEFAULT_IMPERATIVE_PHRASES.flatMap((p) => p.verbs);
    expect(heads).toEqual(
      expect.arrayContaining(['click', 'double-click', 'right-click', 'tap', 'hover', 'scroll', 'drag', 'fill in', 'fill out', 'navigate to', 'type', 'press', 'refresh', 'reload', 'check', 'uncheck', 'tick', 'visit']),
    );
    for (const p of DEFAULT_IMPERATIVE_PHRASES) {
      expect(Object.isFrozen(p)).toBe(true);
      for (const v of p.verbs) expect(v).toMatch(/^[a-z]+(?:[- ][a-z]+)*$/);
    }
  });

  it.each([
    ['When I click "Book"', 'click'],
    ['When I double-click the row', 'double-click'],
    ['When I right-clicked the row', 'right-clicked'],
    ['When the user taps "Pay"', 'taps'],
    ['When I hover over the term', 'hover'],
    ['When I scroll down', 'scroll'],
    ['When I drag the card', 'drag'],
    ['When I fill in "size" with "12"', 'fill in'],
    ['When I fill out the form', 'fill out'],
    ['Given I navigate to the bookings', 'navigate to'],
    ['When I type "Rotterdam" into "port"', 'type'],
    ['When I type Rotterdam into the port', 'type'],
    ['When I press the submit button', 'press'],
    ['When I press the "Enter" key', 'press'],
    ['When I refresh the page', 'refresh'],
    ['When I reload the bookings page', 'reload'],
    ['When I check the terms checkbox', 'check'],
    ['When I tick the "agree" box', 'tick'],
    ['When I uncheck the box', 'uncheck'],
    ['Given I visit the home page', 'visit'],
    ['Given I visited the "help" link', 'visited'],
  ])('flags %s as "%s"', (step, match) => {
    expect(lint(scenario(step))).toEqual([imperative(3, step, match)]);
  });

  it.each([
    // The research false-positive table (docs/architecture/research/gherkin-authoring-aids.md):
    // the narrow list excludes these by design.
    'Given the customer enters a contract',
    'When the customer selects a plan',
    'When the shipper submits the declaration',
    'Given the leave type is entered into the system',
    'Given the press release is published',
    'When the system navigates the route',
    'When the inspector visits the warehouse',
    'When the clerk checks the balance',
    'When the employee presses charges',
    'Given the clickstream is recorded',
    // The context word is a whole word too: `box` is not the end of `strongbox`.
    'Given the auditor checks the strongbox',
  ])('leaves "%s" unflagged (positive control: the same scenario plus a click warns once)', (step) => {
    expect(lint(scenario(step))).toEqual([]);
    expect(lint(scenario(step, 'When I click "Book"'))).toEqual([imperative(4, 'When I click "Book"', 'click')]);
  });
});

describe('lintSteps: the matcher (FR-008, FR-013)', () => {
  it('flags `When I click "Book"` once, at its line, and leaves declarative steps alone (US2 #2, #3)', () => {
    const src = lines(
      'Feature: Book',
      '  Scenario: Declarative',
      '    When the shipper books the consignment',
      '    Given the customer enters a contract',
      '  Scenario: Imperative',
      '    When I click "Book"',
    );
    expect(lint(src)).toEqual([imperative(6, 'When I click "Book"', 'click')]);
  });

  it('adds lineOffset to every cited line, as warnDuplicates does (a fence)', () => {
    expect(lint(scenario('When I click "Book"'), { lineOffset: 40 })).toEqual([imperative(43, 'When I click "Book"', 'click')]);
  });

  it('never matches inside a quoted argument; the verb outside one still matches', () => {
    expect(lint(scenario('When the shipper books "click and collect"'))).toEqual([]);
    expect(lint(scenario('When I type "x" into "y"'))).toEqual([imperative(3, 'When I type "x" into "y"', 'type')]);
  });

  it('never matches a placeholder: `When I <action> the form` (outline)', () => {
    const outline = (step: string) =>
      lines('Feature: F', '  Scenario Outline: O', `    ${step}`, '    Examples:', '      | action |', '      | click  |');
    expect(lint(outline('When I <action> the form'))).toEqual([]);
    // Positive control: the same outline with the verb in the prose.
    expect(lint(outline('When I click the <action> form'))).toEqual([imperative(3, 'When I click the <action> form', 'click')]);
  });

  it('never scans doc strings, data tables, Examples cells or descriptions', () => {
    const src = lines(
      'Feature: F',
      '  Click here, then click there.',
      '  Scenario Outline: O',
      '    Click the button to start.',
      '    Given the shipper books <n> TEU',
      '      | click | press the button |',
      '    When the shipper attaches the note:',
      '      """',
      '      click "Book" and fill in the form',
      '      """',
      '    Examples:',
      '      | n     |',
      '      | click |',
    );
    expect(lint(src)).toEqual([]);
  });

  it('warns about a quoted CSS selector (US2 #4)', () => {
    for (const arg of ['#book-button', '.primary', 'input[name=size]', '[data-test=book]']) {
      const step = `When the shipper chooses "${arg}"`;
      expect(lint(scenario(step))).toEqual([selector(3, step, arg)]);
    }
    // Not selectors: a decimal, a bare hash, a bracket without `=`.
    expect(lint(scenario('When the shipper books ".5" TEU and "#" and "[draft]"'))).toEqual([]);
  });

  it('`When I press "#book-button"` gives exactly one warning: the selector (no button/key context)', () => {
    expect(lint(scenario('When I press "#book-button"'))).toEqual([selector(3, 'When I press "#book-button"', '#book-button')]);
  });

  it('a verb match wins over a selector: one warning per step', () => {
    const step = 'When I click "#book-button"';
    expect(lint(scenario(step))).toEqual([imperative(3, step, 'click')]);
  });

  it('checks Given/When by default; `Then` is skipped, an `And` after `When` is checked (US2 #5)', () => {
    const src = scenario('When I click "Book"', 'And I click "Confirm"', 'Then I click "Close"', 'And I click "Done"');
    expect(lint(src)).toEqual([
      imperative(3, 'When I click "Book"', 'click'),
      imperative(4, 'And I click "Confirm"', 'click'),
    ]);
    // `keywords: ['outcome']` flips the scope.
    const outcome = compileRules({ extend: [], keywords: ['outcome'] });
    expect(lint(src, { rules: outcome })).toEqual([
      imperative(5, 'Then I click "Close"', 'click'),
      imperative(6, 'And I click "Done"', 'click'),
    ]);
  });

  it('never lints an `unknown` step (an opening `*` with nothing to inherit)', () => {
    expect(lint(scenario('* I click "Book"'))).toEqual([]);
    expect(lint(scenario('When the shipper books', '* I click "Book"'))).toEqual([imperative(4, '* I click "Book"', 'click')]);
  });

  it('lints Background and Rule steps too', () => {
    const src = lines(
      'Feature: F',
      '  Background:',
      '    Given I visit the home page',
      '  Rule: R',
      '    Background:',
      '      Given I fill in the form',
      '    Scenario: S',
      '      When I scroll down',
    );
    expect(lint(src)).toEqual([
      imperative(3, 'Given I visit the home page', 'visit'),
      imperative(6, 'Given I fill in the form', 'fill in'),
      imperative(8, 'When I scroll down', 'scroll'),
    ]);
  });
});

describe('lintSteps: English only (FR-013, US2 #7)', () => {
  const DUTCH = lines('# language: nl', 'Functionaliteit: F', '  Scenario: S', '    Als ik klik op "Boek"', '    En ik click "Boek"');
  const ENGLISH = lines('# language: en', 'Feature: F', '  Scenario: S', '    When I click on "Book"');

  it('a `# language: nl` feature gives no warning; the same step in English gives one', () => {
    expect(lint(DUTCH, { language: 'nl' })).toEqual([]);
    expect(lint(ENGLISH, { language: 'en' })).toEqual([imperative(4, 'When I click on "Book"', 'click')]);
  });

  it('an absent language is English; `en-*` dialects are linted', () => {
    expect(lint(ENGLISH)).toHaveLength(1);
    expect(lint(ENGLISH, { language: 'en-au' })).toHaveLength(1);
    expect(lint(ENGLISH, { language: 'eo' })).toEqual([]);
    expect(lint(ENGLISH, { language: 'english' })).toEqual([]);
  });
});

describe('lintSteps: @dk:allow=imperative suppression (FR-012, R-06; US2 #6)', () => {
  it('a tagged scenario is silent; its untagged sibling still warns', () => {
    const src = lines(
      'Feature: F',
      '  @dk:allow=imperative',
      '  Scenario: Deliberate',
      '    When I click "Book"',
      '  Scenario: Accidental',
      '    When I click "Book"',
    );
    expect(lint(src)).toEqual([imperative(6, 'When I click "Book"', 'click')]);
  });

  it("a Rule tag covers the Rule's Background and scenarios, not the rest of the feature", () => {
    const src = lines(
      'Feature: F',
      '  @dk:allow=imperative',
      '  Rule: UI',
      '    Background:',
      '      Given I visit the home page',
      '    Scenario: In',
      '      When I click "Book"',
      '  Rule: Other',
      '    Scenario: Out',
      '      When I click "Book"',
    );
    expect(lint(src)).toEqual([imperative(10, 'When I click "Book"', 'click')]);
  });

  it('a Feature tag covers everything, the Feature Background included', () => {
    const body = [
      'Feature: F',
      '  Background:',
      '    Given I visit the home page',
      '  Scenario: S',
      '    When I click "Book"',
      '  Rule: R',
      '    Scenario: T',
      '      When I tap "Pay"',
    ];
    expect(lint(lines('@dk:allow=imperative', ...body))).toEqual([]);
    // Positive control: the same feature untagged.
    expect(lint(lines(...body))).toHaveLength(3);
  });

  it('a scenario tag does not cover the Feature Background', () => {
    const src = lines(
      'Feature: F',
      '  Background:',
      '    Given I visit the home page',
      '  @dk:allow=imperative',
      '  Scenario: S',
      '    When I click "Book"',
    );
    expect(lint(src)).toEqual([imperative(3, 'Given I visit the home page', 'visit')]);
  });

  it('an unknown value at Rule or Scenario level warns once, at that node, and suppresses nothing', () => {
    const src = lines(
      'Feature: F',
      '  @dk:allow=imperatve @dk:allow=imperatve',
      '  Scenario: S',
      '    When I click "Book"',
      '  @dk:allow=',
      '  Rule: R',
      '    @dk:allow',
      '    Scenario: T',
      '      Then the booking is confirmed',
    );
    expect(lint(src, { lineOffset: 10 })).toEqual([
      badAllow(13, 'imperatve'),
      imperative(14, 'When I click "Book"', 'click'),
      badAllow(16, ''),
      badAllow(18, ''),
    ]);
  });

  it('a valid and an unknown value together: the scope is suppressed, the unknown value still warns', () => {
    const src = lines('Feature: F', '  @dk:allow=imperative @dk:allow=ui', '  Scenario: S', '    When I click "Book"');
    expect(lint(src)).toEqual([badAllow(3, 'ui')]);
  });

  it('Feature-level unknown values warn only when the caller asks (checkFeatureAllow: fences; feature-core warns on pages)', () => {
    const src = lines('@dk:allow=bogus', 'Feature: F', '  Scenario: S', '    When the shipper books');
    expect(lint(src)).toEqual([]);
    expect(lint(src, { checkFeatureAllow: true, lineOffset: 5 })).toEqual([badAllow(7, 'bogus')]);
  });

  it('unknown values are reported even in a non-English feature (the tag is malformed in any dialect)', () => {
    const src = lines('# language: nl', 'Functionaliteit: F', '  @dk:allow=x', '  Scenario: S', '    Als ik klik op "Boek"');
    expect(lint(src, { language: 'nl' })).toEqual([badAllow(4, 'x')]);
  });
});

describe('compileRules: configuration (FR-010; US2 #9)', () => {
  it('`extend` appends: `select` is flagged with it and not without it', () => {
    const step = 'When I select "Rotterdam"';
    expect(lint(scenario(step))).toEqual([]);
    expect(lint(scenario(step), { rules: compileRules({ extend: ['select'], keywords: ['context', 'action'] }) })).toEqual([
      imperative(3, step, 'select'),
    ]);
  });

  it('`verbs` replaces the default list: `tap` is flagged, `click` no longer is', () => {
    const rules = compileRules({ verbs: ['tap'], extend: [], keywords: ['context', 'action'] });
    expect(lint(scenario('When I click "Book"', 'When I tap "Pay"'), { rules })).toEqual([imperative(4, 'When I tap "Pay"', 'tap')]);
  });

  it('`verbs` and `extend` combine; the selector signal stays on whatever the list', () => {
    const rules = compileRules({ verbs: ['tap'], extend: ['swipe'], keywords: ['action'] });
    expect(lint(scenario('When I swiped left', 'When I choose "#x"', 'When I click "Book"'), { rules })).toEqual([
      imperative(3, 'When I swiped left', 'swiped'),
      selector(4, 'When I choose "#x"', '#x'),
    ]);
  });
});

describe('the lint core is pure', () => {
  it('imports only ./text.mjs and ./view.mjs: no fs, no console, no globals', () => {
    const src = readFileSync(path.join(SRC_ROOT, 'lib/gherkin/imperative.mjs'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const specs = [...src.matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    expect(specs).toEqual(['./text.mjs', './view.mjs']);
    expect(src).not.toMatch(/\bconsole\b|\bprocess\b|\bglobalThis\b/);
  });
});

describe('the example corpus (NFR-002 early signal, NFR-006)', () => {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith('.feature')) files.push(abs);
    }
  };
  walk(EXAMPLE_FEATURES);
  const sources = files.map((f) => readFileSync(f, 'utf8'));

  it("the example's .feature files produce zero warnings with the default rules", () => {
    expect(files.length).toBeGreaterThanOrEqual(4);
    const warnings: string[] = [];
    for (const [i, src] of sources.entries()) {
      const v = featureView(parse(src));
      if (!v) throw new Error(`no feature in ${files[i]}`);
      lintSteps(v, { rules: DEFAULTS, file: files[i], warn: (m) => warnings.push(m) });
    }
    expect(warnings).toEqual([]);
    // Positive control: the same corpus under a list built from its own declarative verbs warns.
    const loud = compileRules({ verbs: ['books', 'requests'], extend: [], keywords: ['action'] });
    let count = 0;
    for (const src of sources) lintSteps(featureView(parse(src)) as FeatureView, { rules: loud, file: 'x', warn: () => (count += 1) });
    expect(count).toBeGreaterThan(0);
  });

  it('linting costs a small fraction of parsing (lenient timing guard)', () => {
    const RUNS = 20;
    const views = sources.map((src) => featureView(parse(src)) as FeatureView);
    const t0 = performance.now();
    for (let r = 0; r < RUNS; r += 1) for (const src of sources) featureView(parse(src));
    const parseMs = performance.now() - t0;
    const t1 = performance.now();
    for (let r = 0; r < RUNS; r += 1) for (const v of views) lintSteps(v, { rules: DEFAULTS, file: 'x', warn: () => {} });
    const lintMs = performance.now() - t1;
    // Generous: half the parse cost, or 50 ms absolute, whichever is larger (non-flaky on a slow CI box).
    expect(lintMs).toBeLessThan(Math.max(parseMs / 2, 50));
  });
});
