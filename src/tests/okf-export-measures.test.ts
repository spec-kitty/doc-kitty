import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { exportOkfBundle } from '../lib/okf-export/core.mjs';
import { checkOkfBundle } from '../lib/okf-export/conformance.mjs';

// The `## Measures` relation section, read from `classified-as` edges (ADR-0080, FR-009).
const FIX = path.join(import.meta.dirname, 'fixtures', 'okf-export-measures');
const graph = JSON.parse(readFileSync(path.join(FIX, 'graph.json'), 'utf8'));

function readTree(root: string, rel = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const next = path.posix.join(rel, e.name);
    if (e.isDirectory()) readTree(root, next).forEach((v, k) => out.set(k, v));
    else out.set(next, readFileSync(path.join(root, next), 'utf8'));
  }
  return out;
}

const sources = readTree(path.join(FIX, 'docs'));
const run = () => exportOkfBundle(graph, sources) as Map<string, string>;
const bundle = run();

describe('OKF export: Measures section', () => {
  it('lists each measure, linked to its DPV concept, with scope and note', () => {
    expect(bundle.get('security/audit-log.md')).toContain(
      [
        '## Measures',
        '',
        '- [Accountability](https://w3id.org/dpv#ComplianceMonitoring) (organisation)',
        '- Custom measure',
        '- [Events logging](https://w3id.org/dpv#ActivityMonitoring) - Every admin action is logged.',
        '',
      ].join('\n'),
    );
  });

  it('places the section after References', () => {
    const doc = bundle.get('security/audit-log.md') as string;
    expect(doc.indexOf('## References')).toBeGreaterThan(-1);
    expect(doc.indexOf('## Measures')).toBeGreaterThan(doc.indexOf('## References'));
  });

  it('adds no section to a page without classified-as edges', () => {
    expect(bundle.get('security/plain.md')).not.toContain('## Measures');
  });

  it('does not list an unlinked measure as a source', () => {
    expect(bundle.get('security/audit-log.md')).not.toMatch(/resource: catalog:measure/);
  });

  it('passes conformance and is byte-identical across runs', () => {
    expect(checkOkfBundle(bundle)).toEqual([]);
    expect([...run()]).toEqual([...bundle]);
  });
});
