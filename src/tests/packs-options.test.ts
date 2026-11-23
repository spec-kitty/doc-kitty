/**
 * The `packs` option (#330, ADR-0079 D2): `charterLock` and `contract`,
 * validated eagerly with `[dk-packs]` errors. Pack pages and their keys arrive
 * with #338.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import { resolvePacksOptions } from '../lib/packs/options.mjs';

vi.mock('../lib/glossary/load.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/glossary/load.js')>();
  return { ...actual, isGlossaryActive: () => false };
});
const { defineDocKittyIntegrations } = await import('../lib/config.js');
restoreInternalEnv();

const SNAPSHOT = fileURLToPath(new URL('../lib/packs/contract/', import.meta.url));
const temps: string[] = [];
afterEach(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});
function temp() {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-packs-opt-'));
  temps.push(dir);
  return dir;
}

describe('resolvePacksOptions', () => {
  it('resolves both keys against the site root', () => {
    const cwd = temp();
    cpSync(SNAPSHOT, path.join(cwd, 'snapshot'), { recursive: true });
    expect(resolvePacksOptions({ charterLock: '../charter.lock.yaml', contract: 'snapshot' }, { cwd })).toEqual({
      charterLock: path.resolve(cwd, '../charter.lock.yaml'),
      contract: path.join(cwd, 'snapshot'),
    });
    expect(resolvePacksOptions({}, { cwd })).toEqual({});
  });

  it('does not require the charter lock to exist at config time', () => {
    expect(resolvePacksOptions({ charterLock: 'nowhere.yaml' }, { cwd: temp() }).charterLock).toMatch(/nowhere\.yaml$/);
  });

  it('refuses a non-object, an unknown key, and a non-string or empty path', () => {
    expect(() => resolvePacksOptions(true)).toThrow('[dk-packs] the packs option must be an object');
    expect(() => resolvePacksOptions(['x'])).toThrow('[dk-packs] the packs option must be an object');
    expect(() => resolvePacksOptions({ sources: ['../packs'] })).toThrow(/\[dk-packs\] unknown key "sources".*#338/);
    expect(() => resolvePacksOptions({ charterLock: 3 })).toThrow('[dk-packs] packs.charterLock must be a non-empty path string');
    expect(() => resolvePacksOptions({ contract: '  ' })).toThrow('[dk-packs] packs.contract must be a non-empty path string');
  });

  it('checks a contract snapshot eagerly: a directory whose lock holds', () => {
    const cwd = temp();
    expect(() => resolvePacksOptions({ contract: 'absent' }, { cwd })).toThrow(/\[dk-packs\] packs\.contract .* is not a directory/);
    const bad = path.join(cwd, 'bad');
    cpSync(SNAPSHOT, bad, { recursive: true });
    const file = path.join(bad, 'schemas', 'policy.schema.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace('"open"', '"opened"'));
    expect(() => resolvePacksOptions({ contract: 'bad' }, { cwd })).toThrow(/\[dk-packs\].*schemas\/policy\.schema\.json/s);
  });
});

describe('defineDocKittyIntegrations({ packs })', () => {
  it('fails at config time on a bad packs option', () => {
    expect(() => defineDocKittyIntegrations({ title: 'Docs', packs: { bogus: 1 } as never })).toThrow(/\[dk-packs\] unknown key "bogus"/);
  });

  it('accepts a valid packs option', () => {
    expect(() => defineDocKittyIntegrations({ title: 'Docs', packs: { charterLock: '../charter.lock.yaml' } })).not.toThrow();
  });
});
