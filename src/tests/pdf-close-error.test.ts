/**
 * When a print fails and closing the browser then fails too, `printPdfs` must report
 * the print failure, not the close failure: the close error would hide the cause. The
 * close failure still goes to stderr. A falsy thrown value is still a failure, and a close
 * failure after a clean print is reported as itself (confirm reviews of #462, NITs).
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { printPdfs } from '../scripts/dockitty-pdf.mjs';
import { fakePdf } from './fixtures/fake-pdf.js';

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

  it('still rejects when the print throws a falsy value', async () => {
    const root = distWith([{ name: 'guides', route: '/doc-kitty/print/guides/', title: 'Guides', pages: 1 }]);
    const chromium = { launch: async () => Promise.reject(0) };
    await expect(printPdfs(options(root), { epochSeconds: 0, log: () => {}, chromium })).rejects.toBe(0);
  });

  it('after a clean print, reports the close failure itself, with the PDF written', async () => {
    const root = distWith([{ name: 'guides', route: '/doc-kitty/print/guides/', title: 'Guides', pages: 1 }]);
    // A page that walks printDocument's happy path. Its evaluate calls come in a fixed
    // order: the loaded theme, the image wait, then the light check.
    const answers: unknown[] = ['light', undefined, { light: true, theme: 'light', background: '', text: '' }];
    const page = {
      emulateMedia: async () => {},
      goto: async () => ({ ok: () => true }),
      evaluate: async () => answers.shift(),
      waitForLoadState: async () => {},
      locator: () => ({ count: async () => 0 }),
      pdf: async () => fakePdf(),
    };
    const context = { addInitScript: async () => {}, newPage: async () => page, close: async () => {} };
    const browser = { newContext: async () => context, close: async () => Promise.reject(new Error('close failed')) };
    const chromium = { launch: async () => browser };
    await expect(printPdfs(options(root), { epochSeconds: 0, log: () => {}, chromium })).rejects.toThrow('close failed');
    expect(existsSync(path.join(root, 'pdf', 'guides.pdf')), 'the PDF was written before the close failed').toBe(true);
  });
});
