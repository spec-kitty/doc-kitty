/**
 * The sub-processor catalog core (ADR-0086). Pure inputs only: no fs.
 *
 * Every rejection is paired with an acceptance on the same fixture shape, so a
 * checker that rejected everything (or nothing) would fail here
 * (tactic acceptance-criteria-non-vacuity).
 */
import { describe, expect, it } from 'vitest';
import {
  REQUIRED_FIELDS,
  SUBPROCESSOR_FIELDS,
  SUBPROCESSORS_TAG,
  checkSubprocessorData,
  deriveChanges,
  parseSubprocessorCatalog,
  resolveSubprocessorRecord,
} from '../lib/subprocessors-core.mjs';
import { ISO3166_ALPHA2 } from '../lib/subprocessors-iso3166.mjs';
import { buildMeasuresIndex } from '../lib/measures-core.mjs';
import { DEFAULT_MEASURES } from '../lib/measures-default.mjs';

const SRC = 'docs/_meta/subprocessors.yaml';
const tag = (tail: string) => `${SUBPROCESSORS_TAG} ${SRC}: ${tail}`;

/** A complete, valid record; each test copies and breaks one thing. */
const valid = () => ({
  id: 'acme-hosting',
  name: 'Acme Hosting B.V.',
  address: '1 Example Street, Amsterdam',
  contact: 'privacy@acme-hosting.example',
  processing: 'Hosting of the production database and backups.',
  location: ['NL', 'DE'],
  location_note: 'Backups replicate to Frankfurt.',
  responsibilities: 'Acme operates the infrastructure; we configure access.',
  since: '2025-01-15',
  external_references: [
    { type: 'biblio', id: 'acme-dpa' },
    { url: 'https://acme-hosting.example/security', title: 'Security overview' },
  ],
  tom_classification: ['physical-security', { measure: 'certification-assurance', note: 'ISO/IEC 27001.' }],
});

const minimal = (over: Record<string, unknown> = {}) => ({
  id: 'beta-mail',
  name: 'Beta Mail Ltd',
  processing: 'Transactional email.',
  location: ['IE'],
  responsibilities: 'Beta delivers mail; we choose what is sent.',
  since: '2027-03-01',
  ...over,
});

const REFS = {
  bibliography: new Map([['acme-dpa', { title: 'Acme DPA', url: 'https://acme-hosting.example/dpa' }]]),
  tools: new Map([['beta-cli', { name: 'Beta CLI', url: 'https://beta-mail.example/cli' }]]),
  measures: buildMeasuresIndex(DEFAULT_MEASURES),
  measuresLabel: 'the shipped default catalog',
};

const problemsOf = (data: unknown) => checkSubprocessorData(data, SRC, REFS).problems;

describe('the valid fixture (positive control for every rejection below)', () => {
  it('passes with no problems, keeps every field, and keeps field order', () => {
    const { problems, records } = checkSubprocessorData([valid(), minimal()], SRC, REFS);
    expect(problems).toEqual([]);
    expect(records).toHaveLength(2);
    expect(Object.keys(records[0])).toEqual(SUBPROCESSOR_FIELDS.filter((f) => f in valid()));
    expect(records[1]).toEqual(minimal());
  });

  it('accepts an empty list', () => {
    expect(checkSubprocessorData([], SRC, REFS)).toEqual({ records: [], changes: [], problems: [] });
  });

  it('treats an empty file (null) as an empty catalog', () => {
    expect(checkSubprocessorData(null, SRC, REFS)).toEqual({ records: [], changes: [], problems: [] });
  });

  it('names exactly six required fields', () => {
    expect(REQUIRED_FIELDS).toEqual(['id', 'name', 'processing', 'location', 'responsibilities', 'since']);
  });
});

