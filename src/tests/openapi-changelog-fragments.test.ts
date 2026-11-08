/**
 * The OpenAPI changelog fragments must record the user-visible behaviour
 * the mission shipped (pre-PR review fold F8): the 258 fragment names the
 * llms.txt operation lines, but not that the raw documents those lines point
 * at are served in `astro dev` too — without that line a reader would expect
 * the links to 404 until a real build.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FRAGMENT = fileURLToPath(new URL('../../docs/changelog/unreleased/258-openapi-llms-operations.md', import.meta.url));
const fragment = readFileSync(FRAGMENT, 'utf8');

describe('openapi changelog fragments', () => {
  it('the 258 fragment records that the raw documents are served in astro dev', () => {
    expect(fragment).toContain('served in `astro dev`');
  });
});
