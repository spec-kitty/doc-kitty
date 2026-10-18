/**
 * #178 -- the OKF v0.2 export core and the in-repo conformance checker
 * (FR-015..FR-017, FR-019, FR-025, FR-026, C-003, C-010, SC-002, SC-003).
 * Pure and in-memory: fixtures under `fixtures/okf-export/` are read here, the
 * core never touches the file system.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it, expect } from 'vitest';
import { okfExportIntegration } from '../lib/okf-export/integration.js';
import { bundlePathOf, exportOkfBundle } from '../lib/okf-export/core.mjs';
import { checkOkfBundle } from '../lib/okf-export/conformance.mjs';

const FIX = path.join(import.meta.dirname, 'fixtures', 'okf-export');
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
const text = (p: string): string => bundle.get(p) as string;
const frontmatter = (p: string): string => /^---\n([\s\S]*?)\n---\n/.exec(text(p))?.[1] ?? '';

describe('exportOkfBundle: layout and exclusions', () => {
  it('writes sorted bundle paths, indexes as index.md, and no draft or non-graph source', () => {
    const keys = [...bundle.keys()];
    expect(keys).toEqual([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    expect(keys).toEqual([
      'context/audience/maintainer.md',
      'guides/_index.meta.yaml',
      'guides/bare.md',
      'guides/deploy.md',
      'guides/index.md',
      'guides/setup.md',
      'guides/stamped.md',
      'index.md',
      'log.md',
    ]);
    expect(bundle.has('drafts/secret.md')).toBe(false);
  });

  it('is byte-identical across two runs', () => {
    expect([...run()]).toEqual([...bundle]);
  });

  it('copies log.md verbatim and gives it no type', () => {
    expect(text('log.md')).toBe(sources.get('log.md'));
  });
});

describe('indexes', () => {
  it('root index frontmatter is exactly okf_version "0.2" and the body is an entry list', () => {
    expect(frontmatter('index.md')).toBe('okf_version: "0.2"');
    expect(text('index.md')).toContain('- [Guides](/guides/index.md) - How-to guides.');
  });

  it('non-root index has no frontmatter and lists its children with descriptions', () => {
    expect(text('guides/index.md').startsWith('# Guides\n')).toBe(true);
    expect(text('guides/index.md')).toContain('- [Deploy](/guides/deploy.md) - Ship it.');
    expect(text('guides/index.md')).toContain('- [Setup](/guides/setup.md) - Set it up.');
  });

  it('preserves original index frontmatter in a sorted sidecar', () => {
    expect(text('guides/_index.meta.yaml')).toBe(
      'alpha:\n  - "b"\n  - "a"\ntitle: "Guides"\ntype: "Guide"\nupdated: "2026-10-01T00:00:00Z"\nzeta: 1\n',
    );
  });
});

describe('concept frontmatter (FR-025)', () => {
  it('(a) keeps an existing generated.by and at, keeps all authors, and keeps content_hash', () => {
    const fm = frontmatter('guides/stamped.md');
    expect(fm).toContain('generated:\n  by: "doc-kitty-gherkin/0.3.0"\n  at: "2026-10-02T09:30:00Z"\n  content_hash: "sha256:0123456789ab"');
    expect(fm).toContain('authors:\n  - "human:amy"');
  });

  it('(b) with no stamp, the first author becomes generated.by and leaves authors; at is updated', () => {
    const fm = frontmatter('guides/setup.md');
    expect(fm).toContain('generated:\n  by: "human:jane"\n  at: "2026-10-17T00:00:00Z"');
    expect(fm).toContain('authors:\n  - "human:joe"');
    expect(fm).not.toContain('"human:jane"\nauthors');
  });

  it('(c) with no stamp and no author, generated.by is the export process', () => {
    expect(frontmatter('guides/bare.md')).toContain('by: "process:dockitty-export"');
  });

  it('rewrites an email author to human:<local-part> and maps status', () => {
    const fm = frontmatter('guides/deploy.md');
    expect(fm).toContain('by: "human:stijn"');
    expect(fm).toContain('status: "stable"');
    expect(fm).toMatch(/^type: "Guide"/);
  });

  it('writes verified as a list, stale_after, tags and sources', () => {
    const fm = frontmatter('guides/setup.md');
    expect(fm).toContain('verified:\n  - by: "human:jane"\n    at: "2026-10-01T10:00:00Z"');
    expect(fm).toContain('stale_after: "2027-01-01T00:00:00Z"');
    expect(fm).toContain('tags:\n  - "setup"');
    expect(fm).toContain('resource: "features/x.feature"');
    expect(fm).toContain('id: "tool-t2"'); // the catalog entry with no URL stays in sources
  });
});

describe('relation sections', () => {
  const setup = text('guides/setup.md');

  it('renders labelled sections with /-prefixed links, in a fixed order', () => {
    const headings = [...setup.matchAll(/^## .+$/gm)].map((m) => m[0]);
    expect(headings).toEqual(['## Related', '## Audience', '## References', '## Derived from']);
    expect(setup).toContain('- [Deploy](/guides/deploy.md)');
    expect(setup).toContain('- [Guides](/guides/index.md)');
    expect(setup).toContain('- [Maintainer](/context/audience/maintainer.md) - Read this first.');
  });

  it('links citations to their external URL and omits a citation with no URL', () => {
    expect(setup).toContain('- [A Book](https://books.example/b1)');
    expect(setup).toContain('- [Inline A](https://x.example/a)');
    expect(setup.split('\n---\n')[1]).not.toContain('A Tool'); // body only: the entry stays in sources
    expect(setup).toContain('- Gherkin source (`features/x.feature`)');
  });

  it('does not render in-section and writes no heading for a page with no relations', () => {
    expect(text('guides/deploy.md')).not.toMatch(/^## /m);
    expect(setup).not.toMatch(/in-section/i);
    expect(text('guides/deploy.md').endsWith('Deploy it.\n')).toBe(true);
  });

  it('SC-003: rendered page-to-page body links equal the graph page edges, both ways', () => {
    const idOfPath = new Map(
      graph.nodes
        .filter((n: { kind: string }) => n.kind === 'page' || n.kind === 'persona')
        .map((n: { id: string }) => [bundlePathOf(n.id), n.id]),
    );
    const fromBodies = new Set<string>();
    for (const [file, body] of bundle) {
      const source = [...idOfPath].find(([p]) => p === file)?.[1];
      if (!source || file.endsWith('index.md')) continue;
      const rels = ['Related', 'Audience', 'Derived from'];
      for (const section of body.split(/^## /m).slice(1)) {
        const rel = { Related: 'related', Audience: 'audience', 'Derived from': 'derived-from' }[section.split('\n')[0]];
        if (!rels.includes(section.split('\n')[0])) continue;
        for (const m of section.matchAll(/\]\(\/([^)]+\.md)\)/g)) fromBodies.add(`${source}|${rel}|${idOfPath.get(m[1])}`);
      }
    }
    const fromGraph = new Set<string>(
      graph.edges
        .filter((e: { rel: string; target: string }) => ['related', 'audience', 'derived-from'].includes(e.rel) && [...idOfPath.values()].includes(e.target))
        .map((e: { source: string; rel: string; target: string }) => `${e.source}|${e.rel}|${e.target}`),
    );
    expect(fromGraph.size).toBeGreaterThan(0);
    expect([...fromGraph].filter((e) => !fromBodies.has(e))).toEqual([]); // 0 missing
    expect([...fromBodies].filter((e) => !fromGraph.has(e))).toEqual([]); // 0 extra
  });
});

describe('checkOkfBundle (FR-026)', () => {
  const bad = (name: string) => readFileSync(path.join(FIX, 'bad', name), 'utf8');

  it('the exported bundle is conformant: []', () => {
    expect(checkOkfBundle(bundle)).toEqual([]);
  });

  it('rule 1: a concept with no type yields exactly one rule-1 violation', () => {
    const broken = new Map(bundle).set('guides/notype.md', bad('missing-type.md'));
    expect(checkOkfBundle(broken)).toEqual([expect.objectContaining({ path: 'guides/notype.md', rule: 1 })]);
  });

  it('rule 2: a non-root index.md with frontmatter is flagged', () => {
    const broken = new Map(bundle).set('guides/index.md', bad('nonroot-index.md'));
    expect(checkOkfBundle(broken)).toEqual([expect.objectContaining({ path: 'guides/index.md', rule: 2 })]);
  });

  it('rule 3: a root index.md with an extra frontmatter key is flagged', () => {
    const broken = new Map(bundle).set('index.md', bad('root-extra-key.md'));
    expect(checkOkfBundle(broken)).toEqual([expect.objectContaining({ path: 'index.md', rule: 3 })]);
  });

  it('rule 4: a prose line in an index body is flagged; reserved log.md needs no type', () => {
    const broken = new Map(bundle).set('guides/index.md', '# Guides\n\nsome prose\n');
    expect(checkOkfBundle(broken)).toEqual([expect.objectContaining({ path: 'guides/index.md', rule: 4 })]);
    expect(checkOkfBundle(new Map([['log.md', 'no frontmatter']]))).toEqual([]);
  });

  it('reads a directory too', () => {
    expect(checkOkfBundle(path.join(FIX, 'bad')).map((v: { path: string }) => v.path)).toEqual([
      'missing-type.md',
      'nonroot-index.md',
      'root-extra-key.md',
    ]);
  });
});

describe('okfExportIntegration build hook', () => {
  it('explains a missing content graph instead of a raw ENOENT', () => {
    const dist = mkdtempSync(path.join(tmpdir(), 'okf-dist-'));
    try {
      const hook = okfExportIntegration(path.join(FIX, 'docs'), undefined).hooks['astro:build:done'] as (a: unknown) => void;
      const call = () => hook({ dir: pathToFileURL(`${dist}/`), logger: { info() {} } });
      expect(call).toThrow(/content graph.*not found/i);
      expect(call).toThrow(path.join(dist, 'api', 'content-graph.json'));
      expect(call).toThrow(/\/api\/content-graph\.json/);
      expect(call).not.toThrow(/ENOENT/);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });
});

describe('dockitty-export-okf CLI base hint', () => {
  it('suggests --base when unresolved links share a leading segment, and is quiet once it is given', () => {
    const bin = path.join(import.meta.dirname, '..', 'scripts', 'export-okf.mjs');
    const dir = mkdtempSync(path.join(tmpdir(), 'okf-base-'));
    try {
      mkdirSync(path.join(dir, 'docs'));
      writeFileSync(path.join(dir, 'docs', 'README.md'), '---\ntitle: Home\n---\nSee [setup](/docs/setup/).\n');
      writeFileSync(path.join(dir, 'docs', 'setup.md'), '---\ntitle: Setup\n---\nBack [home](/docs/).\n');
      const page = (id: string, href: string) => ({ id, kind: 'page', type: 'Context', title: id, href });
      const graph = { schema: 'dockitty.content-graph/1', okf_version: '0.2', nodes: [page('README', '/'), page('setup', '/setup/')], edges: [] };
      writeFileSync(path.join(dir, 'graph.json'), JSON.stringify(graph));
      const args = ['--graph', path.join(dir, 'graph.json'), '--docs', path.join(dir, 'docs'), '--index-basename', 'README', '--out', path.join(dir, 'out')];
      const bare = spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
      expect(bare.status, bare.stderr).toBe(0);
      expect(bare.stderr).toContain('pass --base /docs');
      const based = spawnSync(process.execPath, [bin, ...args, '--base', '/docs'], { encoding: 'utf8' });
      expect(based.status, based.stderr).toBe(0);
      expect(based.stderr).not.toContain('hint:');
      expect(based.stderr).not.toContain('not in the bundle');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('dockitty-export-okf CLI', () => {
  it('exports to a conformant bundle (0), --check flags a violation (1), no graph is a usage error (2)', () => {
    const bin = path.join(import.meta.dirname, '..', 'scripts', 'export-okf.mjs');
    const out = mkdtempSync(path.join(tmpdir(), 'okf-cli-'));
    const run = (...args: string[]) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
    try {
      const exported = run('--graph', path.join(FIX, 'graph.json'), '--docs', path.join(FIX, 'docs'), '--index-basename', 'README', '--out', out);
      expect(exported.status, exported.stderr).toBe(0);
      expect(readFileSync(path.join(out, 'index.md'), 'utf8')).toContain('okf_version: "0.2"');
      expect(run('--check', '--out', out).status).toBe(0);
      expect(run('--check', '--out', path.join(FIX, 'bad')).status).toBe(1);
      expect(run('--graph', path.join(out, 'missing.json'), '--out', out).status).toBe(2);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
