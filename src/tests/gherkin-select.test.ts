/**
 * Gherkin in any page — scenario selection for the include directive
 * (ADR-0051; rendering contract §2.2 and §2.4).
 *
 * Pins `selectScenarios` (`lib/gherkin/select.mjs`):
 *   - `scenario`: exact, case-sensitive match on the trimmed name, top level and
 *     inside Rules; absent → `notFound` with the names; duplicated → `ambiguous`
 *     with the lines;
 *   - `tags`: any-of over INHERITED pickle tags (feature, rule, scenario,
 *     examples), case-sensitive, `@` optional; an outline keeps only its matching
 *     Examples blocks; outlines with rowless Examples are reported on a miss;
 *   - both → `conflict`; neither → the input, unchanged;
 *   - pruning keeps the Feature Background, a kept scenario's Rule and that
 *     Rule's Background, and never mutates the input.
 */
import { describe, expect, it } from 'vitest';
import type { Scenario } from '@cucumber/messages';
import { parseGherkin } from '../lib/gherkin/parse.mjs';
import { selectScenarios } from '../lib/gherkin/select.mjs';
import { featureView } from '../lib/gherkin/view.mjs';

type Doc = NonNullable<ReturnType<typeof parseGherkin>['document']>;

function parse(...lines: string[]): Doc {
  const { document, errors } = parseGherkin(lines.join('\n'), { display: 'features/x.feature' });
  expect(errors).toEqual([]);
  return document as Doc;
}

/** A compact outline of what a (pruned) document still holds. */
function shape(doc: Doc): string[] {
  const out: string[] = [];
  const scenario = (s: Scenario, indent: string) => {
    out.push(`${indent}${s.keyword}: ${s.name}`);
    for (const ex of s.examples) out.push(`${indent}  Examples: ${ex.name} (${ex.tableBody.length})`);
  };
  for (const child of doc.feature?.children ?? []) {
    if (child.background) out.push(`Background: ${child.background.name}`);
    if (child.scenario) scenario(child.scenario, '');
    if (child.rule) {
      out.push(`Rule: ${child.rule.name}`);
      for (const rc of child.rule.children) {
        if (rc.background) out.push(`  Background: ${rc.background.name}`);
        if (rc.scenario) scenario(rc.scenario, '  ');
      }
    }
  }
  return out;
}

const SHIPPING = parse(
  '@shipping',
  'Feature: Book a consignment', //                     2
  '  Background: Feature bg', //                        3
  '    Given a shipper', //                             4
  '', //                                                5
  '  @smoke', //                                        6
  '  Scenario: Book space', //                          7
  '    When I book', //                                 8
  '', //                                                9
  '  Scenario Outline: Book <n> boxes', //             10
  '    When I book <n>', //                            11
  '', //                                               12
  '    @happy', //                                     13
  '    Examples: Small', //                            14
  '      | n |', //                                    15
  '      | 1 |', //                                    16
  '      | 2 |', //                                    17
  '', //                                               18
  '    @edge', //                                      19
  '    Examples: Large', //                            20
  '      | n |', //                                    21
  '      | 999 |', //                                  22
  '', //                                               23
  '  @refunds', //                                     24
  '  Rule: Refunds', //                                25
  '    Background: Rule bg', //                        26
  '      Given a paid booking', //                     27
  '', //                                               28
  '    Scenario: Refund in full', //                   29
  '      When I cancel', //                            30
  '', //                                               31
  '    @smoke', //                                     32
  '    Scenario: Partial refund', //                   33
  '      When I cancel late', //                       34
  '', //                                               35
  '  Rule: Amendments', //                             36
  '    Background: Amend bg', //                       37
  '      Given a booking', //                          38
  '', //                                               39
  '    Scenario: Amend date', //                       40
  '      When I amend', //                             41
);

const FULL_SHAPE = shape(SHIPPING);

