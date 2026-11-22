/**
 * `dockitty-read-pack` (#330): prints one `PackModel`, as JSON or as a summary.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/read-pack.mjs', import.meta.url));
const ALPHA = fileURLToPath(new URL('./fixtures/packs/with-manifest/alpha', import.meta.url));
const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

const temps: string[] = [];
afterEach(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('dockitty-read-pack', () => {
  it('prints the model as JSON', () => {
    const res = run(ALPHA, '--json');
    expect(res.status, res.stderr).toBe(0);
    const model = JSON.parse(res.stdout);
    expect(model.dir).toBe('alpha');
    expect(model.manifest.verified).toBe(true);
    expect(res.stdout.endsWith('}\n')).toBe(true);
  });

  it('prints a summary with the inventory and its source', () => {
    const res = run(ALPHA);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('alpha-pack (alpha) 1.2.0 org');
    expect(res.stdout).toContain('inventory (from manifest): 3 artefact(s)');
    expect(res.stdout).toContain('manifest: verified');
    expect(res.stdout).toMatch(/0 warning\(s\)\n$/);
  });

  it('reports a charter lock mismatch as a warning, exit 0', () => {
    // The lock lives in the repository, beside the packs, as open-packs' does.
    const dir = mkdtempSync(path.join(path.dirname(ALPHA), '.dk-read-pack-'));
    temps.push(dir);
    writeFileSync(path.join(dir, 'charter.lock.yaml'), `commit: ${'e'.repeat(40)}\n`);
    const res = run(ALPHA, '--charter-lock', path.join(dir, 'charter.lock.yaml'));
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('warning [charter-lock-mismatch]');
    expect(res.stdout).toContain(`proven against ${'e'.repeat(40)}`);
  });

  it('refuses a pack, lock or contract outside the repository root (ADR-0079 D5)', () => {
    const outside = mkdtempSync(path.join(tmpdir(), 'dk-read-pack-outside-'));
    temps.push(outside);
    cpSync(ALPHA, path.join(outside, 'alpha'), { recursive: true });
    writeFileSync(path.join(outside, 'charter.lock.yaml'), `commit: ${'e'.repeat(40)}\n`);
    for (const args of [[path.join(outside, 'alpha')], [ALPHA, '--charter-lock', path.join(outside, 'charter.lock.yaml')], [ALPHA, '--contract', outside]]) {
      const res = run(...args);
      expect(res.status, args.join(' ')).toBe(2);
      expect(res.stderr).toMatch(/outside the repository root/);
    }
    // --repo-root widens the root on purpose.
    const ok = run(path.join(outside, 'alpha'), '--repo-root', outside, '--json');
    expect(ok.status, ok.stderr).toBe(0);
    expect(JSON.parse(ok.stdout).path).toBe('alpha');
  });

  it('exits 2 on a usage error, a directory that is not a pack, and a broken contract', () => {
    expect(run().status).toBe(2);
    expect(run(ALPHA, '--frobnicate').status).toBe(2);
    const notPack = run(path.dirname(ALPHA));
    expect(notPack.status).toBe(2);
    expect(notPack.stderr).toContain('not a pack directory');
    const badContract = run(ALPHA, '--contract', path.dirname(ALPHA));
    expect(badContract.status).toBe(2);
    expect(badContract.stderr).toContain('[dk-packs]');
  });
});
