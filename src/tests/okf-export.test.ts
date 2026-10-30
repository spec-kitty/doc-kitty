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
import { bundlePathOf, exportOkfBundle, generatedFor } from '../lib/okf-export/core.mjs';
import { checkOkfBundle } from '../lib/okf-export/conformance.mjs';
import { feedDateMillis } from '../lib/metadata.js';

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
      'README.md',
      'context/audience/maintainer.md',
      'guides/README.md',
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
    expect(text('index.md')).toContain('\n- [Home](/README.md) - The bundle root.\n- [Guides](/guides/index.md)'); // #238: the README body is listed first
    expect(text('README.md')).toContain('\nWelcome.\n');
  });

  it('non-root index has no frontmatter and lists its children with descriptions', () => {
    expect(text('guides/index.md').startsWith('# Guides\n')).toBe(true);
    expect(text('guides/index.md')).toContain('# Guides\n\n- [Guides](/guides/README.md) - How-to guides.\n'); // #238
    expect(text('guides/README.md')).toContain('\nOriginal index prose.\n');
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

  it('last-changed precedence (#226): RSS and the OKF export on the same three inputs', () => {
    const GHERKIN = 'doc-kitty-gherkin/0.4.0';
    const stamp = { by: GHERKIN, at: '2026-10-02T09:30:00Z' };
    const A = { generated: stamp };
    const B = {
      generated: { by: 'doc-kitty-scaffold/0.4.0', at: '2026-10-01T00:00:00Z' },
      updated: '2026-10-05T00:00:00Z',
      authors: ['human:jane', 'human:joe'],
    };
    const C = { generated: stamp, updated: '2026-10-05T00:00:00Z' };
    const D = {
      generated: { by: 'other-tool/1.0', at: '2026-10-01T00:00:00Z', content_hash: 'sha256:0123456789ab' },
      authors: ['human:jane'],
    };
    const ms = (iso: string) => Date.parse(iso);

    // RSS: updated, else generated.at.
    expect(feedDateMillis(A as never)).toBe(ms('2026-10-02T09:30:00Z'));
    expect(feedDateMillis(B as never)).toBe(ms('2026-10-05T00:00:00Z'));
    expect(feedDateMillis(C as never)).toBe(ms('2026-10-05T00:00:00Z'));
    expect(feedDateMillis(D as never)).toBe(ms('2026-10-01T00:00:00Z'));

    // OKF: only an ownership stamp counts; anything else is ignored.
    expect(generatedFor(A).generated).toEqual({ by: GHERKIN, at: '2026-10-02T09:30:00Z' });
    const b = generatedFor(B);
    expect(b.generated).toEqual({ by: 'human:jane', at: '2026-10-05T00:00:00Z' });
    expect(b.authors).toEqual(['human:joe']);
    expect(generatedFor(C).generated).toEqual({ by: GHERKIN, at: '2026-10-02T09:30:00Z' });
    expect(generatedFor(D).generated).toEqual({ by: 'human:jane', at: '2026-10-01T00:00:00Z' });
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
      let message = '';
      try {
        hook({ dir: pathToFileURL(`${dist}/`), logger: { info() {} } });
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toMatch(/content graph.*not found/i);
      expect(message).toContain(path.join(dist, 'api', 'content-graph.json'));
      expect(message).toMatch(/\/api\/content-graph\.json/);
      expect(message).not.toMatch(/ENOENT/);
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
      writeFileSync(path.join(dir, 'docs', 'README.md'), '---\ntitle: Home\n---\nWelcome home.\n');
      writeFileSync(path.join(dir, 'docs', 'setup.md'), '---\ntitle: Setup\n---\nBack [home](/docs/) or [top](/docs/#top).\n');
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
      // One stray link is not evidence of a base: no hint.
      writeFileSync(path.join(dir, 'docs', 'setup.md'), '---\ntitle: Setup\n---\nBack [home](/docs/).\n');
      const single = spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
      expect(single.stderr, single.stderr).toContain('not in the bundle');
      expect(single.stderr).not.toContain('hint:');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('dockitty-export-okf CLI README body links (#238)', () => {
  it('exports a README body link and reports it when the target is not in the bundle', () => {
    const bin = path.join(import.meta.dirname, '..', 'scripts', 'export-okf.mjs');
    const dir = mkdtempSync(path.join(tmpdir(), 'okf-readme-'));
    try {
      mkdirSync(path.join(dir, 'docs'));
      writeFileSync(path.join(dir, 'docs', 'README.md'), '---\ntitle: Home\n---\nSee [the missing page](./ghost-page.md).\n');
      const graph = { schema: 'dockitty.content-graph/1', okf_version: '0.2', nodes: [{ id: 'README', kind: 'page', type: 'Context', title: 'Home', href: '/' }], edges: [] };
      writeFileSync(path.join(dir, 'graph.json'), JSON.stringify(graph));
      const args = ['--graph', path.join(dir, 'graph.json'), '--docs', path.join(dir, 'docs'), '--index-basename', 'README', '--out', path.join(dir, 'out')];
      const res = spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
      expect(res.status, res.stderr).toBe(0);
      expect(readFileSync(path.join(dir, 'out', 'README.md'), 'utf8')).toContain('ghost-page');
      expect(res.stderr).toContain('not in the bundle');
      expect(res.stderr).toContain('ghost-page');
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

describe('dockitty-export-okf CLI site URL (#237)', () => {
  it('composes the origin passed as --site-url with --base once', () => {
    const bin = path.join(import.meta.dirname, '..', 'scripts', 'export-okf.mjs');
    const dir = mkdtempSync(path.join(tmpdir(), 'okf-site-'));
    try {
      mkdirSync(path.join(dir, 'docs'));
      writeFileSync(path.join(dir, 'docs', 'README.md'), '---\ntitle: Home\n---\nHi.\n');
      writeFileSync(path.join(dir, 'docs', 'page.md'), '---\ntitle: P\n---\nSee [data](/docs/api/x.json).\n');
      const page = (id: string, href: string) => ({ id, kind: 'page', type: 'Context', title: id, href });
      const nodes = [page('README', '/docs/'), page('page', '/docs/page/')];
      writeFileSync(path.join(dir, 'graph.json'), JSON.stringify({ schema: 'dockitty.content-graph/1', okf_version: '0.2', nodes, edges: [] }));
      const args = ['--graph', path.join(dir, 'graph.json'), '--docs', path.join(dir, 'docs'), '--index-basename', 'README', '--out', path.join(dir, 'out'), '--base', '/docs'];
      for (const site of ['https://s.example', 'https://s.example/docs/']) {
        const run1 = spawnSync(process.execPath, [bin, ...args, '--site-url', site], { encoding: 'utf8' });
        expect(run1.status, run1.stderr).toBe(0);
        expect(readFileSync(path.join(dir, 'out', 'page.md'), 'utf8')).toContain('[data](https://s.example/docs/api/x.json)');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('section README bodies become overview pages (#238)', () => {
  const page = (id: string, extra: Record<string, unknown> = {}) => ({ id, kind: 'page', title: id, ...extra });
  const inSection = (source: string, target: string) => ({ id: `${source}|in-section|${target}`, source, target, rel: 'in-section' });
  const src = (body: string) => `---\ntitle: t\nzeta: 1\n---\n${body}`;
  const BODY = 'Read [add](./add-a-session-note.md) and [other](../other/README.md).\n';
  const guidesGraph = {
    nodes: [
      page('README', { title: 'Home', description: 'The root.' }),
      page('guides/README', { title: 'Guides', description: 'About guides.' }),
      page('guides/Aaa', { title: 'Aaa', description: 'First child.' }),
      page('guides/add-a-session-note', { title: 'Add', description: 'Adds.' }),
      page('other/README', { title: 'Other' }),
    ],
    edges: [inSection('guides/README', 'README'), inSection('guides/Aaa', 'guides/README'), inSection('guides/add-a-session-note', 'guides/README'), inSection('other/README', 'README')],
  };
  const guidesSources = new Map([
    ['README.md', src('Home body.\n')],
    ['guides/README.md', src(BODY)],
    ['guides/Aaa.md', src('a\n')],
    ['guides/add-a-session-note.md', src('b\n')],
    ['other/README.md', src('')],
  ]);
  const exportIt = (g: unknown, s: Map<string, string>, options: Record<string, unknown> = {}) => exportOkfBundle(g as never, s, options as never) as Map<string, string>;

  it('writes guides/README.md with concept frontmatter and the rewritten body, byte for byte', () => {
    const files = exportIt(guidesGraph, guidesSources);
    expect(files.get('guides/README.md')).toBe(
      '---\ntype: "Concept"\ntitle: "Guides"\ndescription: "About guides."\ngenerated:\n  by: "process:dockitty-export"\n---\n\n' +
        'Read [add](/guides/add-a-session-note.md) and [other](/other/index.md).\n',
    );
  });

  it('lists the overview first in guides/index.md as a strict entry, then the children; the sidecar is unchanged', () => {
    const files = exportIt(guidesGraph, guidesSources);
    expect(files.get('guides/index.md')).toBe(
      '# Guides\n\n- [Guides](/guides/README.md) - About guides.\n- [Aaa](/guides/Aaa.md) - First child.\n- [Add](/guides/add-a-session-note.md) - Adds.\n',
    );
    expect(files.get('guides/_index.meta.yaml')).toBe('title: "t"\nzeta: 1\n');
  });

  it('a root README body gives README.md, lists it first, and keeps okf_version the only frontmatter', () => {
    const files = exportIt(guidesGraph, guidesSources);
    expect(files.get('README.md')).toContain('\nHome body.\n');
    const root = files.get('index.md') as string;
    expect(root.startsWith('---\nokf_version: "0.2"\n---\n\n# Home\n\n- [Home](/README.md) - The root.\n')).toBe(true);
  });

  it('a persona README gets the same treatment', () => {
    const g = { nodes: [page('README'), { id: 'context/audience/README', kind: 'persona', title: 'Audiences' }], edges: [inSection('context/audience/README', 'README')] };
    const files = exportIt(g, new Map([['context/audience/README.md', src('Who reads this.\n')]]));
    expect(files.get('context/audience/README.md')).toContain('\nWho reads this.\n');
    expect(files.get('context/audience/index.md')).toBe('# Audiences\n\n- [Audiences](/context/audience/README.md)\n');
  });

  it('honours a configured indexBasename: the sibling is <dir>/_index.md', () => {
    const g = { nodes: [page('README'), page('guides/_index', { title: 'Guides' })], edges: [inSection('guides/_index', 'README')] };
    const files = exportIt(g, new Map([['guides/_index.md', src('Body.\n')]]), { indexBasename: '_index' });
    expect(files.get('guides/_index.md')).toContain('\nBody.\n');
    expect(files.get('guides/index.md')).toBe('# Guides\n\n- [Guides](/guides/_index.md)\n');
  });

  it.each([
    ['frontmatter only', '---\ntitle: t\n---\n'],
    ['whitespace only', '---\ntitle: t\n---\n  \n\n'],
    ['no frontmatter, empty', ''],
    ['MDX imports only', "---\ntitle: t\n---\nimport Card from '../Card.astro';\nexport const meta = { a: 1 };\n"],
    ['HTML comments only', '---\ntitle: t\n---\n<!-- note -->\n<!--\n multi\n line\n-->\n'],
  ])('a body-less README (%s) writes no sibling and the index is unchanged', (_n, source) => {
    const g = { nodes: [page('README'), page('guides/README', { title: 'Guides' }), page('guides/a', { title: 'A' })], edges: [inSection('guides/README', 'README'), inSection('guides/a', 'guides/README')] };
    const files = exportIt(g, new Map([['guides/README.md', source]]));
    expect(files.has('guides/README.md')).toBe(false);
    expect(files.get('guides/index.md')).toBe('# Guides\n\n- [A](/guides/a.md)\n');
  });

  it('a README with a comment plus prose still gets a sibling', () => {
    const g = { nodes: [page('README'), page('guides/README', { title: 'Guides' })], edges: [inSection('guides/README', 'README')] };
    const files = exportIt(g, new Map([['guides/README.md', src('<!-- todo -->\nReal prose.\n')]]));
    expect(files.get('guides/README.md')).toContain('Real prose.');
    expect(files.get('guides/index.md')).toBe('# Guides\n\n- [Guides](/guides/README.md)\n');
  });

  it('collision guard: with the default basename `index` no sibling is written over the index', () => {
    const g = { nodes: [page('index', { title: 'Home' }), page('guides/index', { title: 'Guides' }), page('guides/a', { title: 'A' })], edges: [inSection('guides/index', 'index'), inSection('guides/a', 'guides/index')] };
    const files = exportIt(g, new Map([['guides/index.md', src('Body.\n')]]), { indexBasename: 'index' });
    expect(files.get('guides/index.md')).toBe('# Guides\n\n- [A](/guides/a.md)\n');
    expect([...files.keys()].sort()).toEqual(['guides/_index.meta.yaml', 'guides/a.md', 'guides/index.md', 'index.md']);
  });

  it('puts the relation sections on the overview page, with no self-link', () => {
    const g = {
      nodes: [page('README'), page('guides/README', { title: 'Guides' }), page('guides/a', { title: 'A' })],
      edges: [inSection('guides/README', 'README'), { id: 'r', source: 'guides/README', target: 'guides/a', rel: 'related' }],
    };
    const doc = exportIt(g, new Map([['guides/README.md', src('Body.\n')]])).get('guides/README.md') as string;
    expect(doc).toContain('\nBody.\n\n## Related\n\n- [A](/guides/a.md)\n');
    expect(doc).not.toContain('](/guides/README.md)');
  });

  it('the overview bundle is conformant (checkOkfBundle returns [])', () => {
    const files = exportIt(guidesGraph, guidesSources);
    expect(files.has('guides/README.md')).toBe(true);
    expect(checkOkfBundle(files)).toEqual([]);
  });

  it('CLI: a README with a body exports an overview page and --check exits 0', () => {
    const bin = path.join(import.meta.dirname, '..', 'scripts', 'export-okf.mjs');
    const dir = mkdtempSync(path.join(tmpdir(), 'okf-overview-'));
    try {
      mkdirSync(path.join(dir, 'docs'));
      writeFileSync(path.join(dir, 'docs', 'README.md'), '---\ntitle: Home\n---\nWelcome.\n');
      writeFileSync(path.join(dir, 'graph.json'), JSON.stringify({ schema: 'dockitty.content-graph/1', okf_version: '0.2', nodes: [page('README', { type: 'Context' })], edges: [] }));
      const out = path.join(dir, 'out');
      const exported = spawnSync(process.execPath, [bin, '--graph', path.join(dir, 'graph.json'), '--docs', path.join(dir, 'docs'), '--index-basename', 'README', '--out', out], { encoding: 'utf8' });
      expect(exported.status, exported.stderr).toBe(0);
      expect(readFileSync(path.join(out, 'README.md'), 'utf8')).toContain('\nWelcome.\n');
      expect(spawnSync(process.execPath, [bin, '--check', '--out', out], { encoding: 'utf8' }).status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Schematic pages export by resource (ADR-0067)', () => {
  const schematicGraph = {
    nodes: [
      { id: 'README', kind: 'page', type: 'Context', title: 'Home', description: 'Root.', status: 'stable' },
      {
        id: 'reference/events/answered',
        kind: 'page',
        type: 'Reference',
        doc_kind: 'Schematic',
        title: 'Answered',
        description: 'The payload.',
        status: 'stable',
        href: '/reference/events/answered/',
      },
    ],
    edges: [],
  };
  const files = new Map([
    ['reference/events/answered.md', '---\ntitle: Answered\nkind: Schematic\nschematic_path: schemas/answered.schema.yaml\n---\n\nAuthored body.\n'],
  ]);
  const resourceOf = (options = {}) =>
    /resource: "([^"]*)"/.exec(
      (exportOkfBundle(schematicGraph, files, options) as Map<string, string>).get('reference/events/answered.md') ?? '',
    )?.[1];

  it('points resource at the published file, with the site base, and keeps only the authored body', () => {
    expect(resourceOf()).toBe('/reference/events/answered.yaml');
    expect(resourceOf({ base: '/docs' })).toBe('/docs/reference/events/answered.yaml');
    expect(resourceOf({ base: '/docs', siteUrl: 'https://example.invalid' })).toBe('https://example.invalid/docs/reference/events/answered.yaml');
    const page = (exportOkfBundle(schematicGraph, files) as Map<string, string>).get('reference/events/answered.md') ?? '';
    expect(page).toContain('Authored body.');
  });
});
