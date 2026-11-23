/**
 * The open-packs corpus (#330, SC-002, NFR-001): every pack of
 * spec-kitty-open-packs at the pinned commit reads with no error, in under 5 s in
 * total. Run by `pnpm --filter @spec-kitty/doc-toolkit test:packs-corpus` with
 * `DK_OPEN_PACKS_DIR` pointing at a checkout of the pinned commit; CI fetches it
 * (`.github/workflows/ci.yml`, code-quality). It FAILS without the checkout,
 * never skips: the proof must not pass by not running.
 *
 * Warnings are expected and not asserted (they track open-packs and the contract
 * it pins); a summary per pack goes to the log.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { readPack } from '../lib/packs/index.mjs';

const PIN = JSON.parse(readFileSync(new URL('./fixtures/packs-corpus/open-packs.pin.json', import.meta.url), 'utf8')) as {
  repository: string;
  commit: string;
};
const HOW =
  `set DK_OPEN_PACKS_DIR to a checkout of ${PIN.repository} at ${PIN.commit}: ` +
  `git init open-packs && git -C open-packs fetch --depth 1 ${PIN.repository} ${PIN.commit} && git -C open-packs checkout FETCH_HEAD`;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/**
 * The commit a checkout has at HEAD, read from its `.git` files (a detached
 * HEAD, a loose ref or a packed ref), so the test runs no command.
 */
function checkedOutCommit(root: string): string {
  const gitDir = path.join(root, '.git');
  const head = readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
  const ref = /^ref: (.+)$/.exec(head)?.[1];
  if (ref === undefined) return head;
  const loose = path.join(gitDir, ref);
  if (existsSync(loose)) return readFileSync(loose, 'utf8').trim();
  const packed = readFileSync(path.join(gitDir, 'packed-refs'), 'utf8');
  return packed.split('\n').find((line) => line.endsWith(` ${ref}`))?.split(' ')[0] ?? '';
}

describe('every open-packs pack at the pinned commit', () => {
  const root = process.env.DK_OPEN_PACKS_DIR;

  it('has a checkout at the pinned commit', () => {
    expect(root, HOW).toBeTruthy();
    expect(checkedOutCommit(String(root)), HOW).toBe(PIN.commit);
  });

  it('reads with no error, in under 5 s in total', () => {
    expect(root, HOW).toBeTruthy();
    const packsDir = path.join(String(root), 'packs');
    const dirs = readdirSync(packsDir)
      .filter((d) => existsSync(path.join(packsDir, d, 'pack.yaml')))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(dirs.length).toBeGreaterThanOrEqual(19);
    const charterLock = path.join(String(root), 'charter.lock.yaml');
    const start = performance.now();
    for (const dir of dirs) {
      const model = readPack(path.join(packsDir, dir), { charterLock, repoRoot: String(root) });
      expect(model.identity.packId, dir).toMatch(ULID);
      expect(model.identity.version, dir).not.toBe('');
      expect(model.contract.provenAgainst, dir).toMatch(/^[0-9a-f]{40}$/);
      const byCode: Record<string, number> = {};
      for (const p of model.problems) byCode[p.code] = (byCode[p.code] ?? 0) + 1;
      const manifest = model.manifest ? (model.manifest.verified ? 'verified' : 'unverified') : 'no manifest';
      console.log(`${dir}: ${manifest}, inventory from ${model.inventory.source}, warnings ${JSON.stringify(byCode)}`);
    }
    const elapsed = performance.now() - start;
    console.log(`read ${dirs.length} packs in ${Math.round(elapsed)} ms`);
    expect(elapsed).toBeLessThan(5000);
  });
});
