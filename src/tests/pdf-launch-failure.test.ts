/**
 * A Chromium that fails to launch must not leave `dockitty-pdf`'s static server open:
 * an open server keeps the process alive, so the CLI would hang instead of exiting 1
 * (confirm review of #462, LOW). The browser type is injected, and the open TCP servers
 * are counted before and after.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { printPdfs } from '../scripts/dockitty-pdf.mjs';

const openServers = () => process.getActiveResourcesInfo().filter((name) => name === 'TCPServerWrap').length;

let dist = '';

afterEach(() => {
  if (dist) rmSync(dist, { recursive: true, force: true });
  dist = '';
});

describe('printPdfs when Chromium fails to launch', () => {
  it('rejects with the launch error and closes its server', async () => {
    dist = mkdtempSync(path.join(tmpdir(), 'dk-pdf-launch-'));
    mkdirSync(path.join(dist, 'print'), { recursive: true });
    writeFileSync(
      path.join(dist, 'print', 'manifest.json'),
      JSON.stringify({ documents: [{ name: 'guides', route: '/doc-kitty/print/guides/', title: 'Guides', pages: 1 }] }),
    );
    const before = openServers();
    const chromium = { launch: async () => Promise.reject(new Error('launch failed')) };
    await expect(
      printPdfs({ dist, base: '/doc-kitty', timeout: 1000 }, { epochSeconds: 0, log: () => {}, chromium }),
    ).rejects.toThrow('launch failed');
    // Let the close settle: `server.close()` releases its handle on the next turn.
    await new Promise((resolve) => setImmediate(resolve));
    expect(openServers(), 'no server is left open').toBe(before);
  });
});
