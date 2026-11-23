/**
 * The config-time scan that decides whether a site serves the evidence index
 * (WP03 T010, #401): true only when a published page carries a non-empty
 * `tom_classification`. Drafts are left out by the sitemap's rule (C-005).
 * Each negative case has a positive control on the same tree.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearRegisteredExclusions, registerExcludedFolders } from '../lib/docs-walk.mjs';
import { hasPublishedClassifiedPages } from '../lib/tom-annex/scan.mjs';

const roots: string[] = [];

/** A docs tree from `{ relPath: frontmatter }`. */
function tree(files: Record<string, Record<string, unknown>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-tom-scan-'));
  roots.push(root);
  for (const [rel, data] of Object.entries(files)) {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    const yaml = Object.entries(data)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n');
    writeFileSync(file, `---\n${yaml}\n---\n\nBody.\n`);
  }
  return root;
}

afterEach(() => {
  clearRegisteredExclusions();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const CLASSIFIED = { title: 'Audit log', doc_status: 'active', tom_classification: [{ measure: 'events-logging' }] };
const HOME = { title: 'Home', doc_status: 'active' };

describe('hasPublishedClassifiedPages (WP03 T010)', () => {
  it('is true for a tree with a published classified page', () => {
    expect(hasPublishedClassifiedPages(tree({ 'README.md': HOME, 'security/audit.md': CLASSIFIED }))).toBe(true);
  });

  it('is false when the only classified page is a draft (positive control: the same page published)', () => {
    const published = tree({ 'README.md': HOME, 'security/audit.md': CLASSIFIED });
    const drafted = tree({ 'README.md': HOME, 'security/audit.md': { ...CLASSIFIED, doc_status: 'draft' } });
    expect(hasPublishedClassifiedPages(published)).toBe(true);
    expect(hasPublishedClassifiedPages(drafted)).toBe(false);
  });

  it('is false for an empty tom_classification list', () => {
    const empty = tree({ 'README.md': HOME, 'security/audit.md': { ...CLASSIFIED, tom_classification: [] } });
    expect(hasPublishedClassifiedPages(empty)).toBe(false);
  });

  it('is false for a tree with no classified page', () => {
    expect(hasPublishedClassifiedPages(tree({ 'README.md': HOME, 'guides/a.md': { title: 'A', doc_status: 'active' } }))).toBe(
      false,
    );
  });

  it('is false when the classified page sits in an excluded folder (positive control: not excluded)', () => {
    const root = tree({ 'README.md': HOME, 'internal/audit.md': CLASSIFIED });
    expect(hasPublishedClassifiedPages(root)).toBe(true);
    registerExcludedFolders(root, ['internal']);
    expect(hasPublishedClassifiedPages(root)).toBe(false);
  });

  it('counts the bundle root page even when it is a draft (the root is never withheld)', () => {
    const root = tree({ 'README.md': { ...HOME, doc_status: 'draft', tom_classification: [{ measure: 'events-logging' }] } });
    expect(hasPublishedClassifiedPages(root)).toBe(true);
  });

  it('honours a custom index basename', () => {
    const root = tree({ 'index.md': HOME, 'security/index.md': CLASSIFIED });
    expect(hasPublishedClassifiedPages(root, 'index')).toBe(true);
  });
});
