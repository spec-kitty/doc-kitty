/**
 * `pnpm packs:sync-contract` (#330, ADR-0079 D1): refreshes a contract snapshot
 * from a charter checkout at a tag or commit, and rewrites its lock. Exercised
 * against a throwaway git repository; it never touches the network.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/packs-sync-contract.mjs', import.meta.url));
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const temps: string[] = [];
afterEach(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});
function temp(prefix: string) {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.email=t@example.invalid', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], {
    cwd,
    encoding: 'utf8',
  }).trim();

/** A fake charter repository with two commits; the first is tagged. */
function fakeCharter() {
  const repo = temp('dk-charter-');
  git(repo, 'init', '-q');
  mkdirSync(path.join(repo, 'contracts', 'packs', 'schemas'), { recursive: true });
  writeFileSync(path.join(repo, 'contracts/packs/file-kinds.yaml'), 'files: []\n');
  writeFileSync(path.join(repo, 'contracts/packs/schemas/policy.schema.json'), '{"v":1}\n');
  writeFileSync(path.join(repo, 'contracts/packs/schemas/unlisted.schema.json'), '{}\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'one');
  git(repo, 'tag', 'contract-packs-v9.9.9');
  const tagged = git(repo, 'rev-parse', 'HEAD');
  writeFileSync(path.join(repo, 'contracts/packs/file-kinds.yaml'), 'files: [] # two\n');
  git(repo, 'commit', '-q', '-am', 'two');
  const head = git(repo, 'rev-parse', 'HEAD');
  return { repo, tagged, head };
}

/** A snapshot whose lock lists two files (the sync copies exactly the locked list). */
function seededSnapshot() {
  const dir = temp('dk-snapshot-');
  writeFileSync(
    path.join(dir, 'contract.lock.json'),
    JSON.stringify({
      source: 'https://github.com/spec-kitty/spec-kitty-charter',
      contractPath: 'contracts/packs',
      commit: '0'.repeat(40),
      files: { 'file-kinds.yaml': '0'.repeat(64), 'schemas/policy.schema.json': '0'.repeat(64) },
    }),
  );
  return dir;
}

const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

describe('packs-sync-contract', () => {
  it('copies the locked files at a tag and records the tag and its commit', () => {
    const { repo, tagged } = fakeCharter();
    const to = seededSnapshot();
    const res = run('--ref', 'contract-packs-v9.9.9', '--from', repo, '--to', to);
    expect(res.status, res.stderr).toBe(0);
    const lock = JSON.parse(readFileSync(path.join(to, 'contract.lock.json'), 'utf8'));
    expect(lock.tag).toBe('contract-packs-v9.9.9');
    expect(lock.commit).toBe(tagged);
    expect(lock.files).toEqual({
      'file-kinds.yaml': sha('files: []\n'),
      'schemas/policy.schema.json': sha('{"v":1}\n'),
    });
    expect(readFileSync(path.join(to, 'file-kinds.yaml'), 'utf8')).toBe('files: []\n');
    expect(res.stdout).toMatch(/updated\s+file-kinds\.yaml/);
  });

  it('pins a bare commit without a tag, and accepts --commit as an alias of --ref', () => {
    const { repo, head } = fakeCharter();
    const to = seededSnapshot();
    const res = run('--commit', head, '--from', repo, '--to', to);
    expect(res.status, res.stderr).toBe(0);
    const lock = JSON.parse(readFileSync(path.join(to, 'contract.lock.json'), 'utf8'));
    expect(lock.commit).toBe(head);
    expect(lock.tag).toBeUndefined();
    expect(readFileSync(path.join(to, 'file-kinds.yaml'), 'utf8')).toBe('files: [] # two\n');
  });

  it('is a no-op on a snapshot that already matches, and says so', () => {
    const { repo } = fakeCharter();
    const to = seededSnapshot();
    expect(run('--ref', 'contract-packs-v9.9.9', '--from', repo, '--to', to).status).toBe(0);
    const before = readFileSync(path.join(to, 'contract.lock.json'), 'utf8');
    const again = run('--ref', 'contract-packs-v9.9.9', '--from', repo, '--to', to);
    expect(again.status).toBe(0);
    expect(again.stdout).toMatch(/unchanged\s+file-kinds\.yaml/);
    expect(readFileSync(path.join(to, 'contract.lock.json'), 'utf8')).toBe(before);
  });

  it('refuses a branch, HEAD and a short sha: only a tag or a full commit pins provenance', () => {
    const { repo, head } = fakeCharter();
    git(repo, 'branch', 'moving');
    for (const ref of ['moving', 'HEAD', head.slice(0, 7), 'contract-packs-v9.9.9~1', 'contract-packs-v9.9.9^', 'contract-packs-v9.9.9^{commit}']) {
      const to = seededSnapshot();
      const before = readFileSync(path.join(to, 'contract.lock.json'), 'utf8');
      const res = run('--ref', ref, '--from', repo, '--to', to);
      expect(res.status, ref).toBe(1);
      expect(res.stderr).toContain(ref);
      expect(res.stderr).toMatch(/tag or a full 40-character commit/);
      expect(readFileSync(path.join(to, 'contract.lock.json'), 'utf8'), ref).toBe(before);
    }
  });

  it('refuses --ref and --commit together', () => {
    const { repo, head } = fakeCharter();
    const res = run('--ref', 'contract-packs-v9.9.9', '--commit', head, '--from', repo, '--to', seededSnapshot());
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/either --ref or --commit/);
  });

  it('writes nothing when a locked file is missing at the ref', () => {
    const { repo } = fakeCharter();
    const to = seededSnapshot();
    const lockFile = path.join(to, 'contract.lock.json');
    const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
    lock.files['schemas/absent.schema.json'] = '0'.repeat(64);
    writeFileSync(lockFile, JSON.stringify(lock));
    const before = readFileSync(lockFile, 'utf8');
    const res = run('--ref', 'contract-packs-v9.9.9', '--from', repo, '--to', to);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('schemas/absent.schema.json');
    expect(readFileSync(lockFile, 'utf8')).toBe(before);
    expect(() => readFileSync(path.join(to, 'file-kinds.yaml'))).toThrow();
  });

  it('fails without --ref, and on a ref the checkout does not hold', () => {
    const { repo } = fakeCharter();
    expect(run('--from', repo, '--to', seededSnapshot()).status).toBe(2);
    const res = run('--ref', 'no-such-tag', '--from', repo, '--to', seededSnapshot());
    expect(res.status).not.toBe(0);
    expect(res.stderr).toMatch(/no-such-tag/);
  });

  describe('refuses a lock key that could leave the snapshot (#423)', () => {
    /** A charter whose tree holds a file outside contracts/packs, so the read itself would succeed. */
    function charterWithOutsideFile() {
      const { repo } = fakeCharter();
      writeFileSync(path.join(repo, 'contracts/outside.txt'), 'escaped\n');
      git(repo, 'add', '.');
      git(repo, 'commit', '-q', '-m', 'three');
      git(repo, 'tag', 'contract-packs-v9.9.10');
      return repo;
    }

    const badKeys: [string, string][] = [
      ['a ../ key', '../outside.txt'],
      ['a nested ../ key', 'schemas/../../outside.txt'],
      ['an absolute key', '/tmp/dk-escape/outside.txt'],
      ['a backslash key', '..\\outside.txt'],
      ['a ./ segment', './file-kinds.yaml'],
      ['an empty segment', 'schemas//policy.schema.json'],
      ['the lock itself', 'contract.lock.json'],
      ['the lock in another case', 'Contract.Lock.JSON'],
      ['a drive-relative key', 'C:outside.txt'],
    ];

    for (const [label, key] of badKeys) {
      it(`refuses ${label}, names it, and writes nothing`, () => {
        const repo = charterWithOutsideFile();
        const parent = temp('dk-parent-');
        const to = path.join(parent, 'snapshot');
        mkdirSync(to);
        const lockFile = path.join(to, 'contract.lock.json');
        writeFileSync(
          lockFile,
          JSON.stringify({
            source: 'https://github.com/spec-kitty/spec-kitty-charter',
            contractPath: 'contracts/packs',
            commit: '0'.repeat(40),
            files: { 'file-kinds.yaml': '0'.repeat(64), [key]: '0'.repeat(64) },
          }),
        );
        const before = readFileSync(lockFile, 'utf8');
        const res = run('--ref', 'contract-packs-v9.9.10', '--from', repo, '--to', to);
        expect(res.status).toBe(1);
        expect(res.stderr).toContain(JSON.stringify(key));
        expect(readFileSync(lockFile, 'utf8')).toBe(before);
        expect(readdirSync(to)).toEqual(['contract.lock.json']);
        expect(readdirSync(parent)).toEqual(['snapshot']);
      });
    }

    it('accepts a file whose name merely starts with .. (not a traversal)', () => {
      const repo = charterWithOutsideFile();
      writeFileSync(path.join(repo, 'contracts/packs/..notes.yaml'), 'n: 1\n');
      git(repo, 'add', '.');
      git(repo, 'commit', '-q', '-m', 'four');
      git(repo, 'tag', 'contract-packs-v9.9.11');
      const to = seededSnapshot();
      const lockFile = path.join(to, 'contract.lock.json');
      const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
      lock.files['..notes.yaml'] = '0'.repeat(64);
      writeFileSync(lockFile, JSON.stringify(lock));
      const res = run('--ref', 'contract-packs-v9.9.11', '--from', repo, '--to', to);
      expect(res.status, res.stderr).toBe(0);
      expect(readFileSync(path.join(to, '..notes.yaml'), 'utf8')).toBe('n: 1\n');
    });
  });
});
