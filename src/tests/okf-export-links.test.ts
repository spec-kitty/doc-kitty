/**
 * #178 -- body-link rewriting in the OKF export and the advisory link check
 * (C-003, C-010, OKF §6.1). In-memory graph: routes come from node `href`.
 */
import { describe, it, expect } from 'vitest';
import { exportOkfBundle } from '../lib/okf-export/core.mjs';
import { checkOkfBundle, checkOkfLinks, checkOkfBundleReport } from '../lib/okf-export/conformance.mjs';

const page = (id: string, href: string) => ({ id, kind: 'page', title: id, section: id.split('/')[0], href });
const graph = {
  nodes: [
    page('README', '/'),
    page('architecture/overview', '/architecture/overview/'),
    page('architecture/deep/dive', '/architecture/deep/dive/'),
    page('guides/start', '/guides/start/'),
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
  it('warns on a dangling /x.md link without making it an error', () => {
    const files = new Map([['a.md', '---\ntype: Concept\n---\nSee [x](/x.md#frag) and [ok](/b.md).\n'], ['b.md', '---\ntype: Concept\n---\nhi\n']]);
    const report = checkOkfBundleReport(files);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([
      { path: 'a.md', severity: 'warning', rule: 'unresolved-link', message: 'link target is not in the bundle: /x.md#frag' },
    ]);
  });

  it('is silent for a clean bundle and ignores code', () => {
    const files = new Map([['a.md', '---\ntype: Concept\n---\n[ok](/b.md) `[n](/nope.md)`\n'], ['b.md', '---\ntype: Concept\n---\nhi\n']]);
    expect(checkOkfLinks(files)).toEqual([]);
  });
});
