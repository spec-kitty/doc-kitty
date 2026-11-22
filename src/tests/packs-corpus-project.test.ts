/**
 * The open-packs corpus (#330) needs a checkout fetched by CI, so the default
 * test run must not include it: `pnpm test` stays offline. Only
 * `test:packs-corpus` (which sets DK_PACKS_CORPUS=1) registers the project.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const list = (env: Record<string, string | undefined>) =>
  spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'list', '--filesOnly'], {
    cwd: SRC,
    encoding: 'utf8',
    env: { ...process.env, DK_PACKS_CORPUS: undefined, ...env },
  });

describe('the packs-corpus project', () => {
  it('is not part of the default run', () => {
    const res = list({});
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).not.toContain('packs-open-packs.corpus.ts');
    expect(res.stdout).toContain('packs-read.test.ts');
  });

  it('is registered when DK_PACKS_CORPUS=1, which test:packs-corpus sets', () => {
    expect(list({ DK_PACKS_CORPUS: '1' }).stdout).toContain('packs-open-packs.corpus.ts');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.scripts['test:packs-corpus']).toBe('DK_PACKS_CORPUS=1 vitest run --project packs-corpus');
  });
});
