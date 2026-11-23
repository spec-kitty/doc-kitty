import { describe, it, expect } from 'vitest';
import {
  MEASURE_NATURES,
  MEASURE_SCOPES,
  buildMeasuresIndex,
  classificationProblems,
  normaliseClassification,
  parseMeasuresCatalog,
  resolveClassification,
} from '../lib/measures-core.mjs';

const CATALOG = 'test catalog';

const record = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  label: `Label ${id}`,
  nature: 'technical',
  frameworks: [{ framework: 'x', ref: '1' }],
  ...extra,
});

const index = buildMeasuresIndex(
  parseMeasuresCatalog(
    [
      record('transmission-protection', { dpv: 'https://w3id.org/dpv#EncryptionInTransfer' }),
      record('events-logging'),
      record('accountability', { nature: 'organisational' }),
    ],
    CATALOG,
  ).records,
);

describe('parseMeasuresCatalog', () => {
  it('accepts a valid list and keeps a fixed key order without unknown keys', () => {
    const { records, problems } = parseMeasuresCatalog(
      [{ extra: 1, dpv: 'https://w3id.org/dpv#X', frameworks: [{ ref: '9', framework: 'f' }], nature: 'physical', label: 'L', id: 'a-b' }],
      CATALOG,
    );
    expect(problems).toEqual([]);
    expect(records).toEqual([
      { id: 'a-b', label: 'L', nature: 'physical', frameworks: [{ framework: 'f', ref: '9' }], dpv: 'https://w3id.org/dpv#X' },
    ]);
    expect(Object.keys(records[0]!)).toEqual(['id', 'label', 'nature', 'frameworks', 'dpv']);
  });

  it('treats an empty file as zero records', () => {
    expect(parseMeasuresCatalog(null, CATALOG)).toEqual({ records: [], problems: [] });
    expect(parseMeasuresCatalog(undefined, CATALOG)).toEqual({ records: [], problems: [] });
    expect(parseMeasuresCatalog([], CATALOG)).toEqual({ records: [], problems: [] });
  });

  it('rejects a catalog that is not a list', () => {
    const { records, problems } = parseMeasuresCatalog({ id: 'x' }, CATALOG);
    expect(records).toEqual([]);
    expect(problems).toEqual([`[dk-measures] ${CATALOG}: must be a YAML list of measure records`]);
  });

  it.each([
    ['not a mapping', 'oops', 'record 0: is not a mapping'],
    ['missing id', { ...record('x'), id: undefined }, 'record 0: "id" must be a kebab-case string'],
    ['non-kebab id', record('Not_Kebab'), 'Not_Kebab: "id" must be a kebab-case string'],
    ['missing label', record('x', { label: '' }), 'x: "label" must be a non-empty string'],
    ['unknown nature', record('x', { nature: 'magical' }), `x: "nature" must be one of ${MEASURE_NATURES.join(', ')}`],
    ['no frameworks', record('x', { frameworks: [] }), 'x: "frameworks" must be a non-empty list of { framework, ref }'],
    ['bad framework entry', record('x', { frameworks: [{ framework: 'f' }] }), 'x: "frameworks" must be a non-empty list of { framework, ref }'],
    ['bad dpv', record('x', { dpv: 'dpv:Encryption' }), 'x: "dpv" must be an http(s) IRI'],
  ])('reports %s and drops the record', (_name, input, problem) => {
    const { records, problems } = parseMeasuresCatalog([input], CATALOG);
    expect(records).toEqual([]);
    expect(problems).toEqual([`[dk-measures] ${CATALOG}: ${problem}`]);
  });

  it('reports a duplicate id and keeps the first record', () => {
    const { records, problems } = parseMeasuresCatalog([record('a', { label: 'one' }), record('a', { label: 'two' })], CATALOG);
    expect(records.map((r) => r.label)).toEqual(['one']);
    expect(problems).toEqual([`[dk-measures] ${CATALOG}: a: duplicate id`]);
  });
});

describe('normaliseClassification', () => {
  it('turns bare ids into system-scope entries and keeps notes', () => {
    expect(
      normaliseClassification([
        'transmission-protection',
        { measure: 'events-logging', note: 'n' },
        { measure: 'accountability', scope: 'organisation', note: '' },
      ]),
    ).toEqual([
      { measure: 'transmission-protection', scope: 'system' },
      { measure: 'events-logging', scope: 'system', note: 'n' },
      { measure: 'accountability', scope: 'organisation' },
    ]);
    expect(normaliseClassification(undefined)).toEqual([]);
    expect(MEASURE_SCOPES).toEqual(['system', 'organisation']);
  });
});

describe('resolveClassification', () => {
  it('resolves entries in authored order with catalog fields', () => {
    expect(
      resolveClassification(
        ['transmission-protection', { measure: 'accountability', scope: 'organisation', note: 'n' }],
        index,
        'a/page.md',
        CATALOG,
      ),
    ).toEqual([
      {
        measure: 'transmission-protection',
        label: 'Label transmission-protection',
        nature: 'technical',
        scope: 'system',
        dpv: 'https://w3id.org/dpv#EncryptionInTransfer',
        frameworks: [{ framework: 'x', ref: '1' }],
      },
      {
        measure: 'accountability',
        label: 'Label accountability',
        nature: 'organisational',
        scope: 'organisation',
        note: 'n',
        frameworks: [{ framework: 'x', ref: '1' }],
      },
    ]);
  });

  it('collapses an identical duplicate and keeps the first occurrence', () => {
    const out = resolveClassification(['events-logging', { measure: 'events-logging', note: 'later' }], index, 'p.md', CATALOG);
    expect(out).toHaveLength(1);
    expect(out[0]).not.toHaveProperty('note');
  });

  it('names the page and the id for an unknown measure', () => {
    expect(classificationProblems(['transmision-protection'], index, 'security/tls.md', CATALOG)).toEqual([
      `[dk-measures] security/tls.md: unknown measure id "transmision-protection" (not in ${CATALOG})`,
    ]);
    expect(() => resolveClassification(['transmision-protection'], index, 'security/tls.md', CATALOG)).toThrow(
      `[dk-measures] security/tls.md: unknown measure id "transmision-protection" (not in ${CATALOG})`,
    );
  });

  it('reports one measure listed with both scopes', () => {
    expect(
      classificationProblems(['accountability', { measure: 'accountability', scope: 'organisation' }], index, 'p.md', CATALOG),
    ).toEqual(['[dk-measures] p.md: measure "accountability" is listed with both scopes']);
  });

  it('reports malformed values without throwing', () => {
    expect(classificationProblems('events-logging', index, 'p.md', CATALOG)).toEqual([
      '[dk-measures] p.md: tom_classification must be a list',
    ]);
    expect(classificationProblems([{ note: 'x' }, 7], index, 'p.md', CATALOG)).toEqual([
      '[dk-measures] p.md: tom_classification entry 0 is not a measure id or { measure, scope?, note? }',
      '[dk-measures] p.md: tom_classification entry 1 is not a measure id or { measure, scope?, note? }',
    ]);
    expect(classificationProblems([{ measure: 'events-logging', scope: 'global' }], index, 'p.md', CATALOG)).toEqual([
      '[dk-measures] p.md: tom_classification entry 0 is not a measure id or { measure, scope?, note? }',
    ]);
  });

  it('resolves nothing against an empty catalog', () => {
    const empty = buildMeasuresIndex([]);
    expect(classificationProblems(['events-logging'], empty, 'p.md', CATALOG)).toHaveLength(1);
    expect(classificationProblems(undefined, empty, 'p.md', CATALOG)).toEqual([]);
  });
});
