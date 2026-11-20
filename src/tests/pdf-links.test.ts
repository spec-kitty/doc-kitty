/**
 * Links to PDFs before they exist (ADR-0081, #397): the PDFs are printed after the
 * build, so the link gate accepts a `/pdf/<name>.pdf` the print manifest lists, and
 * only that.
 */
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { expectedPdfRoutes, findBrokenLinks } from '../scripts/assert-no-broken-links.mjs';

function dist(manifest: unknown | undefined) {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-pdf-links-'));
  mkdirSync(path.join(dir, 'guides'), { recursive: true });
  writeFileSync(
    path.join(dir, 'guides', 'index.html'),
    '<html><body><a href="/docs/pdf/guides.pdf">ok</a><a href="/docs/pdf/other.pdf">no</a></body></html>',
  );
  if (manifest !== undefined) {
    mkdirSync(path.join(dir, 'print'));
    writeFileSync(path.join(dir, 'print', 'manifest.json'), JSON.stringify(manifest));
  }
  return dir;
}

describe('the link gate and expected PDFs', () => {
  it('accepts a listed PDF and still fails an unlisted one', () => {
    const d = dist({ version: 1, documents: [{ name: 'guides' }] });
    expect([...expectedPdfRoutes(d)]).toEqual(['/pdf/guides.pdf']);
    expect(findBrokenLinks(d, '/docs').map((f) => f.href)).toEqual(['/docs/pdf/other.pdf']);
  });

  it('accepts none without a print manifest', () => {
    expect(findBrokenLinks(dist(undefined), '/docs').map((f) => f.href)).toEqual(['/docs/pdf/guides.pdf', '/docs/pdf/other.pdf']);
  });
});
