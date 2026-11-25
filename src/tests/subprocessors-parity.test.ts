/**
 * Build versus gate (NFR-002, ADR-0086 decision 4): for the same catalog, the
 * error the build throws at `astro:config:setup` and the problems the build-free
 * `validate-catalog.mjs` gate reports are the same lines. Only the catalog's name
 * may differ (the build names it from the site root, the gate from where it runs),
 * so it is masked before comparing.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { subprocessorsIntegration } from '../lib/integrations/subprocessors.js';
import { validateRoot } from '../scripts/validate-catalog.mjs';
import { clearMeasuresCatalogCache } from '../lib/measures-loader.mjs';

const RECORD = (over = '') => `- id: acme-hosting
  name: Acme Hosting B.V.
  processing: Hosting.
  location: [NL]
  responsibilities: Acme operates the infrastructure.
  since: 2025-01-15
${over}`;

const BIBLIOGRAPHY = '- id: acme-dpa\n  title: Acme DPA\n  url: https://acme.example/dpa\n';

/** Each catalog breaks one rule; together they cover every class of check. */
const INVALID: Record<string, string> = {
  'not a list': 'id: acme-hosting\n',
  'not a mapping': '- just a string\n',
  'missing field': RECORD().replace('  processing: Hosting.\n', ''),
  'unknown field': RECORD('  untill: 2026-01-01\n'),
  'duplicate id': RECORD() + RECORD(),
  'bad date': RECORD().replace('2025-01-15', '2025-02-30'),
  'until before since': RECORD('  until: 2024-12-31\n'),
  'lower-case code': RECORD().replace('[NL]', '[nl]'),
  'unassigned code': RECORD().replace('[NL]', '[UK, EU]'),
  'dangling biblio': RECORD('  external_references:\n    - { type: biblio, id: nope }\n'),
  'unknown measure': RECORD('  tom_classification: [no-such-measure]\n'),
  'yaml syntax': '- id: [unclosed\n',
};

const LABEL = '<catalog>';

function site(catalog: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-subprocessors-parity-'));
  mkdirSync(path.join(dir, 'docs', '_meta'), { recursive: true });
  writeFileSync(path.join(dir, 'docs', '_meta', 'subprocessors.yaml'), catalog);
  writeFileSync(path.join(dir, 'docs', '_meta', 'bibliography.yaml'), BIBLIOGRAPHY);
  writeFileSync(path.join(dir, 'docs', 'README.md'), '# Home\n');
  return dir;
}

/** The problem lines of the build's error, catalog name masked; `[]` when it does not throw. */
function buildProblems(dir: string): string[] {
  const hook = subprocessorsIntegration('docs', 'Site').hooks['astro:config:setup'] as unknown as (c: object) => void;
  try {
    hook({
      config: { root: pathToFileURL(`${dir}${path.sep}`), srcDir: pathToFileURL(`${path.join(dir, 'src')}${path.sep}`) },
      injectRoute: vi.fn(),
      updateConfig: vi.fn(),
      addWatchFile: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn() },
    });
    return [];
  } catch (err) {
    const [header, ...lines] = (err as Error).message.split('\n');
    expect(header).toBe('[dk-subprocessors] invalid sub-processor catalog:');
    return lines.map((line) => line.replaceAll('docs/_meta/subprocessors.yaml', LABEL));
  }
}

/** The gate's problems for the same docs root, catalog name masked. */
function gateProblems(dir: string): string[] {
  const root = path.relative(process.cwd(), path.join(dir, 'docs'));
  const label = path.join(root, '_meta', 'subprocessors.yaml').split(path.sep).join('/');
  const problems: string[] = [];
  validateRoot(root, problems);
  return problems.map((line) => line.replaceAll(label, LABEL));
}

beforeEach(() => clearMeasuresCatalogCache());

describe('the build and the gate agree (NFR-002)', () => {
  it('covers at least 8 invalid catalogs', () => {
    expect(Object.keys(INVALID).length).toBeGreaterThanOrEqual(8);
  });

  it.each(Object.entries(INVALID))('%s: the same problem lines', (_name, catalog) => {
    const dir = site(catalog);
    const build = buildProblems(dir);
    expect(build.length).toBeGreaterThan(0);
    expect(gateProblems(dir)).toEqual(build);
  });

  it('a valid catalog: both report nothing (positive control)', () => {
    const dir = site(RECORD('  external_references:\n    - { type: biblio, id: acme-dpa }\n'));
    expect(buildProblems(dir)).toEqual([]);
    expect(gateProblems(dir)).toEqual([]);
  });
});
