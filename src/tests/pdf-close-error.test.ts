/**
 * When a print fails and closing the browser then fails too, `printPdfs` must report
 * the print failure, not the close failure: the close error would hide the cause. The
 * close failure still goes to stderr (confirm review of #462, NIT).
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { printPdfs } from '../scripts/dockitty-pdf.mjs';

let dist = '';

function distWith(documents: object[]): string {
  dist = mkdtempSync(path.join(tmpdir(), 'dk-pdf-close-'));
  mkdirSync(path.join(dist, 'print'), { recursive: true });
  writeFileSync(path.join(dist, 'print', 'manifest.json'), JSON.stringify({ documents }));
  return dist;
}

afterEach(() => {
  if (dist) rmSync(dist, { recursive: true, force: true });
  dist = '';
});

const options = (root: string) => ({ dist: root, base: '/doc-kitty', timeout: 1000 });

describe('printPdfs when closing the browser fails', () => {
  it('reports the print failure, not the close failure', async () => {
    const root = distWith([{ name: 'guides', route: '/doc-kitty/print/guides/', title: 'Guides', pages: 1 }]);
    const browser = {
      newContext: async () => Promise.reject(new Error('print failed')),
      close: async () => Promise.reject(new Error('close failed')),
    };
    const chromium = { launch: async () => browser };
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      await expect(printPdfs(options(root), { epochSeconds: 0, log: () => {}, chromium })).rejects.toThrow('print failed');
      // The close failure is not lost: it is written to stderr.
      expect(stderr.mock.calls.map((call) => String(call[0])).join('')).toContain('close failed');
    } finally {
      stderr.mockRestore();
    }
  });
});
