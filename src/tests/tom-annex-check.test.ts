/**
 * The ADR-0087 D3 verdicts for the evidence index's opt-in files (WP07 T031):
 * the committed snapshot and the committed hub page, against the build. Every
 * case is a variant of one base fixture (the canonical index, stamped).
 * Precedence: missing > unowned > hand-edited > stale-source > stale-render.
 */
import { describe, expect, it } from 'vitest';
import { buildTomAnnex, serializeTomAnnex } from '../lib/tom-annex/core.mjs';
import { checkHub, checkSnapshot } from '../lib/tom-annex/check.mjs';
import { pageContentHash, renderHubPage } from '../lib/tom-annex/hub-page.mjs';
import { contentHash, stampAnnex } from '../lib/tom-annex/stamp.mjs';
import { canonical } from './fixtures/tom-annex/graph.mjs';

const SITE = new URL('https://docs.example.org');
const { graph, catalog } = canonical();
const base = stampAnnex(buildTomAnnex(graph as never, catalog as never, { site: SITE, base: '/docs/' }), {
  inputs: [{ key: 'docs/a.md', sha256: 'a'.repeat(64) }],
});
const builtText = serializeTomAnnex(base);
type Annex = typeof base;
/** A re-stamped variant: body edits keep a consistent content_hash, like a real build. */
const variant = (edit: (a: Annex) => void, restamp = true): Annex => {
  const a = structuredClone(base);
  edit(a);
  if (restamp) a.generated.content_hash = contentHash(a);
  return a;
};
const otherDigest = (a: Annex) => (a.generated.source_digest = `sha256:${'b'.repeat(64)}`);

describe('checkSnapshot (WP07 T031)', () => {
  const check = (committedText: string | undefined, built = builtText) => checkSnapshot({ committedText, builtText: built });

  it('ok when the committed snapshot is the built artifact', () => {
    expect(check(builtText)).toBe('ok');
  });

  it('missing when nothing is committed', () => {
    expect(check(undefined)).toBe('missing');
  });

  it('unowned when the file is not an evidence index stamped by this producer', () => {
    expect(check('{"hello": "world"}\n')).toBe('unowned');
    expect(check('not json')).toBe('unowned');
    expect(check(serializeTomAnnex(variant((a) => (a.generated.by = 'doc-kitty-gherkin/1.0.0'), false)))).toBe('unowned');
  });

  it('hand-edited when the body no longer matches its own content_hash', () => {
    const edited = serializeTomAnnex(variant((a) => a.counsel.push('Edited by hand.'), false));
    expect(check(edited)).toBe('hand-edited');
  });

  it('hand-edited when generated.at is not the one the evidence gives (ADR-0087 review N5)', () => {
    expect(check(serializeTomAnnex(variant((a) => (a.generated.at = '2001-01-01T00:00:00Z'), false)))).toBe('hand-edited');
  });

  it('hand-edited wins over stale-source (a hand edit is the most actionable)', () => {
    const editedAndStale = serializeTomAnnex(variant((a) => a.counsel.push('x'), false));
    expect(check(editedAndStale, serializeTomAnnex(variant(otherDigest)))).toBe('hand-edited');
  });

  it('stale-source when the build digested other inputs', () => {
    expect(check(builtText, serializeTomAnnex(variant(otherDigest)))).toBe('stale-source');
  });

  it('stale-render when the digests agree but the bytes differ', () => {
    const rerendered = serializeTomAnnex(variant((a) => (a.notice = `${a.notice} Rendered differently.`)));
    expect(check(builtText, rerendered)).toBe('stale-render');
  });

  it('a formatting-only edit of the committed file is stale-render, not ok (review N6)', () => {
    const reformatted = `${JSON.stringify(JSON.parse(builtText))}\n`;
    expect(check(reformatted)).toBe('stale-render');
  });

  it('masks only generated.at: a different at alone is ok', () => {
    const builtLater = variant((a) => (a.generated.at = '2030-01-01T00:00:00Z'));
    // The committed at must still be the one its own evidence gives, so mask from the built side.
    expect(check(builtText, serializeTomAnnex(builtLater))).toBe('ok');
  });
});

describe('checkHub (WP07 T031)', () => {
  const hub = renderHubPage(base);
  const check = (committedText: string | undefined, builtAnnex: Annex = base) => checkHub({ committedText, builtAnnex });
  /** Change the page body and keep its stamp consistent, as a renderer change would. */
  const restamped = (text: string) => text.replace(/content_hash: "sha256:[0-9a-f]{12}"/, `content_hash: "${pageContentHash(text)}"`);

  it('ok when the committed hub is what the build renders', () => {
    expect(check(hub)).toBe('ok');
  });

  it('missing when nothing is committed', () => {
    expect(check(undefined)).toBe('missing');
  });

  it('unowned when the page lacks this producer stamp, such as a deleted or mistyped one', () => {
    expect(check(hub.replace(/\ngenerated:\n(?: {2}.*\n)+/, '\n'))).toBe('unowned');
    expect(check(hub.replace('doc-kitty-tom-annex/', 'doc-kitty-tom-anex/'))).toBe('unowned');
  });

  it('hand-edited when the page body no longer matches its content_hash', () => {
    expect(check(hub.replace('## Uncovered measures', '## Uncovered measures (edited)'))).toBe('hand-edited');
  });

  it('stale-source when the build digested other inputs', () => {
    expect(check(hub, variant(otherDigest))).toBe('stale-source');
  });

  it('stale-render when the digests agree but the rendered page differs', () => {
    const older = restamped(hub.replace('Do not edit it by hand', 'Please do not edit it by hand'));
    expect(check(older)).toBe('stale-render');
  });

  it('masks only generated.at (and the updated it drives)', () => {
    expect(check(hub, variant((a) => (a.generated.at = '2030-01-01T00:00:00Z')))).toBe('ok');
  });
});
