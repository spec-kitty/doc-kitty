/**
 * The DK_HUB_DATA file handoff (#342; WP05 review cycle 2, N2 and N4): a missing or
 * corrupt file and a failed write are reported as hub-data errors, never read as
 * "no hubs" (which would silently drop every listing page from the agent surfaces).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readHubData, writeHubData } from '../lib/hub-data-handoff.js';
import { DK_HUB_DATA_ENV, deleteInternalEnv, setInternalEnv } from '../lib/internal-env.mjs';

afterEach(() => deleteInternalEnv(DK_HUB_DATA_ENV));

describe('readHubData errors (N2)', () => {
  it('throws a [dk-hubs] error naming a missing file', () => {
    const missing = path.join(tmpdir(), 'dk-no-such-dir', 'x.hubs.json');
    setInternalEnv(DK_HUB_DATA_ENV, missing);
    expect(() => readHubData()).toThrow(`[dk-hubs] cannot read the hub data handoff ${missing}`);
  });

  it('names DK_HUB_DATA and says to rerun the build (WP06 review, a)', () => {
    const missing = path.join(tmpdir(), 'dk-no-such-dir', 'y.hubs.json');
    setInternalEnv(DK_HUB_DATA_ENV, missing);
    expect(() => readHubData()).toThrow(/named by DK_HUB_DATA.*rerun the build/);
  });

  it('throws a [dk-hubs] error naming a corrupt file', () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'dk-hubs-bad-')), 'bad.hubs.json');
    writeFileSync(file, '{ not json');
    setInternalEnv(DK_HUB_DATA_ENV, file);
    expect(() => readHubData()).toThrow(`[dk-hubs] cannot read the hub data handoff ${file}`);
  });

  it('reads an empty list when there is no handoff', () => {
    deleteInternalEnv(DK_HUB_DATA_ENV);
    expect(readHubData()).toEqual([]);
  });
});

describe('writeHubData errors (N4)', () => {
  it('reports a failed write as a hub-data error', () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'dk-hubs-file-')), 'not-a-dir');
    writeFileSync(file, 'x');
    expect(() => writeHubData(path.join(file, 'cache'), [])).toThrow(/^\[dk-hubs\] cannot write the hub data handoff/);
  });
});
