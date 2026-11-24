/**
 * The large-hub fixture helpers delete and build only fixture site folders
 * (#341): `writeSite` removes its folder first and `buildSite` runs Astro in it,
 * so both refuse any path that is not an `example/.dk-test-sidebar-cap-*`
 * folder inside this repository.
 */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { REPO_ROOT, siteDir } from './fixtures/large-hub/site.mjs';

describe('siteDir', () => {
  it('accepts a fixture site folder in the repository example/', () => {
    const dir = path.join(REPO_ROOT, 'example', '.dk-test-sidebar-cap-probe');
    expect(path.basename(siteDir(dir))).toBe('.dk-test-sidebar-cap-probe');
  });

  it('refuses a folder without the fixture prefix, or outside example/', () => {
    expect(() => siteDir(path.join(REPO_ROOT, 'example', 'docs'))).toThrow('not a fixture site folder');
    expect(() => siteDir(path.join(REPO_ROOT, 'src', '.dk-test-sidebar-cap-x'))).toThrow('not a fixture site folder');
  });

  it('refuses a fixture-named folder outside the repository', () => {
    expect(() => siteDir(path.join(tmpdir(), 'example', '.dk-test-sidebar-cap-x'))).toThrow('outside the repository');
    expect(() => siteDir(path.join(REPO_ROOT, 'example', '..', '..', 'example', '.dk-test-sidebar-cap-x'))).toThrow(
      'outside the repository',
    );
  });
});
