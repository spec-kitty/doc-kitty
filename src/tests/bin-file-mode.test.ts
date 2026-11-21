/**
 * Every `bin` target of the published package is committed executable (#398).
 *
 * pnpm makes a workspace package's bin targets executable at install time. A
 * target tracked as `100644` then shows as modified after `pnpm install`, and a
 * contributor who commits with `git add -A` commits the mode change. Tracking
 * them as `100755` keeps a clean install from touching the working tree.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SRC = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(SRC, 'package.json'), 'utf8')) as { bin: Record<string, string> };
const targets = Object.values(manifest.bin).map((target) => path.posix.join('src', target.replace(/^\.\//, '')));

/** The git index entries (`<mode> <object> <stage>\t<path>`), or null outside a git checkout. */
function indexModes(): Map<string, string> | null {
  const result = spawnSync('git', ['ls-files', '-s', '--', ...targets], { cwd: path.join(SRC, '..'), encoding: 'utf8' });
  if (result.status !== 0) return null;
  const modes = new Map<string, string>();
  for (const line of result.stdout.split('\n').filter(Boolean)) {
    const [meta, file] = line.split('\t');
    modes.set(file, meta.split(' ')[0]);
  }
  return modes;
}

const modes = indexModes();

describe.skipIf(modes === null)('bin targets are committed executable (#398)', () => {
  it('control: the manifest declares bin targets', () => {
    expect(targets.length).toBeGreaterThan(0);
  });

  it.each(targets)('%s is tracked as 100755 and starts with a node shebang', (target) => {
    expect(modes?.get(target), `${target} is not tracked`).toBeDefined();
    expect(modes?.get(target), `run: git update-index --chmod=+x ${target}`).toBe('100755');
    expect(readFileSync(path.join(SRC, '..', target), 'utf8').startsWith('#!/usr/bin/env node\n')).toBe(true);
  });
});
