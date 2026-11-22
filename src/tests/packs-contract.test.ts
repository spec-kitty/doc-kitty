/**
 * The vendored charter packs contract (#330, ADR-0079 D1): its bytes are pinned
 * by `contract.lock.json`. A changed, added or removed file fails, so a snapshot
 * can only move through `pnpm packs:sync-contract`. The hashes are recomputed
 * here as well as in `contract.mjs`, so the test does not trust the code it tests.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VENDORED_CONTRACT_DIR, loadContract, verifyContractLock } from '../lib/packs/contract.mjs';

const SNAPSHOT = fileURLToPath(new URL('../lib/packs/contract/', import.meta.url));
const lock = JSON.parse(readFileSync(path.join(SNAPSHOT, 'contract.lock.json'), 'utf8'));

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = path.join(dir, name);
    return statSync(abs).isDirectory() ? walk(abs, base) : [path.relative(base, abs).split(path.sep).join('/')];
  });
}

const temps: string[] = [];
afterEach(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});
function copy(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-contract-'));
  temps.push(dir);
  cpSync(SNAPSHOT, dir, { recursive: true });
  return dir;
}

describe('the vendored packs contract snapshot', () => {
  it('is pinned to the packs-contract release tag and its commit', () => {
    expect(lock.tag).toBe('contract-packs-v0.1.0-rc.1');
    expect(lock.commit).toBe('69ec326179246c9a79eca1ba1d424f059f5153e2');
    expect(lock.contractPath).toBe('contracts/packs');
  });

  it('holds exactly the locked files, each with its locked sha256', () => {
    const onDisk = walk(SNAPSHOT).filter((f) => f !== 'contract.lock.json').sort();
    expect(onDisk).toEqual(Object.keys(lock.files).sort());
    for (const [file, sha] of Object.entries(lock.files)) {
      expect(createHash('sha256').update(readFileSync(path.join(SNAPSHOT, file))).digest('hex'), file).toBe(sha);
    }
    expect(onDisk).toEqual(
      expect.arrayContaining(['file-kinds.yaml', 'conformance/classifier-cases.yaml', 'schemas/pack-descriptor.schema.json']),
    );
  });

  it('verifies with no problem, and loads', () => {
    expect(verifyContractLock(SNAPSHOT)).toEqual([]);
    const contract = loadContract();
    expect(path.resolve(contract.dir)).toBe(path.resolve(VENDORED_CONTRACT_DIR));
    expect(contract.lock.commit).toBe(lock.commit);
    expect(contract.fileKinds.artifact_kinds).toContain('directive');
    expect(Object.keys(contract.schemas).sort()).toEqual([
      'pack-descriptor',
      'pack-document',
      'pack-manifest',
      'policy',
      'preset',
    ]);
    expect(contract.warnings).toEqual([]);
  });

  it('fails on one changed byte, naming the file', () => {
    const dir = copy();
    const file = path.join(dir, 'file-kinds.yaml');
    const bytes = readFileSync(file);
    bytes[bytes.length - 2] ^= 0x01;
    writeFileSync(file, bytes);
    expect(verifyContractLock(dir).join('\n')).toMatch(/file-kinds\.yaml/);
    expect(() => loadContract(dir)).toThrow(/\[dk-packs\].*file-kinds\.yaml/s);
  });

  it('fails on a file the lock does not list, and on a locked file that is missing', () => {
    const extra = copy();
    writeFileSync(path.join(extra, 'schemas', 'extra.schema.json'), '{}');
    expect(verifyContractLock(extra).join('\n')).toMatch(/schemas\/extra\.schema\.json.*not in the lock/);
    const missing = copy();
    rmSync(path.join(missing, 'schemas', 'policy.schema.json'));
    expect(verifyContractLock(missing).join('\n')).toMatch(/schemas\/policy\.schema\.json.*missing/);
  });

  it('fails when the lock itself is missing or unreadable', () => {
    const dir = copy();
    rmSync(path.join(dir, 'contract.lock.json'));
    expect(verifyContractLock(dir).join('\n')).toMatch(/contract\.lock\.json/);
    writeFileSync(path.join(dir, 'contract.lock.json'), '{not json');
    expect(() => loadContract(dir)).toThrow(/\[dk-packs\]/);
  });

  it('warns on a file-kinds key or content form it does not know, and keeps the rule', () => {
    const dir = copy();
    const fk = path.join(dir, 'file-kinds.yaml');
    const text = readFileSync(fk, 'utf8')
      .replace('  - match: "*/pack.yaml"\n    schema: pack-descriptor\n', '  - match: "*/pack.yaml"\n    schema: pack-descriptor\n    content_form: hologram\n')
      .concat('\nshiny_new_section:\n  - match: "x"\n');
    writeFileSync(fk, text);
    const relock = JSON.parse(readFileSync(path.join(dir, 'contract.lock.json'), 'utf8'));
    relock.files['file-kinds.yaml'] = createHash('sha256').update(readFileSync(fk)).digest('hex');
    writeFileSync(path.join(dir, 'contract.lock.json'), JSON.stringify(relock));
    const contract = loadContract(dir);
    expect(contract.warnings.map((w: { code: string }) => w.code).sort()).toEqual([
      'contract-unknown-content-form',
      'contract-unknown-key',
    ]);
    expect(contract.fileKinds.files[0].content_form).toBe('hologram');
  });
});
