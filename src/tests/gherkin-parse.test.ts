/**
 * Gherkin in any page — string parse and fragments (ADR-0051 decisions 3 and 8;
 * rendering contract §1.3 and §5).
 *
 * Pins:
 *   - `parseGherkin` (`lib/gherkin/parse.mjs`): errors are returned, not thrown,
 *     formatted `[dk-gherkin] <display>:<line>:<col> <message>` with the host
 *     offsets applied; ids are fresh per call. `gherkin-load.test.ts`, unchanged,
 *     proves the loader's text did not move when it started delegating here.
 *   - `parseFragment` (`lib/gherkin/fragment.mjs`): the parser-driven wrap of a
 *     body with no `Feature:` (and no `Scenario:`) line, error lines mapped back
 *     to what the author wrote, `# language:` localisation, and the two
 *     ```` ```gherkin ```` fences in `docs/guides/authoring.md`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeParseError, formatParseProblem, formatProblem, parseGherkin } from '../lib/gherkin/parse.mjs';
import { parseFragment } from '../lib/gherkin/fragment.mjs';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUTHORING_GUIDE = path.resolve(SRC_ROOT, '..', 'docs', 'guides', 'authoring.md');

const PAGE = 'docs/guides/page.md';

/** Join lines into a fence body (no trailing newline, as mdast `code.value` has none). */
const body = (...lines: string[]) => lines.join('\n');

/** The step texts of the first child scenario. */
function stepTexts(doc: ReturnType<typeof parseFragment>['document']): string[] {
  return (doc?.feature?.children[0]?.scenario?.steps ?? []).map((s) => `${s.keyword}${s.text}`);
}

// ---------------------------------------------------------------------------
// parseGherkin
// ---------------------------------------------------------------------------

