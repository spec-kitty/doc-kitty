import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

import {
  docsRootFromSignal,
  docsRootFromSignals,
  docsRoot,
  DK_DOCS_ROOT_ENV,
} from '../lib/routes/shared.js';

const abs = (rel: string) => path.resolve(process.cwd(), rel);

/**
 * `DK_DOCS_ROOT` is process-global. The derivation/fallback suites assume it is
 * UNSET (they exercise the content-layer signal), and the preference suite sets
 * it explicitly — so snapshot + restore it around every test to keep them
 * order-independent and to never leak into another test file's worker.
 */
const originalDocsRootEnv = process.env[DK_DOCS_ROOT_ENV];
const restoreDocsRootEnv = (): void => {
  if (originalDocsRootEnv === undefined) delete process.env[DK_DOCS_ROOT_ENV];
  else process.env[DK_DOCS_ROOT_ENV] = originalDocsRootEnv;
};

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

describe('docsRootFromSignals (pure precedence, env-free/fs-free)', () => {
  const filePathEntries: Array<{ id: string; filePath?: string }> = [
    { id: 'index', filePath: 'documentation/README.md' },
    { id: 'how-to/pages', filePath: 'documentation/how-to/pages.md' },
  ];

  it('prefers the integration-published root over the content-layer signal', () => {
    // Even with content that would derive `documentation`, the published root wins.
    expect(docsRootFromSignals(abs('published-docs'), filePathEntries)).toBe(
      abs('published-docs'),
    );
  });

  it('resolves a relative published root against cwd', () => {
    expect(docsRootFromSignals('published-docs', [])).toBe(abs('published-docs'));
  });

  it('ignores an empty/whitespace published root and falls to the filePath signal', () => {
    expect(docsRootFromSignals('   ', filePathEntries)).toBe(abs('documentation'));
    expect(docsRootFromSignals(undefined, filePathEntries)).toBe(abs('documentation'));
  });

  it('returns null when neither signal resolves (caller supplies the default)', () => {
    expect(docsRootFromSignals(undefined, [{ id: 'guides/deploy' }])).toBeNull();
    expect(docsRootFromSignals(undefined, [])).toBeNull();
  });
});

describe('docsRoot (resolver the discovery routes call)', () => {
  beforeEach(() => {
    collectionEntries.length = 0;
    // These cases exercise the content-layer fallback: the integration signal
    // must be absent so the fallback is reached (guardrail: preserve #22 exactly).
    delete process.env[DK_DOCS_ROOT_ENV];
  });
  afterEach(restoreDocsRootEnv);

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

describe('docsRoot — prefers the integration-published DK_DOCS_ROOT (F3/F5)', () => {
  beforeEach(() => {
    collectionEntries.length = 0;
  });
  afterEach(restoreDocsRootEnv);

  it('returns the published root even when the content-layer signal disagrees', async () => {
    // Content would derive `documentation`, but the integration published a
    // DIFFERENT root — the published truth (what the sitemap filter used) wins, so
    // both surfaces resolve the registry from the SAME directory.
    collectionEntries.push({ id: 'index', filePath: 'documentation/README.md' });
    process.env[DK_DOCS_ROOT_ENV] = abs('published-docs');
    expect(await docsRoot()).toBe(abs('published-docs'));
  });

  it('falls back to the content-layer derivation once the signal is unset', async () => {
    // Round-trips the no-integration guarantee: deleting the env restores #22.
    collectionEntries.push({ id: 'index', filePath: 'documentation/README.md' });
    delete process.env[DK_DOCS_ROOT_ENV];
    expect(await docsRoot()).toBe(abs('documentation'));
  });
});
