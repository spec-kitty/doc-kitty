/**
 * The build-free catalog gate checks a root's sub-processor catalog (ADR-0086,
 * FR-008) through the shared loader, adding and losing nothing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateRoot } from '../scripts/validate-catalog.mjs';
import { checkSubprocessorCatalog } from '../lib/subprocessors-loader.mjs';
import { clearMeasuresCatalogCache } from '../lib/measures-loader.mjs';

const root = (name: string) =>
  path.relative(process.cwd(), fileURLToPath(new URL(`./fixtures/subprocessors-gate/${name}/docs`, import.meta.url)));
const script = fileURLToPath(new URL('../scripts/validate-catalog.mjs', import.meta.url));
const label = (name: string) => path.join(root(name), '_meta', 'subprocessors.yaml').split(path.sep).join('/');

function check(dir: string) {
  const problems: string[] = [];
  const counts = validateRoot(dir, problems);
  return { problems, counts };
}

beforeEach(() => clearMeasuresCatalogCache());

describe('validate-catalog: sub-processor catalog', () => {
  it('passes a valid catalog and counts its records', () => {
    const { problems, counts } = check(root('ok'));
    expect(problems).toEqual([]);
    expect(counts.subprocessors).toBe(2);
  });

  it('reports a root without a catalog as 0 records and no problems (pair of the valid case)', () => {
    const { problems, counts } = check(root('none'));
    expect(problems).toEqual([]);
    expect(counts.subprocessors).toBe(0);
  });

  it('reports every problem of a bad catalog, in file order, with the shared wording', () => {
    const { problems } = check(root('bad'));
    expect(problems).toEqual([
      `[dk-subprocessors] ${label('bad')}: subprocessor "acme-hosting": "location" has "nl"; write country codes in upper case ("NL")`,
      `[dk-subprocessors] ${label('bad')}: subprocessor "acme-hosting": duplicate id "acme-hosting"`,
    ]);
  });

  it('adds nothing to and loses nothing from the shared loader (gate half of NFR-002)', () => {
    const { problems } = check(root('bad'));
    const direct = checkSubprocessorCatalog(path.resolve(root('bad')), label('bad')).problems;
    expect(direct).toHaveLength(2);
    expect(problems).toEqual(direct);
  });

  it('the CLI exits 1 on a bad catalog and names the problem', () => {
    const res = spawnSync('node', [script, root('bad')], { encoding: 'utf8' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('duplicate id "acme-hosting"');
  });

  it('the CLI exits 0 on a valid catalog and reports the record count', () => {
    const res = spawnSync('node', [script, root('ok')], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('2 sub-processor record(s)');
  });

  it('validates a 200-record catalog in under 2 seconds (NFR-003)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-subprocessors-gate-'));
    mkdirSync(path.join(dir, '_meta'));
    const records = Array.from({ length: 200 }, (_, i) =>
      [
        `- id: provider-${String(i).padStart(3, '0')}`,
        `  name: Provider ${i}`,
        '  processing: Hosting of an example workload.',
        `  location: [${['NL', 'DE', 'IE', 'US', 'FR'][i % 5]}]`,
        '  responsibilities: The provider operates the service; we configure it.',
        `  since: 20${10 + (i % 15)}-0${1 + (i % 9)}-1${i % 9}`,
        ...(i % 3 === 0 ? [`  until: 2026-0${1 + (i % 9)}-2${i % 9}`] : []),
      ].join('\n'),
    );
    writeFileSync(path.join(dir, '_meta', 'subprocessors.yaml'), `${records.join('\n')}\n`);
    const started = performance.now();
    const { problems, counts } = check(dir);
    const elapsed = performance.now() - started;
    expect(problems).toEqual([]);
    expect(counts.subprocessors).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });
});
