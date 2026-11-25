/**
 * A Chromium that fails to launch must not leave `dockitty-pdf`'s static server open:
 * an open server keeps the process alive, so the CLI would hang instead of exiting 1
 * (confirm review of #462, LOW). A child process calls `printPdfs` with an injected
 * browser type whose launch fails; it must report the error and exit on its own.
 * (Node lists a closed server among its active resources for a while, so counting
 * handles in-process cannot tell open from closed; the exit is the real symptom.)
 */
import { afterEach, describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT = pathToFileURL(fileURLToPath(new URL('../scripts/dockitty-pdf.mjs', import.meta.url))).href;

let dist = '';

afterEach(() => {
  if (dist) rmSync(dist, { recursive: true, force: true });
  dist = '';
});

describe('printPdfs when Chromium fails to launch', () => {
  it('rejects with the launch error, and the process exits instead of hanging', () => {
    dist = mkdtempSync(path.join(tmpdir(), 'dk-pdf-launch-'));
    mkdirSync(path.join(dist, 'print'), { recursive: true });
    writeFileSync(
      path.join(dist, 'print', 'manifest.json'),
      JSON.stringify({ documents: [{ name: 'guides', route: '/doc-kitty/print/guides/', title: 'Guides', pages: 1 }] }),
    );
    const child = `
      const { printPdfs } = await import(${JSON.stringify(SCRIPT)});
      const chromium = { launch: async () => { throw new Error('launch failed'); } };
      try {
        await printPdfs({ dist: ${JSON.stringify(dist)}, base: '/doc-kitty', timeout: 1000 }, { epochSeconds: 0, log: () => {}, chromium });
        console.log('resolved');
      } catch (error) {
        console.log('rejected: ' + error.message);
      }
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', child], { encoding: 'utf8', timeout: 10_000 });
    expect(run.error?.message ?? '', 'the process exits on its own, within 10 s').not.toMatch(/ETIMEDOUT/);
    expect(run.stdout.trim()).toBe('rejected: launch failed');
    expect(run.status).toBe(0);
  });
});
