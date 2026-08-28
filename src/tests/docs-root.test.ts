import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import process from 'node:process';

// The resolver module (`routes/shared.ts`) statically imports `astro:content`,
// which does not resolve under the framework-agnostic vitest suite. Neutralize
// it with a factory (the same posture the suite takes elsewhere — Astro route
// wiring is otherwise covered by the example-site build in CI). `vi.hoisted`
// exposes a mutable entry list so the same mock drives `docsRoot()` end-to-end.
const { collectionEntries } = vi.hoisted(() => ({
  collectionEntries: [] as Array<{ id: string; filePath?: string }>,
}));
vi.mock('astro:content', () => ({
  getCollection: async () => collectionEntries,
}));

import { docsRootFromSignal, docsRoot } from '../lib/routes/shared.js';

const abs = (rel: string) => path.resolve(process.cwd(), rel);

describe('docsRootFromSignal', () => {
  it('derives a non-default docs root from a plain page filePath', () => {
    expect(
      docsRootFromSignal({ id: 'how-to/pages', filePath: 'documentation/how-to/pages.md' }),
    ).toBe(abs('documentation'));
  });

  it('derives the same root from a section README (README-as-index)', () => {
    expect(
      docsRootFromSignal({ id: 'architecture', filePath: 'documentation/architecture/README.md' }),
    ).toBe(abs('documentation'));
  });

  it('derives the root from the bundle-root index entry', () => {
    // The root README is stored under ROOT_ENTRY_ID ('index'); its slug is ''.
    expect(docsRootFromSignal({ id: 'index', filePath: 'documentation/README.md' })).toBe(
      abs('documentation'),
    );
  });

  it('resolves the convention default `docs/` layout', () => {
    expect(docsRootFromSignal({ id: 'guides/deploy', filePath: 'docs/guides/deploy.md' })).toBe(
      abs('docs'),
    );
  });

  it('treats a repo-root docs tree (docsDir ".") as the project root', () => {
    expect(docsRootFromSignal({ id: 'index', filePath: 'README.md' })).toBe(abs('.'));
  });

  it('normalizes OS path separators before deriving the root', () => {
    expect(
      docsRootFromSignal({ id: 'how-to/pages', filePath: 'documentation\\how-to\\pages.md' }),
    ).toBe(abs('documentation'));
  });

  it('returns null when the entry carries no filePath signal', () => {
    expect(docsRootFromSignal({ id: 'guides/deploy' })).toBeNull();
  });
});

describe('docsRoot (resolver the discovery routes call)', () => {
  beforeEach(() => {
    collectionEntries.length = 0;
  });

  it('resolves the docs root from the loaded content, honoring a custom docsDir', async () => {
    collectionEntries.push(
      { id: 'index', filePath: 'documentation/README.md' },
      { id: 'how-to/pages', filePath: 'documentation/how-to/pages.md' },
    );
    // Proves the routes read the section registry from the SAME custom root the
    // content came from (issue #22) — not the hardcoded `<cwd>/docs`.
    expect(await docsRoot()).toBe(abs('documentation'));
  });

  it('falls back to the convention default `<cwd>/docs` when no entry exposes a filePath', async () => {
    collectionEntries.push({ id: 'guides/deploy' });
    expect(await docsRoot()).toBe(abs('docs'));
  });

  it('falls back to `<cwd>/docs` for an empty corpus', async () => {
    expect(await docsRoot()).toBe(abs('docs'));
  });
});
