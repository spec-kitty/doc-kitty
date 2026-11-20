/** Print rewriting (ADR-0081 D-08/D-09): ids, references, links and heading levels. */
import { describe, it, expect } from 'vitest';
import { rewritePage } from '../lib/print/rewrite.js';

const anchors = new Map([
  ['/doc-kitty/architecture/', 'p0'],
  ['/doc-kitty/architecture/overview/', 'p1'],
]);
const opts = { prefix: 'p1', pageAnchors: anchors, origin: 'https://example.org', demote: 1 };

describe('rewritePage', () => {
  it('prefixes ids and every reference to them', () => {
    const html =
      '<h2 id="intro">Intro</h2><a href="#intro">x</a><a href="#_top">top</a>' +
      '<label for="f">L</label><input id="f">' +
      '<svg id="m1"><style>#m1 .node{fill:#fff}#m10{x:1}</style><marker id="arrow"/><path marker-end="url(#arrow)"/>' +
      '<use xlink:href="#arrow"/><g aria-labelledby="m1 ext"/></svg>';
    const out = rewritePage(html, opts);
    expect(out).toContain('id="p1-intro"');
    expect(out).toContain('href="#p1-intro"');
    expect(out, 'a fragment to an id this page does not define stays').toContain('href="#_top"');
    expect(out).toContain('for="p1-f"');
    expect(out).toContain('id="p1-f"');
    expect(out).toContain('<style>#p1-m1 .node{fill:#fff}#m10{x:1}</style>');
    expect(out).toContain('url(#p1-arrow)');
    expect(out).toContain('xlink:href="#p1-arrow"');
    expect(out).toContain('aria-labelledby="p1-m1 ext"');
  });

  it('turns same-document links into anchors and the rest into absolute, marked links', () => {
    const html =
      '<a href="/doc-kitty/architecture/overview/">o</a>' +
      '<a class="x" href="/doc-kitty/architecture/overview/#key-properties">k</a>' +
      '<a href="/doc-kitty/architecture">idx</a>' +
      '<a href="/doc-kitty/guides/install/">g</a>' +
      '<a href="https://other.example/">ext</a>';
    const out = rewritePage(html, opts);
    expect(out).toContain('<a href="#p1" data-dk-print-link>o</a>');
    expect(out).toContain('<a class="x" href="#p1-key-properties" data-dk-print-link>k</a>');
    expect(out).toContain('<a href="#p0" data-dk-print-link>idx</a>');
    expect(out).toContain('<a href="https://example.org/doc-kitty/guides/install/" data-dk-print-link>g</a>');
    expect(out, 'an external link is untouched').toContain('<a href="https://other.example/">ext</a>');
    expect(rewritePage('<a href="//cdn.example/x">c</a>', opts)).toBe('<a href="//cdn.example/x">c</a>');
  });

  it('demotes headings and their wrapper classes, capped at h6', () => {
    const html = '<div class="sl-heading-wrapper level-h2"><h2 id="a">A</h2></div><h5>E</h5><h6>F</h6>';
    const out = rewritePage(html, { ...opts, demote: 2 });
    expect(out).toContain('<div class="sl-heading-wrapper level-h4"><h4 id="p1-a">A</h4></div>');
    expect(out).toContain('<h6>E</h6><h6>F</h6>');
  });

  it('demotes an ARIA heading too, since the outline counts it', () => {
    const out = rewritePage('<p role="heading" aria-level="2">Sub</p><div aria-level="2">x</div>', { ...opts, demote: 2, floor: 4 });
    expect(out).toBe('<p role="heading" aria-level="4">Sub</p><div aria-level="2">x</div>');
  });

  it('never lets a heading rise above the floor, and keeps the levels apart', () => {
    const out = rewritePage('<h1>Part</h1><h2>Section</h2><h3>Sub</h3>', { ...opts, demote: 1, floor: 3 });
    expect(out).toBe('<h3>Part</h3><h4>Section</h4><h5>Sub</h5>');
  });

  it('skips no level: each heading sits at most one below the one before it', () => {
    const out = rewritePage('<h1>A</h1><h2>B</h2><h3>C</h3><h2>D</h2>', { ...opts, demote: 2, floor: 4 });
    const levels = [...out.matchAll(/<h([1-6])>/g)].map((m) => Number(m[1]));
    expect(levels).toEqual([4, 5, 6, 5]);
    for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });

  it('leaves markup shown as text alone, ids, links and classes alike', () => {
    const html = '<h2 id="x">X</h2><p><code>&#x3C;a id="x" href="#x" class="level-h2"></code></p>';
    const out = rewritePage(html, { ...opts, demote: 1 });
    expect(out).toContain('<h3 id="p1-x">X</h3>');
    expect(out).toContain('<code>&#x3C;a id="x" href="#x" class="level-h2"></code>');
  });

  it('matches a percent-encoded fragment to its non-ASCII heading id', () => {
    const out = rewritePage('<h2 id="café">C</h2><a href="#caf%C3%A9">c</a>', { ...opts, demote: 0 });
    expect(out).toContain('<a href="#p1-café">');
  });

  it('leaves text that merely contains a hash alone', () => {
    const html = '<p id="c">Use #c and #include here</p><code>url(#c)</code>';
    const out = rewritePage(html, { ...opts, demote: 0 });
    expect(out).toContain('Use #c and #include here');
    expect(out, 'url(#…) in text is not a reference').toContain('<code>url(#c)</code>');
  });

  it('resolves a relative link against the page it was written in', () => {
    const html = '<a href="./overview/">a</a><a href="../guides/x/#y">b</a><a href="mailto:x@y.z">m</a>';
    const out = rewritePage(html, { ...opts, pagePath: '/doc-kitty/architecture/' });
    expect(out).toContain('<a href="#p1" data-dk-print-link>a</a>');
    expect(out).toContain('<a href="https://example.org/doc-kitty/guides/x/#y" data-dk-print-link>b</a>');
    expect(out).toContain('<a href="mailto:x@y.z">m</a>');
  });
});
