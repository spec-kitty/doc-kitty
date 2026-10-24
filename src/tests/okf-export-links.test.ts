/**
 * #178 -- body-link rewriting in the OKF export and the advisory link check
 * (C-003, C-010, OKF §6.1). In-memory graph: routes come from node `href`.
 */
import { describe, it, expect } from 'vitest';
import { bundlePathOf, exportOkfBundle } from '../lib/okf-export/core.mjs';
import { idIndex, routeIndex, rewriteUrl } from '../lib/okf-export/links.mjs';
import { checkOkfBundle, checkOkfLinks, checkOkfBundleReport } from '../lib/okf-export/conformance.mjs';

const page = (id: string, href: string) => ({ id, kind: 'page', title: id, section: id.split('/')[0], href });
const graph = {
  nodes: [
    page('README', '/'),
    page('architecture/overview', '/architecture/overview/'),
    page('architecture/deep/dive', '/architecture/deep/dive/'),
    page('guides/start', '/guides/start/'),
    page('context/audience/agent', '/context/audience/agent/'),
    page('context/about', '/context/about/'),
    page('guides/README', '/guides/'),
    page('guides/add-a-session-note', '/guides/add-a-session-note/'),
    page('guides/a b', '/guides/a%20b/'),
    page('CHANGELOG', '/changelog/'),
    page('sessions/README', '/sessions/'),
    page('context/audience/participant', '/context/audience/participant/'),
    { id: 'context/audience/maintainer', kind: 'persona', title: 'Maintainer', section: 'context', href: '/context/audience/maintainer/' },
  ],
  edges: [],
};
const body = [
  'Route [a](/architecture/overview/) and base [b](/docs/architecture/overview).',
  'Relative [c](../deep/dive/) and fragment [d](/architecture/overview/#why).',
  'Non-page [e](/api/content-graph.json), external [f](https://example.org/x/), mail [g](mailto:a@b.c), anchor [h](#top).',
  'Ref [r][1] and <a href="/guides/start/">raw</a>, code `[x](/architecture/overview/)`.',
  '',
  '[1]: /guides/start/ "title"',
  '[^^0_1]: A footnote definition is text, not a link target.',
  '',
  '```md',
  '[fenced](/architecture/overview/)',
  '```',
].join('\n');
const sources = new Map([['architecture/overview.md', `---\ntitle: x\n---\n${body}\n`]]);
const out = (opts = {}) => exportOkfBundle(graph, sources, { base: '/docs', ...opts }) as Map<string, string>;
const doc = (opts = {}) => out(opts).get('architecture/overview.md') as string;

describe('body link rewriting', () => {
  it('rewrites page links to bundle paths, keeping fragments', () => {
    const t = doc();
    expect(t).toContain('[a](/architecture/overview.md)');
    expect(t).toContain('[b](/architecture/overview.md)');
    expect(t).toContain('[d](/architecture/overview.md#why)');
    expect(t).toContain('<a href="/guides/start.md">raw</a>');
    expect(t).toContain('[1]: /guides/start.md "title"');
  });

  it('resolves relative links against the page route', () => {
    expect(doc()).toContain('[c](/architecture/deep/dive.md)');
  });

  it('leaves non-page internal links alone without a site URL, and absolutises them with one', () => {
    expect(doc()).toContain('[e](/api/content-graph.json)');
    expect(doc({ siteUrl: 'https://docs.example.org/docs/' })).toContain('[e](https://docs.example.org/docs/api/content-graph.json)');
  });

  it('never touches external links, mailto, anchors, code spans, or fenced code', () => {
    const t = doc({ siteUrl: 'https://s.test' });
    expect(t).toContain('[f](https://example.org/x/)');
    expect(t).toContain('[g](mailto:a@b.c)');
    expect(t).toContain('[h](#top)');
    expect(t).toContain('`[x](/architecture/overview/)`');
    expect(t).toContain('[fenced](/architecture/overview/)');
    expect(t).toContain('[^^0_1]: A footnote definition is text, not a link target.');
  });

  it('produces a bundle whose page links all resolve', () => {
    const files = out();
    expect(checkOkfBundle(files)).toEqual([]);
    const warned = checkOkfLinks(files).map((w) => w.message);
    expect(warned).toEqual(['link target is not in the bundle: /api/content-graph.json']);
  });
});

