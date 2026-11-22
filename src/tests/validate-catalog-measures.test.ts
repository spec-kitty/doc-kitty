import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateRoot } from '../scripts/validate-catalog.mjs';
import { clearMeasuresCatalogCache } from '../lib/measures-loader.mjs';

// The build-free gate resolves tom_classification with the same core as the build
// (ADR-0080, FR-006, NFR-002): same verdicts, same wording.
const root = (name: string) =>
  path.relative(process.cwd(), fileURLToPath(new URL(`./fixtures/catalog-measures/${name}/docs`, import.meta.url)));
const script = fileURLToPath(new URL('../scripts/validate-catalog.mjs', import.meta.url));

function check(name: string) {
  const problems: string[] = [];
  const counts = validateRoot(root(name), problems);
  return { problems, counts };
}

beforeEach(() => clearMeasuresCatalogCache());

describe('validate-catalog: TOM classification', () => {
  it('resolves ids against the shipped default when the root has no catalog', () => {
    const { problems, counts } = check('default-ok');
    expect(problems).toEqual([]);
    expect(counts.measures).toBe(1);
  });

  it('names the page and the unknown id', () => {
    const { problems } = check('unknown-id');
    expect(problems).toEqual([
      `[dk-measures] ${path.join(root('unknown-id'), 'README.md')}: unknown measure id "transmision-protection" (not in the shipped default catalog)`,
    ]);
  });

  it('a consumer catalog replaces the default wholesale', () => {
    const { problems } = check('consumer');
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('unknown measure id "transmission-protection"');
    expect(problems[0]).toContain(path.join(root('consumer'), '_meta', 'measures.yaml'));
    expect(problems.join('\n')).not.toContain('a-5-15-access-control');
  });

  it('always checks a consumer catalog, even when no page uses it', () => {
    const { problems, counts } = check('bad-catalog');
    expect(counts.measures).toBe(0);
    expect(problems).toEqual([expect.stringMatching(/bad-catalog\/docs\/_meta\/measures\.yaml: dup: duplicate id$/)]);
  });

  it('the CLI exits 1 and prints the page and the id', () => {
    const res = spawnSync('node', [script, root('unknown-id')], { encoding: 'utf8' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('unknown-id/docs/README.md');
    expect(res.stderr).toContain('"transmision-protection"');
  });
});