describe('file and record shape', () => {
  it('rejects a top level that is not a list', () => {
    expect(problemsOf({ id: 'x' })).toEqual([tag('the catalog must be a list of records')]);
  });

  it('rejects a record that is not a mapping, naming it by position', () => {
    expect(problemsOf([minimal(), 'oops'])).toEqual([tag('subprocessor #2: must be a mapping')]);
  });

  it.each(['id', 'name', 'processing', 'location', 'responsibilities', 'since'])(
    'rejects a record missing required field %s',
    (field) => {
      const record: Record<string, unknown> = minimal();
      delete record[field];
      const subject = field === 'id' ? 'subprocessor #1' : 'subprocessor "beta-mail"';
      expect(problemsOf([record])).toEqual([tag(`${subject}: missing required field "${field}"`)]);
    },
  );

  it('rejects an unknown field, such as a misspelt until', () => {
    expect(problemsOf([minimal({ untill: '2028-01-01' })])).toEqual([
      tag('subprocessor "beta-mail": unknown field "untill"'),
    ]);
  });

  it('rejects an id that is not kebab-case, and names the record by position', () => {
    expect(problemsOf([minimal({ id: 'Beta_Mail' })])).toEqual([tag('subprocessor #1: id must be kebab-case')]);
  });

  it('rejects a duplicate id on the second occurrence only', () => {
    expect(problemsOf([minimal(), minimal({ name: 'Other' })])).toEqual([
      tag('subprocessor "beta-mail": duplicate id "beta-mail"'),
    ]);
  });

  it.each([
    ['name', ''],
    ['name', '   '],
    ['processing', 42],
    ['address', null],
    ['contact', ''],
    ['location_note', ''],
  ])('rejects %s = %j as not a non-empty string', (field, value) => {
    expect(problemsOf([minimal({ [field]: value })])).toEqual([
      tag(`subprocessor "beta-mail": "${field}" must be a non-empty string`),
    ]);
  });

  it('keeps a value with surrounding spaces as written', () => {
    const { records, problems } = checkSubprocessorData([minimal({ name: ' Beta Mail ' })], SRC, REFS);
    expect(problems).toEqual([]);
    expect(records[0].name).toBe(' Beta Mail ');
  });
});

describe('dates', () => {
  it.each(['2025-13-01', '2025-02-30', 'yesterday', '2025-01-15T10:00:00Z', '25-01-15', 20250115])(
    'rejects since = %j',
    (since) => {
      expect(problemsOf([minimal({ since })])).toEqual([
        tag('subprocessor "beta-mail": "since" must be a calendar date (YYYY-MM-DD)'),
      ]);
    },
  );

  it('accepts a leap day', () => {
    expect(problemsOf([minimal({ since: '2028-02-29' })])).toEqual([]);
  });

  it('rejects an until before since', () => {
    expect(problemsOf([minimal({ since: '2025-06-01', until: '2025-05-31' })])).toEqual([
      tag('subprocessor "beta-mail": "until" (2025-05-31) is before "since" (2025-06-01)'),
    ]);
  });

  it('accepts an until equal to since (a one-day engagement)', () => {
    expect(problemsOf([minimal({ since: '2025-06-01', until: '2025-06-01' })])).toEqual([]);
  });

  it('rejects a malformed until without also comparing it to since', () => {
    expect(problemsOf([minimal({ until: 'soon' })])).toEqual([
      tag('subprocessor "beta-mail": "until" must be a calendar date (YYYY-MM-DD)'),
    ]);
  });
});

describe('location', () => {
  it.each([[[]], ['IE'], [null]])('rejects location = %j', (location) => {
    expect(problemsOf([minimal({ location })])).toEqual([
      tag('subprocessor "beta-mail": "location" must list at least one country code'),
    ]);
  });

  it('rejects a code that is not assigned', () => {
    expect(problemsOf([minimal({ location: ['XX'] })])).toEqual([
      tag('subprocessor "beta-mail": "location" has "XX", which is not an assigned ISO 3166-1 alpha-2 code'),
    ]);
  });

  it('rejects UK and EU, which are not assigned codes (write GB)', () => {
    expect(problemsOf([minimal({ location: ['UK', 'EU'] })])).toEqual([
      tag('subprocessor "beta-mail": "location" has "UK", which is not an assigned ISO 3166-1 alpha-2 code'),
      tag('subprocessor "beta-mail": "location" has "EU", which is not an assigned ISO 3166-1 alpha-2 code'),
    ]);
    expect(problemsOf([minimal({ location: ['GB'] })])).toEqual([]);
  });

  it('asks for upper case when a lower-case code is otherwise valid', () => {
    expect(problemsOf([minimal({ location: ['de'] })])).toEqual([
      tag('subprocessor "beta-mail": "location" has "de"; write country codes in upper case ("DE")'),
    ]);
  });

  it('rejects a duplicate code once', () => {
    expect(problemsOf([minimal({ location: ['NL', 'DE', 'NL', 'NL'] })])).toEqual([
      tag('subprocessor "beta-mail": "location" lists "NL" twice'),
    ]);
  });

  it('rejects a non-string code', () => {
    expect(problemsOf([minimal({ location: [31] })])).toEqual([
      tag('subprocessor "beta-mail": "location" has "31", which is not an assigned ISO 3166-1 alpha-2 code'),
    ]);
  });
});

