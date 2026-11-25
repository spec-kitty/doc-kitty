/**
 * The sub-processor catalog loader (ADR-0086): reads `<docsRoot>/_meta/subprocessors.yaml`
 * and the reference catalogs beside it, then runs the pure core.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUBPROCESSORS_REGISTRY_RELPATH,
  checkSubprocessorCatalog,
  readCitationRefs,
  readSubprocessorCatalog,
} from '../lib/subprocessors-loader.mjs';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/subprocessors/${name}/docs`, import.meta.url));
const LOADER = fileURLToPath(new URL('../lib/subprocessors-loader.mjs', import.meta.url));

/** A throwaway docs root holding the given `_meta` files. */
function root(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-subprocessors-'));
  mkdirSync(path.join(dir, '_meta'));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, '_meta', name), text);
  return dir;
}

describe('checkSubprocessorCatalog', () => {
  it('reports an absent file as not present, with nothing else', () => {
    expect(checkSubprocessorCatalog(fixture('absent'), 'x')).toEqual({
      present: false,
      source: 'x',
      records: [],
      normalised: [],
      changes: [],
      problems: [],
    });
  });

  it('reads the valid fixture: 3 records, 4 changes, references resolved (positive control)', () => {
    const result = checkSubprocessorCatalog(fixture('valid'), 'docs/_meta/subprocessors.yaml');
    expect(result.problems).toEqual([]);
    expect(result.present).toBe(true);
    expect(result.records.map((r) => r.id)).toEqual(['acme-hosting', 'beta-mail', 'gamma-analytics']);
    expect(result.changes.map((c) => `${c.date} ${c.kind} ${c.id}`)).toEqual([
      '2027-03-01 added beta-mail',
      '2025-09-30 removed gamma-analytics',
      '2025-01-15 added acme-hosting',
      '2023-01-10 added gamma-analytics',
    ]);
    expect(result.normalised[0].external_references).toEqual([
      { type: 'biblio', id: 'acme-dpa', title: 'Acme Hosting data processing agreement', url: 'https://acme-hosting.example/dpa' },
    ]);
    expect(result.normalised[0].tom_classification).toEqual([
      { measure: 'physical-security', scope: 'system' },
      { measure: 'certification-assurance', scope: 'system', note: 'Yearly ISO/IEC 27001 audit.' },
    ]);
  });

  it('reads an empty list as present with no records', () => {
    const result = checkSubprocessorCatalog(fixture('empty'), 'x');
    expect(result).toMatchObject({ present: true, records: [], changes: [], problems: [] });
  });

  it('reports a dangling biblio reference against the fixture catalog', () => {
    const result = checkSubprocessorCatalog(fixture('dangling-reference'), 'x');
    expect(result.problems).toEqual([
      '[dk-subprocessors] x: subprocessor "acme-hosting": external_references cites biblio "missing-dpa", which is not in the catalog',
    ]);
    expect(result.normalised).toEqual([]);
    expect(result.changes).toEqual([]);
  });

  it('resolves tom_classification against a consumer measures catalog when one exists', () => {
    const dir = root({
      'measures.yaml': '- id: own-measure\n  label: Own\n  nature: technical\n  frameworks: [{ framework: own, ref: "1" }]\n',
      'subprocessors.yaml':
        '- id: a\n  name: A\n  processing: P\n  location: [NL]\n  responsibilities: R\n  since: 2025-01-01\n  tom_classification: [own-measure, physical-security]\n',
    });
    expect(checkSubprocessorCatalog(dir, 'x').problems).toEqual([
      `[dk-measures] x: subprocessor "a": unknown measure id "physical-security" (not in ${path.relative(process.cwd(), path.join(dir, '_meta', 'measures.yaml')).split(path.sep).join('/')})`,
    ]);
  });

  it('defaults the source label to the path from the working directory', () => {
    const { source } = checkSubprocessorCatalog(fixture('valid'));
    expect(source).toBe(
      path.relative(process.cwd(), path.join(fixture('valid'), SUBPROCESSORS_REGISTRY_RELPATH)).split(path.sep).join('/'),
    );
  });
});

describe('readSubprocessorCatalog', () => {
  it('reports a YAML syntax error with its first line', () => {
    const { present, problems } = readSubprocessorCatalog(root({ 'subprocessors.yaml': '- id: [unclosed\n' }), 'x');
    expect(present).toBe(true);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^\[dk-subprocessors\] x: could not parse YAML: \S/);
    expect(problems[0]).not.toContain('\n');
  });

  it('parses a file that opens with the document marker, and ignores a byte order mark', () => {
    const body = '- id: a\n  name: A\n  processing: P\n  location: [NL]\n  responsibilities: R\n  since: 2025-01-01\n';
    expect(readSubprocessorCatalog(root({ 'subprocessors.yaml': `---\n${body}` }), 'x').problems).toEqual([]);
    expect(readSubprocessorCatalog(root({ 'subprocessors.yaml': `\uFEFF${body}` }), 'x').problems).toEqual([]);
  });

  it('rejects a second YAML document rather than dropping it', () => {
    const { problems } = readSubprocessorCatalog(root({ 'subprocessors.yaml': '- id: a\n---\n- id: b\n' }), 'x');
    expect(problems[0]).toMatch(/^\[dk-subprocessors\] x: could not parse YAML: /);
  });

  it('keeps an unquoted date as the same string in any time zone', () => {
    const dir = root({
      'subprocessors.yaml': '- id: a\n  name: A\n  processing: P\n  location: [NL]\n  responsibilities: R\n  since: 2025-01-15\n  until: 2025-12-31\n',
    });
    const script = `import(${JSON.stringify(LOADER)}).then((m) => { const r = m.readSubprocessorCatalog(${JSON.stringify(dir)}, 'x'); process.stdout.write(JSON.stringify([r.records[0].since, r.records[0].until, r.problems])); })`;
    for (const tz of ['America/Los_Angeles', 'Asia/Tokyo', 'UTC']) {
      const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        env: { ...process.env, TZ: tz },
        encoding: 'utf8',
      });
      expect(run.stderr).toBe('');
      expect(JSON.parse(run.stdout)).toEqual(['2025-01-15', '2025-12-31', []]);
    }
  });
});

describe('readCitationRefs', () => {
  it('maps bibliography and tool ids to their titles and URLs', () => {
    const refs = readCitationRefs(fixture('valid'));
    expect([...refs.bibliography.keys()]).toEqual(['acme-dpa']);
    expect(refs.bibliography.get('acme-dpa')).toEqual({
      title: 'Acme Hosting data processing agreement',
      url: 'https://acme-hosting.example/dpa',
    });
    expect(refs.tools.size).toBe(0);
  });

  it('skips malformed records silently, because the citation gate already reports them', () => {
    const refs = readCitationRefs(
      root({
        'bibliography.yaml': '- id: ok\n  title: T\n  url: https://x.example\n- not-a-mapping\n- title: no id\n',
        'tools.yaml': ': not yaml [',
      }),
    );
    expect([...refs.bibliography.keys()]).toEqual(['ok']);
    expect(refs.tools.size).toBe(0);
  });

  it('returns empty maps when neither file exists', () => {
    const refs = readCitationRefs(fixture('absent'));
    expect(refs.bibliography.size).toBe(0);
    expect(refs.tools.size).toBe(0);
  });
});
