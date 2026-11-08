/**
 * `twoBuilds` must surface a failed build as the build's own output, not as an
 * ENOENT from reading a `dist` that was never written.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { removeOpenApiFixtureBuilds, twoBuilds } from './helpers/openapi-build';

afterAll(() => removeOpenApiFixtureBuilds());

describe('twoBuilds on a failing build', () => {
  it('throws with the build output, not ENOENT', () => {
    let message = '';
    try {
      twoBuilds({
        fixture: 'two-versions',
        openapi: { specs: [{ path: 'openapi/does-not-exist.yaml', label: 'v1', released: true }] },
      });
    } catch (error) {
      message = String(error instanceof Error ? error.message : error);
    }
    expect(message).toMatch(/build failed/i);
    expect(message).toContain('[dk-openapi]');
    expect(message).not.toContain('ENOENT');
  }, 180_000);
});