describe('parseGherkin', () => {
  const FULL = body('Feature: Book', '  Scenario: S', '    Given a', '    Then b');

  it('returns the document and no errors for valid Gherkin', () => {
    const { document, errors, problems } = parseGherkin(FULL, { display: 'x.feature' });
    expect(document?.feature?.name).toBe('Book');
    expect(errors).toEqual([]);
    expect(problems).toEqual([]);
  });

  it('builds fresh ids per call, so a second parse numbers from the start again', () => {
    const a = parseGherkin(FULL, { display: 'a' }).document;
    const b = parseGherkin(FULL, { display: 'b' }).document;
    expect(a?.feature?.children[0]?.scenario?.id).toBe(b?.feature?.children[0]?.scenario?.id);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('returns every error, formatted, instead of throwing', () => {
    const src = body('Feature: F', '  Scenario: S', '    Given a', '      | a |', '      | a | b |');
    const { document, errors, problems } = parseGherkin(src, { display: 'f.feature' });
    expect(document).toBeUndefined();
    expect(errors).toEqual(['[dk-gherkin] f.feature:5:7 inconsistent cell count within the table']);
    expect(problems).toEqual([
      { line: 5, column: 7, message: 'inconsistent cell count within the table', expected: [], eof: false },
    ]);
  });

  it('applies the line and column offsets to the formatted error, not to the problem', () => {
    const src = body('Feature: F', '  Scenario: S', '    Given a', '      | a |', '      | a | b |');
    const { errors, problems } = parseGherkin(src, { display: PAGE, lineOffset: 40, columnOffset: 3 });
    expect(errors).toEqual([`[dk-gherkin] ${PAGE}:45:10 inconsistent cell count within the table`]);
    expect(problems[0]?.line).toBe(5);
  });

  it('leaves an end-of-file column at 0 (there is no character to shift)', () => {
    const { errors, problems } = parseGherkin(body('@t'), { display: PAGE, lineOffset: 10, columnOffset: 2 });
    expect(problems.at(-1)).toMatchObject({ eof: true, expected: ['#TagLine', '#FeatureLine', '#Comment', '#Empty'] });
    expect(errors.at(-1)).toBe(
      `[dk-gherkin] ${PAGE}:12:0 unexpected end of file, expected: #TagLine, #FeatureLine, #Comment, #Empty`,
    );
  });
});

/** One raw parser error as a log line (what `parseGherkin` does per error). */
const formatParseError = (display: string, err: unknown, offsets?: { lineOffset?: number }) =>
  formatParseProblem(display, describeParseError(err), offsets);

describe('formatParseProblem / formatProblem / describeParseError', () => {
  it('reads the location from the message prefix when the error has none', () => {
    const err = new Error("(3:5): expected: #EOF, #FeatureLine, got 'Given a'");
    expect(formatParseError('a.feature', err)).toBe("[dk-gherkin] a.feature:3:5 expected: #EOF, #FeatureLine, got 'Given a'");
    expect(describeParseError(err)).toEqual({
      line: 3,
      column: 5,
      message: "expected: #EOF, #FeatureLine, got 'Given a'",
      expected: ['#EOF', '#FeatureLine'],
      eof: false,
    });
  });

  it('omits the location when there is none', () => {
    expect(formatParseError('a.feature', new Error('boom'))).toBe('[dk-gherkin] a.feature boom');
    expect(formatParseError('a.feature', 'boom', { lineOffset: 9 })).toBe('[dk-gherkin] a.feature boom');
  });

  it('formatProblem is the same text without the log prefix (an include quotes it)', () => {
    const problem = describeParseError(new Error('(3:5): inconsistent cell count within the table'));
    expect(formatProblem('x.feature', problem, { lineOffset: 1, columnOffset: 2 })).toBe(
      'x.feature:4:7 inconsistent cell count within the table',
    );
    expect(formatParseProblem('x.feature', problem)).toBe(`[dk-gherkin] ${formatProblem('x.feature', problem)}`);
  });
});

// ---------------------------------------------------------------------------
// parseFragment
// ---------------------------------------------------------------------------

describe('parseFragment: a complete feature is parsed as written', () => {
  it('does not wrap, and reports no synthetic level', () => {
    const r = parseFragment(body('Feature: Book', '  Scenario: S', '    Given a'), { display: PAGE });
    expect(r.errors).toEqual([]);
    expect(r.lineShift).toBe(0);
    expect(r.synthetic).toEqual({ feature: false, scenario: false });
    expect(r.document?.feature?.name).toBe('Book');
  });

  it('returns an empty or comment-only body as a document with no feature', () => {
    for (const src of ['', '# just a comment']) {
      const r = parseFragment(src, { display: PAGE });
      expect(r.errors).toEqual([]);
      expect(r.document?.feature).toBeUndefined();
      expect(r.synthetic).toEqual({ feature: false, scenario: false });
    }
  });
});

describe('parseFragment: steps only', () => {
  const r = parseFragment(body('Given a sailing', 'When I book it', 'Then it is confirmed'), { display: PAGE });

  it('wraps in a synthetic, untitled Feature and Scenario', () => {
    expect(r.errors).toEqual([]);
    expect(r.lineShift).toBe(2);
    expect(r.synthetic).toEqual({ feature: true, scenario: true });
    expect(r.document?.feature?.name).toBe('');
    expect(r.document?.feature?.description).toBe('');
    expect(r.document?.feature?.children).toHaveLength(1);
    expect(r.document?.feature?.children[0]?.scenario?.name).toBe('');
    expect(stepTexts(r.document)).toEqual(['Given a sailing', 'When I book it', 'Then it is confirmed']);
  });

  it('keeps AST locations in wrapped coordinates that map back with lineShift', () => {
    const steps = r.document?.feature?.children[0]?.scenario?.steps ?? [];
    expect(steps.map((s) => s.location.line - r.lineShift)).toEqual([1, 2, 3]);
  });

  it('accepts the `* ` keyword and indented steps', () => {
    const s = parseFragment(body('  * a', '  * b'), { display: PAGE });
    expect(s.synthetic).toEqual({ feature: true, scenario: true });
    expect(stepTexts(s.document)).toEqual(['* a', '* b']);
  });

  it('wraps even when a doc string in it contains a `Feature:` line (a line scan would not)', () => {
    const s = parseFragment(body('Given a file', '  """', '  Feature: not a feature', '  """', 'Then it is stored'), {
      display: PAGE,
    });
    expect(s.errors).toEqual([]);
    expect(s.synthetic).toEqual({ feature: true, scenario: true });
    const steps = s.document?.feature?.children[0]?.scenario?.steps ?? [];
    expect(steps[0]?.docString?.content).toBe('Feature: not a feature');
    expect(steps).toHaveLength(2);
  });

  it('keeps leading comments above the synthetic lines', () => {
    const s = parseFragment(body('# a comment', '', 'Given a'), { display: PAGE });
    expect(s.synthetic).toEqual({ feature: true, scenario: true });
    expect(s.document?.comments.map((c) => c.location.line)).toEqual([1]);
    expect(s.document?.feature?.children[0]?.scenario?.steps[0]?.location.line).toBe(3 + s.lineShift);
  });

  it('reads CRLF line endings as the parser does', () => {
    const s = parseFragment('Given a\r\nThen b\r\n', { display: PAGE });
    expect(s.errors).toEqual([]);
    expect(stepTexts(s.document)).toEqual(['Given a', 'Then b']);
  });
});

describe('parseFragment: a Scenario, Background or Rule with no Feature', () => {
  it('wraps a Scenario in a synthetic Feature only', () => {
    const r = parseFragment(body('Scenario: Book space', '  Given a', '  Then b'), { display: PAGE });
    expect(r.errors).toEqual([]);
    expect(r.lineShift).toBe(1);
    expect(r.synthetic).toEqual({ feature: true, scenario: false });
    expect(r.document?.feature?.name).toBe('');
    expect(r.document?.feature?.children[0]?.scenario?.name).toBe('Book space');
  });

  it('keeps tags above a Scenario on that Scenario, not on the synthetic Feature', () => {
    const r = parseFragment(body('@smoke @FR-003', 'Scenario: Tagged', '  Given a'), { display: PAGE });
    expect(r.errors).toEqual([]);
    expect(r.synthetic).toEqual({ feature: true, scenario: false });
    expect(r.document?.feature?.tags).toEqual([]);
    expect(r.document?.feature?.children[0]?.scenario?.tags.map((t) => t.name)).toEqual(['@smoke', '@FR-003']);
  });

  it('wraps a Background with Scenarios, and a Rule', () => {
    const bg = parseFragment(body('Background:', '  Given a', 'Scenario: S', '  Then b'), { display: PAGE });
    expect(bg.errors).toEqual([]);
    expect(bg.synthetic).toEqual({ feature: true, scenario: false });
    expect(bg.document?.feature?.children[0]?.background?.steps).toHaveLength(1);
    expect(bg.document?.feature?.children[1]?.scenario?.name).toBe('S');
    const rule = parseFragment(body('Rule: R', '  Scenario: S', '    Given a'), { display: PAGE });
    expect(rule.errors).toEqual([]);
    expect(rule.document?.feature?.children[0]?.rule?.name).toBe('R');
  });
});

describe('parseFragment: real errors stay errors, at the author’s line', () => {
  it('reports an error inside a steps-only fragment at its original line', () => {
    const r = parseFragment(body('Given a', '  | a |', '  | a | b |'), { display: PAGE });
    expect(r.synthetic).toEqual({ feature: true, scenario: true });
    expect(r.document).toBeUndefined();
    expect(r.errors).toEqual([`[dk-gherkin] ${PAGE}:3:3 inconsistent cell count within the table`]);
    expect(r.problems[0]?.line).toBe(3);
  });

  it('reports an error after a Scenario-only wrap at its original line', () => {
    const r = parseFragment(body('Scenario: S', '  Given a', 'Feature: late'), { display: PAGE });
    expect(r.synthetic.feature).toBe(true);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(new RegExp(`^\\[dk-gherkin\\] ${PAGE}:3:1 expected: .*got 'Feature: late'$`));
  });

  it('does not wrap when the first error is not a missing Feature line', () => {
    const lang = parseFragment(body('# language: xx', 'Given a'), { display: PAGE });
    expect(lang.synthetic).toEqual({ feature: false, scenario: false });
    expect(lang.errors[0]).toBe(`[dk-gherkin] ${PAGE}:1:1 Language not supported: xx`);

    const late = parseFragment(body('Feature: F', '  Scenario: S', '    Given a', '      | a |', '      | a | b |'), {
      display: PAGE,
    });
    expect(late.synthetic).toEqual({ feature: false, scenario: false });
    expect(late.errors).toEqual([`[dk-gherkin] ${PAGE}:5:7 inconsistent cell count within the table`]);
  });

  it('does not wrap when a bad tag line comes first', () => {
    const r = parseFragment(body('@bad tag', 'Scenario: S', '  Given a'), { display: PAGE });
    expect(r.synthetic).toEqual({ feature: false, scenario: false });
    expect(r.errors[0]).toBe(`[dk-gherkin] ${PAGE}:1:1 A tag may not contain whitespace`);
  });

  it('does not wrap a dangling tag at end of file', () => {
    const r = parseFragment(body('@t'), { display: PAGE });
    expect(r.synthetic).toEqual({ feature: false, scenario: false });
    expect(r.errors).toEqual([
      `[dk-gherkin] ${PAGE}:2:0 unexpected end of file, expected: #TagLine, #FeatureLine, #Comment, #Empty`,
    ]);
  });

  it('reports tags followed by steps at the step line (tags need a Scenario to sit on)', () => {
    const r = parseFragment(body('@t', 'Given a'), { display: PAGE });
    expect(r.synthetic).toEqual({ feature: true, scenario: false });
    expect(r.document).toBeUndefined();
    expect(r.errors[0]).toMatch(new RegExp(`^\\[dk-gherkin\\] ${PAGE}:2:1 expected: .*got 'Given a'$`));
  });
});

describe('parseFragment: page lines (contract §1.4)', () => {
  // A fence opened on page line 40: its content line n is page line 40 + n.
  const at = { display: PAGE, lineOffset: 40 };

  it('an unwrapped fence: content line 3 reports page line 43', () => {
    const r = parseFragment(body('Feature: F', '  Scenario: S', '  @bad tag'), at);
    expect(r.lineShift).toBe(0);
    expect(r.synthetic).toEqual({ feature: false, scenario: false });
    expect(r.errors).toEqual([`[dk-gherkin] ${PAGE}:43:3 A tag may not contain whitespace`]);
  });

  it('a wrapped fence: content line 3 reports page line 43', () => {
    const steps = parseFragment(body('Given a', '  | a |', '  | a | b |'), at);
    expect(steps.lineShift).toBe(2);
    expect(steps.errors).toEqual([`[dk-gherkin] ${PAGE}:43:3 inconsistent cell count within the table`]);
    const scenario = parseFragment(body('Scenario: S', '  Given a', 'Feature: late'), at);
    expect(scenario.lineShift).toBe(1);
    expect(scenario.errors[0]).toMatch(new RegExp(`^\\[dk-gherkin\\] ${PAGE}:43:1 `));
  });

  it('adds the column offset of an indented fence', () => {
    const r = parseFragment(body('Given a', '  | a |', '  | a | b |'), { ...at, columnOffset: 4 });
    expect(r.errors).toEqual([`[dk-gherkin] ${PAGE}:43:7 inconsistent cell count within the table`]);
  });
});

describe('parseFragment: `# language:` fragments wrap in that language', () => {
  it('nl steps get a Functionaliteit and a Voorbeeld, with the header kept first', () => {
    const r = parseFragment(body('# language: nl', 'Gegeven een zending', 'Dan is de boeking bevestigd'), {
      display: PAGE,
    });
    expect(r.errors).toEqual([]);
    expect(r.synthetic).toEqual({ feature: true, scenario: true });
    expect(r.document?.feature?.language).toBe('nl');
    expect(r.document?.feature?.keyword).toBe('Functionaliteit');
    expect(r.document?.feature?.children[0]?.scenario?.keyword).toBe('Voorbeeld');
    expect(stepTexts(r.document)).toEqual(['Gegeven een zending', 'Dan is de boeking bevestigd']);
  });

  it('an nl Scenario gets a Functionaliteit only', () => {
    const r = parseFragment(body('# language: nl', 'Scenario: Boeken', '  Gegeven een zending'), { display: PAGE });
    expect(r.errors).toEqual([]);
    expect(r.synthetic).toEqual({ feature: true, scenario: false });
    expect(r.document?.feature?.keyword).toBe('Functionaliteit');
  });

  it('English step keywords are not steps in an nl fragment', () => {
    // `Given` is not an nl step keyword, so no Scenario is synthesised and the
    // line is read as Feature description, exactly as the parser reads it.
    const r = parseFragment(body('# language: nl', 'Given a'), { display: PAGE });
    expect(r.synthetic).toEqual({ feature: true, scenario: false });
    expect(r.document?.feature?.description).toBe('Given a');
  });
});

describe('the ```gherkin fences in docs/guides/authoring.md', () => {
  /** Every ```gherkin fence body in the guide, with the line of its opening fence. */
  const fences = (() => {
    const lines = readFileSync(AUTHORING_GUIDE, 'utf8').split('\n');
    const out: { line: number; source: string }[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!/^```gherkin\b/.test(lines[i] ?? '')) continue;
      const end = lines.indexOf('```', i + 1);
      out.push({ line: i + 1, source: lines.slice(i + 1, end).join('\n') });
      i = end;
    }
    return out;
  })();

  it('has two', () => {
    expect(fences).toHaveLength(2);
  });

  it('the metadata-tags example is a complete feature', () => {
    const r = parseFragment(fences[0]?.source ?? '', { display: 'docs/guides/authoring.md', lineOffset: fences[0]?.line });
    expect(r.errors).toEqual([]);
    expect(r.synthetic).toEqual({ feature: false, scenario: false });
    expect(r.document?.feature?.name).toBe('Book a consignment');
  });

  it('the declarative-scenarios example is a steps-only fragment', () => {
    const r = parseFragment(fences[1]?.source ?? '', { display: 'docs/guides/authoring.md', lineOffset: fences[1]?.line });
    expect(r.errors).toEqual([]);
    expect(r.synthetic).toEqual({ feature: true, scenario: true });
    expect(stepTexts(r.document)).toEqual([
      'When the shipper books the consignment onto the sailing',
      'Then the booking is confirmed',
      'When I click "#book-button"',
      'And I fill in "size" with "12"',
    ]);
  });
});