describe('selectScenarios — by name (contract §2.2)', () => {
  it('a top-level scenario keeps the Feature Background and drops every Rule', () => {
    const r = selectScenarios(SHIPPING, { scenario: 'Book space' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(shape(r.document)).toEqual(['Background: Feature bg', 'Scenario: Book space']);
    expect(r.selected).toEqual([{ id: expect.any(String), name: 'Book space', line: 7 }]);
  });

  it('a scenario inside a Rule keeps that Rule and its Background only', () => {
    const r = selectScenarios(SHIPPING, { scenario: 'Refund in full' });
    expect(r.ok && shape(r.document)).toEqual([
      'Background: Feature bg',
      'Rule: Refunds',
      '  Background: Rule bg',
      '  Scenario: Refund in full',
    ]);
  });

  it('an outline matched by name keeps all of its Examples blocks', () => {
    const r = selectScenarios(SHIPPING, { scenario: 'Book <n> boxes' });
    expect(r.ok && shape(r.document)).toEqual([
      'Background: Feature bg',
      'Scenario Outline: Book <n> boxes',
      '  Examples: Small (2)',
      '  Examples: Large (1)',
    ]);
  });

  it('matches on the trimmed name, and trims the attribute value', () => {
    const doc = parse('Feature: F', '  Scenario:   Padded name   ', '    Given x');
    const r = selectScenarios(doc, { scenario: ' Padded name ' });
    expect(r.ok && r.selected.map((s) => s.name)).toEqual(['Padded name']);
  });

  it('is case-sensitive and exact: an absent name is notFound with every name listed', () => {
    for (const scenario of ['book space', 'Book', 'Book space!']) {
      expect(selectScenarios(SHIPPING, { scenario })).toEqual({
        ok: false,
        reason: 'notFound',
        scenario,
        names: ['Book space', 'Book <n> boxes', 'Refund in full', 'Partial refund', 'Amend date'],
      });
    }
  });

  it('a name used twice (top level and in a Rule) is ambiguous with both lines', () => {
    const doc = parse(
      'Feature: F',
      '  Scenario: Same',
      '    Given a',
      '  Rule: R',
      '    Scenario Outline: Same',
      '      Given <x>',
      '      Examples:',
      '        | x |',
      '        | 1 |',
    );
    expect(selectScenarios(doc, { scenario: 'Same' })).toEqual({
      ok: false,
      reason: 'ambiguous',
      scenario: 'Same',
      lines: [2, 5],
    });
  });

  it('a document with no Feature finds nothing', () => {
    const doc = parse('# just a comment');
    expect(selectScenarios(doc, { scenario: 'x' })).toMatchObject({ ok: false, reason: 'notFound', names: [] });
    expect(selectScenarios(doc, { tags: ['@x'] })).toMatchObject({ ok: false, reason: 'noTagMatch' });
  });
});

describe('selectScenarios — by tags (contract §2.2)', () => {
  it('a Feature tag is inherited by every pickle, so it selects everything', () => {
    const r = selectScenarios(SHIPPING, { tags: ['@shipping'] });
    expect(r.ok && shape(r.document)).toEqual(FULL_SHAPE);
    expect(r.ok && r.selected).toHaveLength(5);
  });

  it('a Rule tag selects every scenario of that Rule, with its Background', () => {
    const r = selectScenarios(SHIPPING, { tags: ['refunds'] });
    expect(r.ok && shape(r.document)).toEqual([
      'Background: Feature bg',
      'Rule: Refunds',
      '  Background: Rule bg',
      '  Scenario: Refund in full',
      '  Scenario: Partial refund',
    ]);
  });

  it('a tag on one Examples block keeps the outline with that block only', () => {
    const r = selectScenarios(SHIPPING, { tags: ['@edge'] });
    expect(r.ok && shape(r.document)).toEqual([
      'Background: Feature bg',
      'Scenario Outline: Book <n> boxes',
      '  Examples: Large (1)',
    ]);
  });

  it('any-of: scenarios matching either tag are kept, top level and in a Rule', () => {
    const r = selectScenarios(SHIPPING, { tags: ['@smoke', '@happy'] });
    expect(r.ok && shape(r.document)).toEqual([
      'Background: Feature bg',
      'Scenario: Book space',
      'Scenario Outline: Book <n> boxes',
      '  Examples: Small (2)',
      'Rule: Refunds',
      '  Background: Rule bg',
      '  Scenario: Partial refund',
    ]);
    expect(r.ok && r.selected.map((s) => s.line)).toEqual([7, 10, 33]);
  });

  it('is case-sensitive: @Smoke does not match @smoke', () => {
    expect(selectScenarios(SHIPPING, { tags: ['@Smoke'] })).toEqual({
      ok: false,
      reason: 'noTagMatch',
      tags: ['@Smoke'],
      emptyOutlines: [],
    });
  });

  it('an empty tag list matches nothing', () => {
    expect(selectScenarios(SHIPPING, { tags: [] })).toMatchObject({ ok: false, reason: 'noTagMatch', tags: [] });
  });

  it('a tagged outline whose Examples have no rows yields no pickle and is reported on the miss', () => {
    const doc = parse(
      'Feature: F',
      '  Scenario: Other',
      '    Given a',
      '  @wip',
      '  Scenario Outline: Pending <x>',
      '    Given <x>',
      '    Examples:',
      '      | x |',
    );
    expect(selectScenarios(doc, { tags: ['@wip'] })).toEqual({
      ok: false,
      reason: 'noTagMatch',
      tags: ['@wip'],
      emptyOutlines: [{ id: expect.any(String), name: 'Pending <x>', line: 5 }],
    });
    // …and stays selectable by name.
    expect(selectScenarios(doc, { scenario: 'Pending <x>' }).ok).toBe(true);
  });

  it('an outline with no Examples block compiles as a scenario and is selectable by tag', () => {
    const doc = parse('Feature: F', '  @wip', '  Scenario Outline: Bare', '    Given x');
    const r = selectScenarios(doc, { tags: ['@wip'] });
    expect(r.ok && shape(r.document)).toEqual(['Scenario Outline: Bare']);
  });

});

describe('selectScenarios — combinations and purity (contract §2.2, §5)', () => {
  it('scenario and tags together are a conflict', () => {
    expect(selectScenarios(SHIPPING, { scenario: 'Book space', tags: ['@smoke'] })).toEqual({
      ok: false,
      reason: 'conflict',
    });
  });

  it('no selection returns the input document and lists every scenario', () => {
    const r = selectScenarios(SHIPPING, {});
    expect(r.ok && r.document).toBe(SHIPPING);
    expect(r.ok && r.selected.map((s) => s.name)).toEqual([
      'Book space',
      'Book <n> boxes',
      'Refund in full',
      'Partial refund',
      'Amend date',
    ]);
    expect(selectScenarios(SHIPPING).ok).toBe(true);
  });

  it('summary counts follow the PRUNED AST (contract §2.4: featureView of the selection)', () => {
    const counts = (opts: Parameters<typeof selectScenarios>[1]) => {
      const r = selectScenarios(SHIPPING, opts);
      if (!r.ok) throw new Error(r.reason);
      return featureView(r.document)?.counts;
    };
    expect(counts({})).toEqual({ rules: 2, scenarios: 5, exampleRows: 3 });
    // The outline keeps its @edge block only: one of its three rows.
    expect(counts({ tags: ['@edge'] })).toEqual({ rules: 0, scenarios: 1, exampleRows: 1 });
    // A scenario in a Rule keeps that Rule and nothing else.
    expect(counts({ scenario: 'Refund in full' })).toEqual({ rules: 1, scenarios: 1, exampleRows: 0 });
    // @smoke: one top-level scenario and one in Refunds.
    expect(counts({ tags: ['@smoke'] })).toEqual({ rules: 1, scenarios: 2, exampleRows: 0 });
  });

  it('never mutates the input document', () => {
    const before = structuredClone(SHIPPING);
    for (const opts of [{ scenario: 'Amend date' }, { tags: ['@edge'] }, { tags: ['@smoke'] }, { tags: ['@none'] }]) {
      const r = selectScenarios(SHIPPING, opts);
      if (r.ok) expect(r.document).not.toBe(SHIPPING);
    }
    expect(SHIPPING).toEqual(before);
  });
});