describe('the embedded ISO 3166-1 alpha-2 list', () => {
  it('holds the 249 officially assigned codes and nothing reserved', () => {
    expect(ISO3166_ALPHA2.size).toBe(249);
    for (const code of ['GB', 'NL', 'US', 'AX', 'SS', 'BQ']) expect(ISO3166_ALPHA2.has(code)).toBe(true);
    for (const code of ['UK', 'EU', 'XK', 'ZZ', 'AA', 'QM', 'XA', 'UN']) expect(ISO3166_ALPHA2.has(code)).toBe(false);
  });

  it('cannot be changed by a caller', () => {
    expect(Object.isFrozen(ISO3166_ALPHA2)).toBe(true);
    expect('add' in ISO3166_ALPHA2).toBe(false);
    expect(() => {
      (ISO3166_ALPHA2 as { size: number }).size = 0;
    }).toThrow(TypeError);
    expect(ISO3166_ALPHA2.size).toBe(249);
  });
});

describe('references', () => {
  it('rejects a biblio id that is not in the catalog', () => {
    expect(problemsOf([minimal({ external_references: [{ type: 'biblio', id: 'nope' }] })])).toEqual([
      tag('subprocessor "beta-mail": external_references cites biblio "nope", which is not in the catalog'),
    ]);
  });

  it('rejects a tool id that is not in the catalog, and accepts one that is', () => {
    expect(problemsOf([minimal({ external_references: [{ type: 'tool', id: 'nope' }] })])).toEqual([
      tag('subprocessor "beta-mail": external_references cites tool "nope", which is not in the catalog'),
    ]);
    expect(problemsOf([minimal({ external_references: [{ type: 'tool', id: 'beta-cli' }] })])).toEqual([]);
  });

  it('rejects an unknown reference type', () => {
    expect(problemsOf([minimal({ external_references: [{ type: 'paper', id: 'x' }] })])).toEqual([
      tag('subprocessor "beta-mail": external_references has unknown type "paper"'),
    ]);
  });

  it('rejects a reference that is neither inline nor a catalog key', () => {
    expect(problemsOf([minimal({ external_references: ['https://x.example', { url: 'https://x.example' }] })])).toEqual([
      tag('subprocessor "beta-mail": external_references entry 1 must be { url, title } or { type, id }'),
      tag('subprocessor "beta-mail": external_references entry 2 must be { url, title } or { type, id }'),
    ]);
  });

  it('rejects external_references that is not a list', () => {
    expect(problemsOf([minimal({ external_references: { type: 'biblio', id: 'acme-dpa' } })])).toEqual([
      tag('subprocessor "beta-mail": "external_references" must be a list'),
    ]);
  });

  it("passes the measures core's own message through for an unknown measure", () => {
    expect(problemsOf([minimal({ tom_classification: ['no-such-measure'] })])).toEqual([
      `[dk-measures] ${SRC}: subprocessor "beta-mail": unknown measure id "no-such-measure" (not in the shipped default catalog)`,
    ]);
  });

  it('checks references even on a record that also has a shape problem', () => {
    expect(problemsOf([minimal({ name: '', external_references: [{ type: 'biblio', id: 'nope' }] })])).toEqual([
      tag('subprocessor "beta-mail": "name" must be a non-empty string'),
      tag('subprocessor "beta-mail": external_references cites biblio "nope", which is not in the catalog'),
    ]);
  });
});

