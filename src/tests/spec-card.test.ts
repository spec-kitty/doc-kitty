/**
 * Specification card model (gherkin-authoring-aids mission, WP06: FR-014,
 * FR-017; research R-08; contracts/specification-layout.md).
 *
 * `specCard` decides what the Specification layout's header card shows, without
 * a build: the frontmatter `tags` and the `sources[0].resource`. The source is a
 * link only for an absolute `http:`/`https:` resource (the generator writes
 * `sourceUrlPrefix + relative path`); anything else is plain text. With nothing
 * to show there is no card.
 */
import { describe, it, expect } from 'vitest';
import { specCard } from '../lib/spec-card.js';

const GITHUB = 'https://github.com/o/r/blob/main/features/a.feature';

describe('specCard', () => {
  it('shows tags and a relative source as text (no href)', () => {
    expect(
      specCard({
        tags: ['FR-003', 'shipping'],
        sources: [{ resource: 'features/a.feature', title: 'Gherkin source' }],
      }),
    ).toEqual({ tags: ['FR-003', 'shipping'], source: { text: 'features/a.feature' } });
  });

  it('links an https resource, with the repository path as readable text', () => {
    const card = specCard({ sources: [{ resource: GITHUB, title: 'Gherkin source' }] });
    expect(card).toEqual({ tags: [], source: { href: GITHUB, text: 'features/a.feature' } });
  });

  it('links an http resource; text falls back to the URL path', () => {
    const card = specCard({ sources: [{ resource: 'http://example.org/specs/x/b.feature', title: 't' }] });
    expect(card?.source).toEqual({ href: 'http://example.org/specs/x/b.feature', text: 'specs/x/b.feature' });
  });

  it('reads a GitLab-style /-/blob/<ref>/ URL as the repository path', () => {
    const url = 'https://gitlab.com/g/p/-/blob/v1.2/features/shipping/c.feature';
    expect(specCard({ sources: [{ resource: url, title: 't' }] })?.source).toEqual({
      href: url,
      text: 'features/shipping/c.feature',
    });
  });

  it('gives no card for no tags and no sources', () => {
    expect(specCard({ tags: [] })).toBeNull();
    expect(specCard({})).toBeNull();
    expect(specCard({ tags: [], sources: [] })).toBeNull();
  });

  it('gives a tags-only card and a source-only card', () => {
    expect(specCard({ tags: ['FR-001'] })).toEqual({ tags: ['FR-001'] });
    expect(specCard({ sources: [{ resource: 'f.feature', title: 't' }] })).toEqual({
      tags: [],
      source: { text: 'f.feature' },
    });
  });

  it('never shows @dk:* tags (defensive filter)', () => {
    const card = specCard({ tags: ['@dk:context=shipping', 'dk:audience=x', 'FR-003', '@dk:related=y'] });
    expect(card).toEqual({ tags: ['FR-003'] });
    expect(specCard({ tags: ['@dk:context=shipping'] })).toBeNull();
  });

  it('drops blank tags and blank resources', () => {
    expect(specCard({ tags: ['  ', ''], sources: [{ resource: '   ', title: 't' }] })).toBeNull();
  });

  it('never turns a non-http(s) resource into an href (security guard)', () => {
    for (const resource of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      '//evil.example/a.feature',
      'ftp://example.org/a.feature',
    ]) {
      const card = specCard({ sources: [{ resource, title: 't' }] });
      expect(card?.source, resource).toBeDefined();
      expect(card?.source && 'href' in card.source, resource).toBe(false);
      expect(card?.source?.text, resource).toBe(resource.trim());
    }
  });

  it('uses only the first source', () => {
    expect(
      specCard({
        sources: [
          { resource: 'first.feature', title: 'a' },
          { resource: 'https://example.org/second.feature', title: 'b' },
        ],
      })?.source,
    ).toEqual({ text: 'first.feature' });
  });
});
