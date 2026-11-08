/**
 * The OpenAPI changelog entry must record the user-visible behaviour the
 * mission shipped (pre-PR review fold F8): the #258 entry names the llms.txt
 * operation lines, and also that the raw documents those lines point at are
 * served in `astro dev` too. Without that line a reader would expect the
 * links to 404 until a real build.
 *
 * The entry starts life as the `258-openapi-llms-operations.md` fragment and
 * moves into CHANGELOG.md when `changelog:release` deletes the fragment, so
 * the test reads whichever holds it.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FRAGMENT = fileURLToPath(new URL('../../docs/changelog/unreleased/258-openapi-llms-operations.md', import.meta.url));
const CHANGELOG = fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url));

/** The #258 entry: the fragment while unreleased, else its released bullet. */
function entry258(): string {
  if (existsSync(FRAGMENT)) return readFileSync(FRAGMENT, 'utf8');
  const lines = readFileSync(CHANGELOG, 'utf8').split('\n');
  const start = lines.findIndex((line) => line.startsWith('- ') && line.includes('(#258)'));
  expect(start, 'CHANGELOG.md has no released (#258) entry').toBeGreaterThanOrEqual(0);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => !line.startsWith('  '));
  return [lines[start], ...rest.slice(0, end === -1 ? rest.length : end)].join('\n');
}

describe('openapi changelog entry', () => {
  it('the #258 entry records that the raw documents are served in astro dev', () => {
    expect(entry258()).toContain('served in `astro dev`');
  });
});