describe('problem order', () => {
  it('follows file order, then the order of the checks', () => {
    const problems = problemsOf([minimal({ id: 'b', location: ['xx'] }), minimal({ id: 'a', since: 'x' })]);
    expect(problems).toEqual([
      tag('subprocessor "b": "location" has "xx", which is not an assigned ISO 3166-1 alpha-2 code'),
      tag('subprocessor "a": "since" must be a calendar date (YYYY-MM-DD)'),
    ]);
  });

  it("reports a record's reference problems before the next record's shape problems", () => {
    const problems = problemsOf([
      minimal({ id: 'b', external_references: [{ type: 'biblio', id: 'nope' }] }),
      minimal({ id: 'a', since: 'x' }),
    ]);
    expect(problems).toEqual([
      tag('subprocessor "b": external_references cites biblio "nope", which is not in the catalog'),
      tag('subprocessor "a": "since" must be a calendar date (YYYY-MM-DD)'),
    ]);
  });
});

describe('changes', () => {
  const records = [
    minimal({ id: 'beta-mail', name: 'Beta Mail Ltd', since: '2027-03-01' }),
    minimal({ id: 'acme-hosting', name: 'Acme', since: '2025-01-15' }),
    minimal({ id: 'gamma', name: 'Gamma', since: '2023-01-10', until: '2025-01-15' }),
    minimal({ id: 'delta', name: 'Delta', since: '2025-01-15', until: '2025-01-15' }),
  ];

  it('derives one added entry per since and one removed entry per until, newest first', () => {
    expect(deriveChanges(records)).toEqual([
      { date: '2027-03-01', kind: 'added', id: 'beta-mail', name: 'Beta Mail Ltd' },
      { date: '2025-01-15', kind: 'added', id: 'acme-hosting', name: 'Acme' },
      { date: '2025-01-15', kind: 'added', id: 'delta', name: 'Delta' },
      { date: '2025-01-15', kind: 'removed', id: 'delta', name: 'Delta' },
      { date: '2025-01-15', kind: 'removed', id: 'gamma', name: 'Gamma' },
      { date: '2023-01-10', kind: 'added', id: 'gamma', name: 'Gamma' },
    ]);
  });

  it('does not depend on input order', () => {
    expect(deriveChanges([...records].reverse())).toEqual(deriveChanges(records));
  });

  it('is part of the checked result only when the catalog is valid', () => {
    expect(checkSubprocessorData(records, SRC, REFS).changes).toHaveLength(6);
    expect(checkSubprocessorData([...records, 'bad'], SRC, REFS).changes).toEqual([]);
  });
});

describe('resolving a record for the outputs', () => {
  it('resolves catalog references and normalises classifications', () => {
    expect(resolveSubprocessorRecord(valid(), REFS)).toEqual({
      ...valid(),
      external_references: [
        { type: 'biblio', id: 'acme-dpa', title: 'Acme DPA', url: 'https://acme-hosting.example/dpa' },
        { url: 'https://acme-hosting.example/security', title: 'Security overview' },
      ],
      tom_classification: [
        { measure: 'physical-security', scope: 'system' },
        { measure: 'certification-assurance', scope: 'system', note: 'ISO/IEC 27001.' },
      ],
    });
  });

  it('leaves a record without references unchanged', () => {
    expect(resolveSubprocessorRecord(minimal(), REFS)).toEqual(minimal());
  });

  it('resolves a tool reference to its name as the title', () => {
    expect(
      resolveSubprocessorRecord(minimal({ external_references: [{ type: 'tool', id: 'beta-cli' }] }), REFS)
        .external_references,
    ).toEqual([{ type: 'tool', id: 'beta-cli', title: 'Beta CLI', url: 'https://beta-mail.example/cli' }]);
  });
});

describe('parseSubprocessorCatalog (shape only)', () => {
  it('reports shape problems without consulting references', () => {
    const { problems } = parseSubprocessorCatalog([minimal({ external_references: [{ type: 'biblio', id: 'nope' }] })], SRC);
    expect(problems).toEqual([]);
  });
});
