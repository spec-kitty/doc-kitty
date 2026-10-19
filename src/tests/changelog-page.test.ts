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
  run,
} from '../scripts/assert-changelog-page.mjs';

const CHANGELOG = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '## [0.4.0] — 2026-10-18',
  '### Added',
  '## [0.3.0] — 2026-10-14',
  '## [0.1.0] — 2026-09-09',
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
    const { dist, changelog } = fixture('<h2>[0.4.0] — x</h2><h2><a>0.3.0</a></h2><h2>0.1.0</h2>');
    expect(run(['node', 'gate', dist, '--changelog', changelog])).toBe(0);
  });

  it('fails when the page stops at an older release', () => {
    const { dist, changelog } = fixture('<h2>v0.1.0 — 2026-08-21</h2>');
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

  it('leaves absolute, anchor and root-relative links alone', () => {
    const src = '[a](https://x.y/z) [b](#top) [c](/abs/) [d](mailto:q@r.s)';
    expect(changelogBody(src, base)).toBe(src);
  });
});
