/**
 * ATDD for the #62 fail-closed tightening of check-links.mjs (link-integrity
 * -01M1PSEH, WP02 T010 — FR-005/NFR-003/NFR-004).
 *
 * Scope: `classifyInlineLink`'s strict-mode behaviour, and `isSiteRoot`'s
 * root classification (only `example/docs`-shaped roots get tightened — the
 * top-level `docs/` Common Docs root's `.md`-relative convention must be
 * completely unaffected). The base pre-existing behaviour (external/site-
 * absolute skip, `.md`/route resolution) is covered by the existing
 * `check-links.mjs` consumers (`adr-referential-integrity.test.ts`,
 * `index-basename.test.ts`, `example-adopter.test.ts`) and is intentionally
 * NOT re-asserted here.
 */
import { describe, it, expect } from 'vitest';
import { classifyInlineLink, isSiteRoot, SITE_ROOTS } from '../scripts/check-links.mjs';

describe('isSiteRoot', () => {
  it('is true for the site-built example/docs root', () => {
    expect(isSiteRoot('example/docs')).toBe(true);
  });

  it('is true for a differently-prefixed invocation ending in the same root', () => {
    expect(isSiteRoot('/repo/example/docs')).toBe(true);
  });

  it('is true regardless of a trailing slash', () => {
    expect(isSiteRoot('example/docs/')).toBe(true);
  });

  it('is false for the plain, unbuilt Common Docs root', () => {
    expect(isSiteRoot('docs')).toBe(false);
  });

  it('SITE_ROOTS names exactly the site-built tree', () => {
    expect(SITE_ROOTS).toEqual(['example/docs']);
  });
});

describe('classifyInlineLink — non-strict (docs/ convention, unchanged)', () => {
  it('accepts a .md-relative link for filesystem resolution', () => {
    expect(classifyInlineLink('../context/convention.md')).toEqual({
      kind: 'check',
      target: '../context/convention.md',
    });
  });

  it('accepts a bare extensionless relative link for filesystem resolution', () => {
    expect(classifyInlineLink('sibling-doc')).toEqual({ kind: 'check', target: 'sibling-doc' });
  });

  it('skips a root-absolute (site-absolute) link', () => {
    expect(classifyInlineLink('/context/convention/')).toEqual({ kind: 'skip' });
  });

  it('skips an external link', () => {
    expect(classifyInlineLink('https://example.com')).toEqual({ kind: 'skip' });
  });

  it('skips a non-Markdown asset link', () => {
    expect(classifyInlineLink('palm-trees.svg')).toEqual({ kind: 'skip' });
  });

  it('skips a pure-anchor link', () => {
    expect(classifyInlineLink('#section')).toEqual({ kind: 'skip' });
  });
});

describe('classifyInlineLink — strict (example/docs #62 tightening)', () => {
  it('rejects a .md-relative link (confirmed dead in this Starlight build)', () => {
    const result = classifyInlineLink('./blocks-demonstrator.md', { strict: true });
    expect(result.kind).toBe('invalid');
    expect(result.reason).toMatch(/\.md-relative/);
  });

  it('rejects an .mdx-relative link the same way', () => {
    const result = classifyInlineLink('./blocks-demonstrator.mdx', { strict: true });
    expect(result.kind).toBe('invalid');
  });

  it('rejects a bare extensionless relative link (the class-A trailing-slash trap)', () => {
    const result = classifyInlineLink('blocks-demonstrator', { strict: true });
    expect(result.kind).toBe('invalid');
    expect(result.reason).toMatch(/CHILD/);
  });

  it('rejects a "./bare" relative link with no trailing slash the same way', () => {
    const result = classifyInlineLink('./blocks-demonstrator', { strict: true });
    expect(result.kind).toBe('invalid');
  });

  it('still accepts a relative link naming a real subdirectory route (trailing slash)', () => {
    expect(classifyInlineLink('./missions/mission-alpha/', { strict: true })).toEqual({
      kind: 'check',
      target: './missions/mission-alpha/',
    });
  });

  it('still accepts the root-absolute authored-link convention (WP01) unchanged', () => {
    expect(classifyInlineLink('/architecture/blocks-demonstrator/', { strict: true })).toEqual({
      kind: 'skip',
    });
  });

  it('still skips external and pure-anchor links', () => {
    expect(classifyInlineLink('https://example.com', { strict: true })).toEqual({ kind: 'skip' });
    expect(classifyInlineLink('#section', { strict: true })).toEqual({ kind: 'skip' });
  });

  it('still skips a non-Markdown asset link', () => {
    expect(classifyInlineLink('palm-trees.svg', { strict: true })).toEqual({ kind: 'skip' });
  });
});
