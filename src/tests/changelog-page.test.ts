/**
 * The on-site changelog gate (#192): every `## [x.y.z]` heading of
 * CHANGELOG.md must appear as an `<h2>` on the built changelog page.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  releaseVersions,
  h2Texts,
  missingReleases,
  missingBodies,
  releaseSections,
  run,
} from '../scripts/assert-changelog-page.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '## [0.4.0] — 2026-10-18',
  '### Added',
  '- **Shared links show a `full` card** on [Slack](https://slack.com) (#180).',
  '## [0.3.0] — 2026-10-14',
  'Intro paragraph for "three" -- with smart punctuation.',
  '## [0.1.0] — 2026-09-09',
  '- First tagged release.',
  '',
].join('\n');

const tmpDirs: string[] = [];
afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

function fixture(html: string | null): { dist: string; changelog: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'changelog-page-'));
  tmpDirs.push(dir);
  const changelog = path.join(dir, 'CHANGELOG.md');
  writeFileSync(changelog, CHANGELOG);
  const dist = path.join(dir, 'dist');
  if (html !== null) {
    mkdirSync(path.join(dist, 'changelog', 'releases'), { recursive: true });
    writeFileSync(path.join(dist, 'changelog', 'releases', 'index.html'), html);
  } else {
    mkdirSync(dist, { recursive: true });
  }
  return { dist, changelog };
}

const FULL_PAGE = [
  '<h2>[0.4.0] — x</h2><ul><li><strong>Shared links show a <code>full</code> card</strong> on <a href="#">Slack</a> (#180).</li></ul>',
  '<h2><a>0.3.0</a></h2><p>Intro paragraph for &#x201C;three&#x201D; – with smart punctuation.</p>',
  '<h2>0.1.0</h2><ul><li>First tagged release.</li></ul>',
].join('');

describe('changelog page gate (#192)', () => {
  it('reads the released versions, skipping [Unreleased]', () => {
    expect(releaseVersions(CHANGELOG)).toEqual(['0.4.0', '0.3.0', '0.1.0']);
  });

  it('extracts h2 text with nested markup stripped', () => {
    expect(h2Texts('<h2 id="x"><a href="#">0.4.0</a> — 2026</h2><h3>0.3.0</h3>')).toEqual(['0.4.0 — 2026']);
  });

  it('reports a release missing from the page, and does not match a prefix', () => {
    const html = '<h2>[0.4.0] — 2026-10-18</h2><h2>[0.10.0]</h2>';
    expect(missingReleases(CHANGELOG.replace('0.3.0', '0.1.0'), html)).toEqual(['0.1.0', '0.1.0']);
    expect(missingReleases(CHANGELOG, html)).toEqual(['0.3.0', '0.1.0']);
  });

  it('passes when every release has an h2', () => {
    const { dist, changelog } = fixture(FULL_PAGE);
    expect(run(['node', 'gate', dist, '--changelog', changelog])).toBe(0);
  });

  it('fails when the page stops at an older release', () => {
    const { dist, changelog } = fixture('<h2>v0.1.0 — 2026-08-21</h2>');
    expect(run(['node', 'gate', dist, '--changelog', changelog])).toBe(1);
  });

  it('takes the first entry of each release section as its body sample', () => {
    expect(releaseSections(CHANGELOG)).toEqual([
      { version: '0.4.0', sample: 'Shared links show a full card on Slack (#180).' },
      { version: '0.3.0', sample: 'Intro paragraph for "three" -- with smart punctuation.' },
      { version: '0.1.0', sample: 'First tagged release.' },
    ]);
  });

  it('reports a release whose body is missing although its heading is there', () => {
    const headingsOnly = '<h2>[0.4.0] — x</h2><h2>0.3.0</h2><h2>0.1.0</h2>';
    expect(missingBodies(CHANGELOG, headingsOnly)).toEqual(['0.4.0', '0.3.0', '0.1.0']);
    expect(missingBodies(CHANGELOG, FULL_PAGE)).toEqual([]);
  });

  it('fails the CLI when the bodies were dropped', () => {
    const { dist, changelog } = fixture('<h2>[0.4.0] — x</h2><h2>0.3.0</h2><h2>0.1.0</h2>');
    expect(run(['node', 'gate', dist, '--changelog', changelog])).toBe(1);
  });

  it('fails when the page was not built', () => {
    const { dist, changelog } = fixture(null);
    expect(run(['node', 'gate', dist, '--changelog', changelog])).toBe(1);
  });
});

describe('changelogBody (#192)', async () => {
  const { changelogBody } = await import('../../example/src/changelog-loader.ts');
  const base = 'https://github.com/o/r/blob/main/';

  it('drops the H1 and points repo-relative links at the repository', () => {
    const out = changelogBody('# Changelog\n\nIntro [g](docs/a.md#x) [s](./setup.md).\n\n## [0.1.0]\n', base);
    expect(out.startsWith('Intro')).toBe(true);
    expect(out).toContain('[g](https://github.com/o/r/blob/main/docs/a.md#x)');
    expect(out).toContain('[s](https://github.com/o/r/blob/main/setup.md)');
  });

  it('leaves link syntax inside fenced code blocks and inline code alone', () => {
    const src = [
      'See [a](docs/a.md) and `[b](docs/b.md)` and ``x [c](docs/c.md) y``.',
      '',
      '```md',
      '[d](docs/d.md)',
      '```',
      '',
      '~~~',
      '[e](docs/e.md)',
      '~~~',
      '',
      '[f](docs/f.md)',
    ].join('\n');
    const out = changelogBody(src, base);
    expect(out).toContain('[a](https://github.com/o/r/blob/main/docs/a.md)');
    expect(out).toContain('`[b](docs/b.md)`');
    expect(out).toContain('``x [c](docs/c.md) y``');
    expect(out).toContain('\n[d](docs/d.md)\n');
    expect(out).toContain('\n[e](docs/e.md)\n');
    expect(out).toContain('[f](https://github.com/o/r/blob/main/docs/f.md)');
  });

  it('leaves absolute, anchor and root-relative links alone', () => {
    const src = '[a](https://x.y/z) [b](#top) [c](/abs/) [d](mailto:q@r.s)';
    expect(changelogBody(src, base)).toBe(src);
  });
});