describe('advisory link check', () => {
  const concept = (body: string) => `---\ntype: Concept\n---\n${body}\n`;

  it('reports an unresolved relative link and accepts a resolved one', () => {
    const files = new Map([
      ['sub/a.md', concept('[nope](../nope.md) [ok](../b.md) [up](../../CHANGELOG.md) [ext](https://x.org/y.md) [s](//cdn/x.md) [h](#top) [i](./c.md#f)')],
      ['sub/c.md', concept('hi')],
      ['b.md', concept('hi')],
    ]);
    expect(checkOkfLinks(files).map((w) => w.message)).toEqual([
      'link target is not in the bundle: ../../CHANGELOG.md',
      'link target is not in the bundle: ../nope.md',
    ]);
  });

  it('warns on a dangling /x.md link without making it an error', () => {
    const files = new Map([['a.md', '---\ntype: Concept\n---\nSee [x](/x.md#frag) and [ok](/b.md).\n'], ['b.md', '---\ntype: Concept\n---\nhi\n']]);
    const report = checkOkfBundleReport(files);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([
      { path: 'a.md', severity: 'warning', rule: 'unresolved-link', message: 'link target is not in the bundle: /x.md#frag', target: '/x.md#frag' },
    ]);
  });

  it('is silent for a clean bundle and ignores code', () => {
    const files = new Map([['a.md', '---\ntype: Concept\n---\n[ok](/b.md) `[n](/nope.md)`\n'], ['b.md', '---\ntype: Concept\n---\nhi\n']]);
    expect(checkOkfLinks(files)).toEqual([]);
  });
});

describe('unbased parity (#237)', () => {
  // The snapshot file was generated by the code BEFORE the #237 fix (every bundle file): with
  // no base, the export must not change.
  const parityGraph = { nodes: graph.nodes.slice(0, 4), edges: [] };
  const paritySources = new Map([
    ...sources,
    ['guides/start.md', '---\ntitle: s\n---\nBack to [overview](/architecture/overview/), [home](/), [asset](/api/x.json), [rel](../architecture/deep/dive/).\n'],
    ['README.md', '---\ntitle: Home\n---\nHome body.\n'],
  ]);
  it('exports every bundle file byte-identically when no base is configured', async () => {
    const files = exportOkfBundle(parityGraph, paritySources, { siteUrl: 'https://docs.example.org' }) as Map<string, string>;
    const dump = [...files].map(([path, text]) => `=== ${path} ===\n${text}`).join('\n');
    await expect(dump).toMatchFileSnapshot('./__snapshots__/okf-export-unbased.txt');
  });
});

describe('site URL composition (#237 D1)', () => {
  const agentSources = new Map([['context/audience/agent.md', '---\ntitle: a\n---\nSee [llms](../../../llms.txt).\n']]);
  const agent = (siteUrl: string) =>
    (exportOkfBundle(graph, agentSources, { base: '/docs', siteUrl }) as Map<string, string>).get('context/audience/agent.md') as string;

  it('adds the base to an origin-only site URL', () => {
    expect(agent('https://docs.example.org')).toContain('[llms](https://docs.example.org/docs/llms.txt)');
  });

  it('does not double the base when the site URL already carries it', () => {
    expect(agent('https://docs.example.org/docs/')).toContain('[llms](https://docs.example.org/docs/llms.txt)');
    expect(agent('https://docs.example.org/docs')).toBe(agent('https://docs.example.org'));
  });
});

