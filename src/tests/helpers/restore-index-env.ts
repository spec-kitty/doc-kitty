import { afterEach } from 'vitest';
import { DK_INDEX_BASENAME_ENV } from '../../lib/vocabulary-core.mjs';

/**
 * `defineDocKittyIntegrations` publishes the site's index names in
 * `DK_INDEX_BASENAME`. Call this once at the top of a test file that calls it, so
 * the value a test set is put back after each test and never reaches the next one.
 */
export function restoreIndexBasenameEnv(): void {
  const original = process.env[DK_INDEX_BASENAME_ENV];
  afterEach(() => {
    if (original === undefined) delete process.env[DK_INDEX_BASENAME_ENV];
    else process.env[DK_INDEX_BASENAME_ENV] = original;
  });
}
