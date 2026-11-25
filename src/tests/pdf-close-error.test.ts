/**
 * When a print fails and closing the browser then fails too, `printPdfs` must report
 * the print failure, not the close failure: the close error would hide the cause
 * (confirm review of #462, NIT).
 */
import { afterEach, describe, it, expect } from 'vitest';
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
    await expect(printPdfs(options(root), { epochSeconds: 0, log: () => {}, chromium })).rejects.toThrow('print failed');
  });
});
