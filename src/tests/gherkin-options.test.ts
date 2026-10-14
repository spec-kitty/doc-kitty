/**
 * The `gherkin` option shape (ADR-0051): `true | { fences?, includeRoots?,
 * sources?, section?, sourceUrlPrefix?, sourceRoot? }`, normalised ONCE in the
 * pure `gherkin/options.mjs` for the integration, while the bare-Node CLI keeps
 * calling the generated-pages validator (so `--sources` stays required).
 *
 * Proven here:
 *  - the normalisation table: `true`, `{}`, `{ includeRoots }`, `{ sources }`,
 *    `{ sources, fences: false }` and friends, with their defaults;
 *  - `pages` exists exactly when `sources` is given (everything generated-pages
 *    in `config.ts` hangs off it);
 *  - every bad shape is refused with a `[dk-gherkin]` message naming the option;
 *  - the result never aliases the caller's arrays.
 * The CLI's "`--sources` is required" refusal is pinned in `gherkin-check-cli.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  GHERKIN_OPTION_KEYS,
  normalizeGherkinOptions,
  validateGherkinPages,
} from '../lib/gherkin/options.mjs';

describe('normalizeGherkinOptions: the normalisation table (ADR-0051)', () => {
  it.each([
    ['true', true, { fences: true, includeRoots: [], sourceRoot: '.' }],
    ['{}', {}, { fences: true, includeRoots: [], sourceRoot: '.' }],
    ['{ fences: false }', { fences: false }, { fences: false, includeRoots: [], sourceRoot: '.' }],
    [
      '{ includeRoots }',
      { includeRoots: ['features', '../shared/specs'] },
      { fences: true, includeRoots: ['features', '../shared/specs'], sourceRoot: '.' },
    ],
    [
      '{ includeRoots: [] }',
      { includeRoots: [] },
      { fences: true, includeRoots: [], sourceRoot: '.' },
    ],
    [
      '{ sources }',
      { sources: ['features'] },
      {
        fences: true,
        includeRoots: ['features'],
        sourceRoot: '.',
        pages: { sources: ['features'], section: 'behaviour', sourceRoot: '.' },
      },
    ],
    [
      '{ sources, fences: false }',
      { sources: ['features'], fences: false },
      {
        fences: false,
        includeRoots: ['features'],
        sourceRoot: '.',
        pages: { sources: ['features'], section: 'behaviour', sourceRoot: '.' },
      },
    ],
    [
      '{ sources, includeRoots } (explicit roots win over the sources default)',
      { sources: ['features'], includeRoots: ['specs'] },
      {
        fences: true,
        includeRoots: ['specs'],
        sourceRoot: '.',
        pages: { sources: ['features'], section: 'behaviour', sourceRoot: '.' },
      },
    ],
    [
      'every key',
      {
        fences: true,
        includeRoots: ['features'],
        sources: ['../features'],
        section: 'specs',
        sourceUrlPrefix: 'https://example.test/blob/main/',
        sourceRoot: '..',
      },
      {
        fences: true,
        includeRoots: ['features'],
        sourceRoot: '..',
        sourceUrlPrefix: 'https://example.test/blob/main/',
        pages: {
          sources: ['../features'],
          section: 'specs',
          sourceUrlPrefix: 'https://example.test/blob/main/',
          sourceRoot: '..',
        },
      },
    ],
    [
      'source-link keys without sources (they also label includes)',
      { sourceUrlPrefix: 'https://example.test/', sourceRoot: '..' },
      { fences: true, includeRoots: [], sourceRoot: '..', sourceUrlPrefix: 'https://example.test/' },
    ],
    [
      'keys set to undefined (treated as absent)',
      { fences: undefined, includeRoots: undefined, sources: undefined },
      { fences: true, includeRoots: [], sourceRoot: '.' },
    ],
  ])('%s', (_label, raw, expected) => {
    expect(normalizeGherkinOptions(raw)).toEqual(expected);
  });

  it('copies arrays, so the result never aliases the consumer config', () => {
    const sources = ['features'];
    const includeRoots = ['specs'];
    const fromSources = normalizeGherkinOptions({ sources });
    const fromRoots = normalizeGherkinOptions({ includeRoots });
    expect(fromSources.includeRoots).not.toBe(sources);
    expect(fromSources.includeRoots).not.toBe(fromSources.pages?.sources);
    expect(fromRoots.includeRoots).not.toBe(includeRoots);
  });

  it('accepts exactly the documented keys', () => {
    expect([...GHERKIN_OPTION_KEYS]).toEqual([
      'fences',
      'includeRoots',
      'sources',
      'section',
      'sourceUrlPrefix',
      'sourceRoot',
      'allowEmpty',
      'titles',
    ]);
  });

  it('passes reservedSections through to the pages validator', () => {
    expect(() =>
      normalizeGherkinOptions({ sources: ['f'], section: 'specs' }, { reservedSections: ['specs'] }),
    ).toThrow(/^\[dk-gherkin\] gherkin\.section "specs" is reserved/);
    // Default list: `glossary` and `_meta`.
    expect(() => normalizeGherkinOptions({ sources: ['f'], section: 'glossary' })).toThrow(
      /^\[dk-gherkin\] gherkin\.section "glossary" is reserved/,
    );
  });
});

describe('normalizeGherkinOptions: rejections', () => {
  it.each([
    ['false', false],
    ['null', null],
    ['a string', 'features'],
    ['a number', 1],
    ['an array', ['features']],
  ])('refuses %s as the option value', (_label, raw) => {
    expect(() => normalizeGherkinOptions(raw)).toThrow(
      /^\[dk-gherkin\] gherkin must be true or an options object \(omit it to turn the preset off\)/,
    );
  });

  it('refuses unknown keys, naming each and the allowed set', () => {
    expect(() => normalizeGherkinOptions({ includeRoot: ['f'], fence: true })).toThrow(
      '[dk-gherkin] unknown option gherkin.includeRoot, gherkin.fence; ' +
        'expected one of fences, includeRoots, sources, section, sourceUrlPrefix, sourceRoot',
    );
  });

  it.each([
    ['a string', 'yes'],
    ['a number', 1],
    ['null', null],
  ])('refuses a fences value that is %s', (_label, fences) => {
    expect(() => normalizeGherkinOptions({ fences })).toThrow(
      /^\[dk-gherkin\] gherkin\.fences must be a boolean/,
    );
  });

  it.each([
    ['a string', 'features'],
    ['null', null],
    ['a non-string entry', ['features', 3]],
    ['an empty entry', ['']],
    ['a blank entry', ['features', '  ']],
    ['an absolute POSIX path', ['/srv/features']],
    ['a leading backslash', ['\\\\server\\share']],
    ['a backslash separator', ['docs\\features']],
    ['a NUL byte', ['features\0']],
    ['a Windows drive path', ['C:\\features']],
    ['a URL', ['https://example.test/features']],
    ['a file: URL', ['file:///srv/features']],
  ])('refuses includeRoots that is %s', (_label, includeRoots) => {
    expect(() => normalizeGherkinOptions({ includeRoots })).toThrow(
      /^\[dk-gherkin\] gherkin\.includeRoots must be an array of directory paths relative to the project root/,
    );
  });

  it.each([
    ['section', { section: 'specs' }],
    ['allowEmpty', { allowEmpty: true }],
    ['titles', { titles: { hr: 'HR' } }],
  ])('refuses %s without sources (it only steers pages that would never be generated)', (key, raw) => {
    expect(() => normalizeGherkinOptions(raw)).toThrow(
      new RegExp(`^\\[dk-gherkin\\] gherkin\\.${key} only applies to generated pages; set gherkin\\.sources as well`),
    );
  });

  it('carries allowEmpty into pages only when true', () => {
    expect(normalizeGherkinOptions({ sources: ['f'], allowEmpty: true }).pages?.allowEmpty).toBe(true);
    expect(normalizeGherkinOptions({ sources: ['f'], allowEmpty: false }).pages).not.toHaveProperty('allowEmpty');
    expect(() => normalizeGherkinOptions({ sources: ['f'], allowEmpty: 'yes' })).toThrow(
      /^\[dk-gherkin\] gherkin\.allowEmpty must be true or false/,
    );
  });

  it.each([
    ['an empty sources array', { sources: [] }],
    ['a non-array sources', { sources: 'features' }],
    ['a null sources', { sources: null }],
    ['a blank source entry', { sources: ['features', ' '] }],
  ])('runs the pages rules once sources is present: %s', (_label, raw) => {
    expect(() => normalizeGherkinOptions(raw)).toThrow(
      /^\[dk-gherkin\] gherkin\.sources must be a non-empty array/,
    );
  });

  it.each([
    ['with sources', { sources: ['f'] }],
    ['without sources', {}],
  ])('checks the source-link keys %s', (_label, base) => {
    expect(() => normalizeGherkinOptions({ ...base, sourceUrlPrefix: 1 })).toThrow(
      /^\[dk-gherkin\] gherkin\.sourceUrlPrefix must be a string/,
    );
    expect(() => normalizeGherkinOptions({ ...base, sourceRoot: '' })).toThrow(
      /^\[dk-gherkin\] gherkin\.sourceRoot must be a non-empty path string/,
    );
  });
});

describe('gherkin.titles: hub titles by source directory (#125)', () => {
  it('carries a valid map into pages as a fresh copy', () => {
    const titles = { hr: 'HR', 'shipping/edi': 'EDI messages' };
    const pages = normalizeGherkinOptions({ sources: ['features'], titles }).pages;
    expect(pages?.titles).toEqual(titles);
    expect(pages?.titles).not.toBe(titles);
    // A `__proto__` key stays an own key (it is not swallowed into the prototype), so
    // the unknown-key warning still sees it.
    const proto = normalizeGherkinOptions({
      sources: ['features'],
      titles: JSON.parse('{"__proto__":"X"}'),
    }).pages;
    expect(Object.keys(proto?.titles ?? {})).toEqual(['__proto__']);
    expect(normalizeGherkinOptions({ sources: ['features'] }).pages).not.toHaveProperty('titles');
  });

  it.each([
    ['an array', ['hr']],
    ['null', null],
    ['a string', 'hr=HR'],
  ])('refuses titles that is %s', (_label, titles) => {
    expect(() => normalizeGherkinOptions({ sources: ['f'], titles })).toThrow(
      /^\[dk-gherkin\] gherkin\.titles must be an object mapping a source-relative directory to a title/,
    );
  });

  it.each([
    ['an empty key', ''],
    ['an absolute path', '/hr'],
    ['a trailing slash', 'hr/'],
    ['a ./ segment', './hr'],
    ['a .. segment', 'a/../b'],
    ['an empty segment', 'a//b'],
    ['a backslash', 'a\\b'],
    ['a drive letter', 'C:/hr'],
  ])('refuses a key with %s', (_label, key) => {
    expect(() => normalizeGherkinOptions({ sources: ['f'], titles: { [key]: 'X' } })).toThrow(
      `[dk-gherkin] gherkin.titles key ${JSON.stringify(key)} must be a directory path relative to a source`,
    );
  });

  it.each([
    ['blank', '  '],
    ['a number', 1],
    ['null', null],
  ])('refuses a title that is %s', (_label, title) => {
    expect(() => normalizeGherkinOptions({ sources: ['f'], titles: { hr: title } })).toThrow(
      '[dk-gherkin] gherkin.titles["hr"] must be a non-blank string',
    );
  });

  it('names the CLI flag when the CLI validates', () => {
    expect(() =>
      validateGherkinPages({ sources: ['f'], titles: { '': 'X' } }, { optionName: () => '--titles' }),
    ).toThrow('[dk-gherkin] --titles key "" must be a directory path relative to a source');
  });
});

describe('validateGherkinPages: the generated-pages rules (ADR-0046, unchanged)', () => {
  it('requires sources, so the CLI path keeps requiring them', () => {
    expect(() => validateGherkinPages({})).toThrow(
      /^\[dk-gherkin\] gherkin\.sources must be a non-empty array/,
    );
  });

  it('ignores the in-page keys (they are not the pages validator’s concern)', () => {
    expect(validateGherkinPages({ sources: ['f'], fences: false, includeRoots: ['x'] })).toEqual({
      sources: ['f'],
      section: 'behaviour',
      sourceRoot: '.',
    });
  });
});