describe('source-relative .md links (#237 D2, D3)', () => {
  const src = (lines: string[]) => `---\ntitle: t\n---\n${lines.join('\n')}\n`;
  const mdSources = new Map([
    ['README.md', src(['Root [g](guides/README.md).'])],
    ['context/about.md', src(['Up [g](../guides/README.md) and [n](../nope.md).'])],
    [
      'context/audience/agent.md',
      src([
        'Steps [s](../../guides/add-a-session-note.md#steps).',
        'Mdx [m](../../guides/README.mdx).',
        'Absolute [a](/guides/README.md) and based [b](/docs/guides/README.md).',
        'Encoded [e](../../guides/a%20b.md).',
        'Repo [c](../../../CHANGELOG.md) and [u](../../nope.md).',
        'Query [q](../../guides/README.md?x=1#top).',
      ]),
    ],
  ]);
  const files = exportOkfBundle(graph, mdSources, { base: '/docs', siteUrl: 'https://docs.example.org' }) as Map<string, string>;
  const agent = files.get('context/audience/agent.md') as string;

  it('resolves a relative .md link against the source directory and maps an index id to index.md', () => {
    expect(files.get('context/about.md')).toContain('[g](/guides/index.md)');
    expect(agent).toContain('[s](/guides/add-a-session-note.md#steps)');
  });

  it('handles .mdx, root-absolute, already-based, encoded and query forms', () => {
    expect(agent).toContain('[m](/guides/index.md)');
    expect(agent).toContain('[a](/guides/index.md)');
    expect(agent).toContain('[b](/guides/index.md)');
    expect(agent).toContain('[e](/guides/a b.md)');
    expect(agent).toContain('[q](/guides/index.md?x=1#top)');
  });

  it('resolves a link from the root README (directory "") without a double slash', () => {
    // The root index page emits only its entry list, so the resolver is checked directly.
    const ctx = {
      routes: routeIndex(graph.nodes),
      ids: idIndex(graph.nodes),
      pageId: 'README',
      pageHref: '/',
      base: '/docs',
      siteUrl: 'https://docs.example.org/docs',
      bundlePath: (id: string) => bundlePathOf(id),
    };
    expect(rewriteUrl('guides/README.md', ctx)).toBe('/guides/index.md');
  });

  it('leaves a .md link with no node unchanged, never absolutising it', () => {
    expect(files.get('context/about.md')).toContain('[n](../nope.md)');
    expect(agent).toContain('[c](../../../CHANGELOG.md)');
    expect(agent).toContain('[u](../../nope.md)');
    expect(agent).not.toContain('docs.example.org/CHANGELOG');
    // a root CHANGELOG node exists, but the link climbs above the docs root: it must not map to it
    expect(agent).not.toContain('](/CHANGELOG.md)');
  });
});

describe('site URL composition hardening (#237 T005)', () => {
  const asset = new Map([['architecture/overview.md', '---\ntitle: a\n---\nSee [x](/api/x.json).\n']]);
  const link = (base: string, siteUrl: string) =>
    ((exportOkfBundle(graph, asset, { base, siteUrl }) as Map<string, string>).get('architecture/overview.md') as string).match(/\[x\]\(([^)]*)\)/)?.[1];

  it.each([
    ['/docs', 'https://host/team/docs', 'https://host/team/docs/api/x.json'],
    ['/docs', 'https://host/team/docs/', 'https://host/team/docs/api/x.json'],
    ['/site', 'https://x.org/docs-site', 'https://x.org/docs-site/site/api/x.json'],
    ['docs', 'https://x.org', 'https://x.org/docs/api/x.json'],
    ['/docs', 'https://docs', 'https://docs/docs/api/x.json'],
    ['/docs/', 'https://x.org', 'https://x.org/docs/api/x.json'],
    ['/docs', 'docs.example.org/docs', 'docs.example.org/docs/api/x.json'],
    ['/docs', 'https://x.org/mydocs', 'https://x.org/mydocs/docs/api/x.json'],
    ['/docs', 'https://x.org/team/docs', 'https://x.org/team/docs/api/x.json'],
    ['/docs', 'docs.example.org', 'docs.example.org/docs/api/x.json'],
  ])('base %s + site %s', (base, siteUrl, expected) => {
    expect(link(base, siteUrl)).toBe(expected);
  });
});

describe('pinned and issue-table rows (#237 SC-003)', () => {
  const src = (line: string) => `---\ntitle: t\n---\n${line}\n`;
  const site = 'https://sddevelopment-be.github.io';
  const exportOne = (id: string, line: string, extra: Record<string, string> = {}) => {
    const files = new Map([[`${id}.md`, src(line)], ...Object.entries(extra).map(([k, v]) => [k, src(v)] as [string, string])]);
    return (exportOkfBundle(graph, files, { base: '/docs', siteUrl: site }) as Map<string, string>).get(`${id}.md`) as string;
  };

  it.each([
    ['context/about', '../guides/README.md', '/guides/index.md'],
    ['context/audience/participant', '../../guides/add-a-session-note.md', '/guides/add-a-session-note.md'],
    ['guides/add-a-session-note', '../sessions/README.md', '/sessions/index.md'],
    ['context/audience/agent', '../../../llms.txt', `${site}/docs/llms.txt`],
  ])('%s links %s', (id, link, expected) => {
    expect(exportOne(id, `[l](${link})`)).toContain(`[l](${expected})`);
  });

  it('pins a trailing-slash .md target to the route branch, not the source lookup', () => {
    expect(exportOne('context/about', '[t](../guides/README.md/)')).toContain(`[t](${site}/docs/context/guides/README.md/)`);
  });

  it('rewrites a .md link written in a persona page and to a persona page', () => {
    expect(exportOne('context/audience/maintainer', '[g](../../guides/README.md) [p](./maintainer.md)')).toContain(
      '[g](/guides/index.md) [p](/context/audience/maintainer.md)',
    );
  });
});
