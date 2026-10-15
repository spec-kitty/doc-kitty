import { afterEach, beforeEach } from 'vitest';
import { INTERNAL_ENV_NAMES } from '../../lib/internal-env.mjs';

/**
 * DocKitty's integrations hand values to the loader, routes and CLIs through
 * `process.env` (see `lib/internal-env.mjs`). Call this once at the top of a test
 * file or `describe` that defines or sets any of them: every internal name is
 * snapshotted before each test and put back after it (set again if it had a value,
 * deleted if it was absent), so nothing a test wrote reaches the next one.
 */
export function restoreInternalEnv(): void {
  let saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    saved = Object.fromEntries(INTERNAL_ENV_NAMES.map((name) => [name, process.env[name]]));
  });
  afterEach(() => {
    for (const name of INTERNAL_ENV_NAMES) {
      const value = saved[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}
