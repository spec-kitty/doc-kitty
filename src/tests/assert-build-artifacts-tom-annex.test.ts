/**
 * The artifact gate's evidence-index checks (WP05 T021, #401): shape, label,
 * the `_links` entry, built evidence pages, and exact agreement with the
 * content graph's `classified-as` edges; and nothing at all on a site with no
 * classified pages. Every negative case is a variant of one good fixture.
 */
import { describe, expect, it } from 'vitest';
import { buildTomAnnex, serializeTomAnnex, TOM_ANNEX_LABEL } from '../lib/tom-annex/core.mjs';
import { tomAnnexProblems } from '../lib/tom-annex/verify.mjs';
import { canonical, graph as graphOf, page } from './fixtures/tom-annex/graph.mjs';

const PREFIX = 'https://docs.example.org/docs/';
const SITE = new URL('https://docs.example.org');
const { graph, catalog } = canonical();
const annexText = serializeTomAnnex(buildTomAnnex(graph as never, catalog as never, { site: SITE, base: '/docs/' }));
const links = { self: { href: `${PREFIX}api/index.json` }, tomAnnex: { href: `${PREFIX}api/tom-annex.json`, title: TOM_ANNEX_LABEL } };
const everyPageBuilt = () => true;

const problems = (over: Record<string, unknown> = {}) =>
  tomAnnexProblems({ graph, indexLinks: links, annexText, pageBuilt: everyPageBuilt, ...over } as never);

/** A loose view of the parsed index, for editing test variants. */
type AnnexJson = { format: string; format_version: string; label: string; scopes: Record<'system' | 'organisation', Array<{ evidence: Array<{ url: string }> }>> };

const edited = (edit: (annex: AnnexJson) => void) => {
  const annex = JSON.parse(annexText);
  edit(annex);
  return `${JSON.stringify(annex, null, 2)}\n`;
};

describe('tomAnnexProblems (WP05 T021)', () => {
  it('passes a good build (the positive control every case below varies)', () => {
    expect(problems()).toEqual([]);
  });

  it('requires the file when the graph has classified-as edges', () => {
    expect(problems({ annexText: undefined }).join('\n')).toMatch(/api\/tom-annex\.json.*not built/);
  });

  it('requires the _links.tomAnnex entry', () => {
    const { tomAnnex, ...withoutLink } = links;
    void tomAnnex;
    expect(problems({ indexLinks: withoutLink }).join('\n')).toMatch(/_links\.tomAnnex/);
  });

  it('requires the format, a 1.x version and the exact label', () => {
    expect(problems({ annexText: '{ not json' }).join('\n')).toMatch(/not valid JSON/);
    expect(problems({ annexText: edited((a) => (a.format = 'other')) }).join('\n')).toMatch(/format/);
    expect(problems({ annexText: edited((a) => (a.format_version = '2.0')) }).join('\n')).toMatch(/format_version/);
    expect(problems({ annexText: edited((a) => (a.label = 'TOM annex')) }).join('\n')).toMatch(/label/);
  });

  it('requires every evidence page to be built', () => {
    const missing = problems({ pageBuilt: (url: string) => !url.includes('guides/access') });
    expect(missing.join('\n')).toMatch(/guides\/access.*not a built page/);
  });

  it('fails an evidence triple the graph does not have (an extra page under a measure)', () => {
    const extra = edited((a) => {
      a.scopes.system[0].evidence.push({ ...a.scopes.system[0].evidence[0], url: `${PREFIX}guides/unrelated/` });
    });
    expect(problems({ annexText: extra }).join('\n')).toMatch(/not in the content graph.*guides\/unrelated/);
  });

  it('fails a graph edge the annex leaves out (for example a draft-only rule gone wrong)', () => {
    const dropped = edited((a) => {
      a.scopes.organisation = [];
    });
    expect(problems({ annexText: dropped }).join('\n')).toMatch(/missing from the evidence index.*incident-response/);
  });

  it('fails an evidence entry filed under the wrong scope', () => {
    const moved = edited((a) => {
      a.scopes.system.push(...a.scopes.organisation);
      a.scopes.organisation = [];
    });
    expect(problems({ annexText: moved }).length).toBeGreaterThan(0);
  });

  describe('a site with no classified pages', () => {
    const bare = graphOf([page('p')], []);
    it('passes when neither the file nor the link exists', () => {
      expect(problems({ graph: bare, annexText: undefined, indexLinks: { self: links.self } })).toEqual([]);
    });
    it('fails when the file or the link exists anyway', () => {
      expect(problems({ graph: bare, indexLinks: { self: links.self } }).join('\n')).toMatch(/no classified-as edge.*tom-annex\.json/);
      expect(problems({ graph: bare, annexText: undefined }).join('\n')).toMatch(/no classified-as edge.*_links\.tomAnnex/);
    });
  });
});
