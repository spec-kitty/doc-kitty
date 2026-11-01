/**
 * Changelog fragments (ADR-0072): a PR adds one file under `docs/changelog/unreleased/`
 * instead of editing the shared `## [Unreleased]` section of CHANGELOG.md.
 * `src/scripts/changelog.mjs` checks the fragments per PR, shows them as
 * `[Unreleased]` on the site, and writes them into a version section at
 * release time, keeping the Keep a Changelog shape the release gates read.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseFragment,
  readFragments,
  renderUnreleased,
  withUnreleased,
  releaseChangelog,
  changelogProblems,
  applyRelease,
  UNRELEASED_NOTE,
} from '../scripts/changelog.mjs';
import { releaseVersions, unparsableHeadings, unprobeableBodies } from '../scripts/assert-changelog-page.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/changelog.mjs', import.meta.url));
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const URL_BASE = 'https://github.com/spec-kitty/doc-kitty';

const CHANGELOG = [
  '# Changelog',
  '',
  'Intro.',
  '',
  '## [Unreleased]',
  '',
  UNRELEASED_NOTE,
  '',
  '## [0.5.0] — 2026-10-25',
  '',
  '### Added',
  '',
  '- **Old entry (#200).** Stays byte for byte.',
  '',
  `[Unreleased]: ${URL_BASE}/compare/v0.5.0...HEAD`,
  `[0.5.0]: ${URL_BASE}/compare/v0.4.0...v0.5.0`,
  '',
].join('\n');

const frag = (section: string, body: string) => `---\nsection: ${section}\n---\n\n${body}\n`;

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function tree(fragments: Record<string, string>, changelog = CHANGELOG) {
  const root = mkdtempSync(path.join(tmpdir(), 'changelog-fragments-'));
  dirs.push(root);
  const dir = path.join(root, 'docs/changelog/unreleased');
  mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(fragments)) writeFileSync(path.join(dir, name), text);
  writeFileSync(path.join(root, 'CHANGELOG.md'), changelog);
  return { root, dir, changelog: path.join(root, 'CHANGELOG.md') };
}

function cli(args: string[], cwd: string) {
  try {
    return { code: 0, out: execFileSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string };
    return { code: e.status, out: `${e.stdout}${e.stderr}` };
  }
}

describe('parseFragment — one fragment file', () => {
  it('reads the section, the number and the bullet body', () => {
    const f = parseFragment('250-github-alerts.md', frag('Added', '- **Alerts render as asides (#250).** Now.'));
    expect(f).toEqual({
      name: '250-github-alerts.md',
      number: 250,
      section: 'Added',
      body: '- **Alerts render as asides (#250).** Now.',
    });
  });

  it('accepts a name without a number', () => {
    expect(parseFragment('json-diagram-size.md', frag('Changed', '- A change.')).number).toBeNull();
  });

  it.each([
    ['Breaking'],
    ['Added'],
    ['Changed'],
    ['Deprecated'],
    ['Removed'],
    ['Fixed'],
    ['Security'],
    ['Documentation'],
  ])('accepts the section %s', (section) => {
    expect(parseFragment('1-x.md', frag(section, '- x')).section).toBe(section);
  });

  it.each([
    ['Upper-Case.md', 'kebab-case'],
    ['250_github.md', 'kebab-case'],
    ['250-x.txt', 'kebab-case'],
  ])('rejects the file name %j', (name, message) => {
    expect(() => parseFragment(name, frag('Added', '- x'))).toThrow(message);
  });

  it.each([
    ['no frontmatter', '- x\n', /frontmatter/],
    ['an unknown section', frag('Improved', '- x'), /section "Improved" is not one of/],
    ['a missing section', '---\n---\n\n- x\n', /needs a "section"/],
    ['an unknown key', '---\nsection: Added\nissue: 4\n---\n\n- x\n', /unknown key "issue"/],
    ['a repeated key', '---\nsection: Added\nsection: Fixed\n---\n\n- x\n', /"section" is given twice/],
    ['an empty body', frag('Added', ''), /empty/],
    ['a body that is not a bullet', frag('Added', 'Prose first.'), /must start with a "- " bullet/],
    ['a heading in the body', frag('Added', '- x\n\n## [0.6.0]'), /heading/],
  ])('rejects %s', (_label, text, message) => {
    expect(() => parseFragment('1-x.md', text)).toThrow(message);
  });
});

describe('readFragments — the docs/changelog/unreleased folder', () => {
  it('orders numbered fragments by number, then unnumbered ones by name, and skips README.md', () => {
    const { dir } = tree({
      'README.md': '# How to write a fragment\n',
      'zeta.md': frag('Changed', '- zeta'),
      '250-b.md': frag('Added', '- 250'),
      '9-a.md': frag('Added', '- 9'),
      'alpha.md': frag('Added', '- alpha'),
    });
    expect(readFragments(dir).map((f) => f.name)).toEqual(['9-a.md', '250-b.md', 'alpha.md', 'zeta.md']);
  });

  it('reports every bad fragment at once', () => {
    const { dir } = tree({ '1-a.md': frag('Nope', '- a'), '2-b.md': 'no frontmatter' });
    expect(() => readFragments(dir)).toThrow(/1-a\.md[\s\S]*2-b\.md/);
  });

  it('treats a missing folder as no fragments', () => {
    expect(readFragments(path.join(tmpdir(), 'no-such-changelog-d'))).toEqual([]);
  });
});

describe('renderUnreleased — the sections, in Keep a Changelog order', () => {
  it('groups by section in canonical order, with the breaking heading as published', () => {
    const md = renderUnreleased([
      parseFragment('3-c.md', frag('Fixed', '- fixed')),
      parseFragment('1-a.md', frag('Added', '- added one')),
      parseFragment('2-b.md', frag('Breaking', '- breaking')),
      parseFragment('4-d.md', frag('Added', '- added two')),
    ]);
    expect(md).toBe(
      ['### 💥 Breaking', '', '- breaking', '', '### Added', '', '- added one', '', '- added two', '', '### Fixed', '', '- fixed'].join(
        '\n',
      ),
    );
  });

  it('is empty with no fragments', () => {
    expect(renderUnreleased([])).toBe('');
  });
});

describe('withUnreleased — what the site renders', () => {
  it('fills [Unreleased] with the fragments and drops the note', () => {
    const out = withUnreleased(CHANGELOG, [parseFragment('7-x.md', frag('Added', '- **New (#7).**'))]);
    expect(out).toContain('## [Unreleased]\n\n### Added\n\n- **New (#7).**\n\n## [0.5.0] — 2026-10-25');
    expect(out).not.toContain(UNRELEASED_NOTE);
  });

  it('leaves everything after [Unreleased] byte for byte', () => {
    const out = withUnreleased(CHANGELOG, [parseFragment('7-x.md', frag('Added', '- x'))]);
    const tail = CHANGELOG.slice(CHANGELOG.indexOf('## [0.5.0]'));
    expect(out.endsWith(tail)).toBe(true);
  });
});

describe('releaseChangelog — cutting a version', () => {
  const fragments = () => [
    parseFragment('7-x.md', frag('Added', '- **New (#7).** Now.')),
    parseFragment('8-y.md', frag('Fixed', '- **Fix (#8).** Now.')),
  ];

  it('writes a version section under [Unreleased], keeps the note, and keeps history byte for byte', () => {
    const out = releaseChangelog(CHANGELOG, fragments(), { version: '0.6.0', date: '2026-11-02' });
    expect(out).toContain(
      `## [Unreleased]\n\n${UNRELEASED_NOTE}\n\n## [0.6.0] — 2026-11-02\n\n### Added\n\n- **New (#7).** Now.\n\n### Fixed\n\n- **Fix (#8).** Now.\n\n## [0.5.0] — 2026-10-25`,
    );
    const history = CHANGELOG.slice(CHANGELOG.indexOf('## [0.5.0]'), CHANGELOG.indexOf('[Unreleased]: '));
    expect(out).toContain(history);
  });

  it('moves the compare links: [Unreleased] from the new tag, and a link for the new version', () => {
    const out = releaseChangelog(CHANGELOG, fragments(), { version: '0.6.0', date: '2026-11-02' });
    expect(out.endsWith(
      [
        `[Unreleased]: ${URL_BASE}/compare/v0.6.0...HEAD`,
        `[0.6.0]: ${URL_BASE}/compare/v0.5.0...v0.6.0`,
        `[0.5.0]: ${URL_BASE}/compare/v0.4.0...v0.5.0`,
        '',
      ].join('\n'),
    )).toBe(true);
  });

  // The release workflow and the on-site gate read the result: keep them passing.
  it('produces a heading the release workflow grep and the on-site gate both accept', () => {
    const out = releaseChangelog(CHANGELOG, fragments(), { version: '0.6.0-rc.1', date: '2026-11-02' });
    expect(out).toMatch(/^## \[0\.6\.0-rc\.1\]/m); // release.yml: grep -qE "^## \[$VERSION_RE\]"
    expect(releaseVersions(out)).toEqual(['0.6.0-rc.1', '0.5.0']);
    expect(unparsableHeadings(out)).toEqual([]);
    // The on-site gate probes each release's first entry: it must be probeable.
    expect(unprobeableBodies(out)).toEqual([]);
  });

  it.each([
    [{ version: '0.5.0', date: '2026-11-02' }, /already has a "## \[0\.5\.0\]" section/],
    [{ version: 'v0.6.0', date: '2026-11-02' }, /not a version/],
    [{ version: '0.6.0', date: '2 Nov' }, /not a YYYY-MM-DD date/],
  ])('refuses %j', (opts, message) => {
    expect(() => releaseChangelog(CHANGELOG, fragments(), opts)).toThrow(message);
  });

  it('refuses a release with no fragments', () => {
    expect(() => releaseChangelog(CHANGELOG, [], { version: '0.6.0', date: '2026-11-02' })).toThrow(/no fragments/);
  });

  it('refuses when the [Unreleased] compare link is missing', () => {
    const bare = CHANGELOG.replace(/^\[Unreleased\]:.*\n/m, '');
    expect(() => releaseChangelog(bare, fragments(), { version: '0.6.0', date: '2026-11-02' })).toThrow(
      /\[Unreleased\]: .*compare/,
    );
  });
});

describe('changelogProblems — the per-PR gate on CHANGELOG.md', () => {
  const ENTRIES = /entries under \[Unreleased\]/;
  const bare = (between: string) =>
    `# Changelog\n\n## [Unreleased]\n\n${UNRELEASED_NOTE}\n${between}\n[Unreleased]: ${URL_BASE}/compare/v0.5.0...HEAD\n`;
  it.each([
    ['passes a CHANGELOG whose [Unreleased] holds only the note', CHANGELOG, /^$/],
    ['passes a first release-less CHANGELOG with only the compare link', bare(''), /^$/],
    [
      'fails an entry written straight under [Unreleased]',
      CHANGELOG.replace(UNRELEASED_NOTE, `${UNRELEASED_NOTE}\n\n### Added\n\n- **Hand edit (#9).**`),
      /\[Unreleased\].*docs\/changelog\/unreleased\//,
    ],
    ['fails a CHANGELOG with no [Unreleased] section', CHANGELOG.replace('## [Unreleased]', '## Next'), /no "## \[Unreleased\]"/],
    [
      'fails an entry hidden after a link reference inside [Unreleased]',
      CHANGELOG.replace(UNRELEASED_NOTE, `${UNRELEASED_NOTE}\n\n[x]: https://x.example\n\n- sneaky entry`),
      ENTRIES,
    ],
    ['fails a stray link reference above the closing compare link when no release follows', bare('\n[foo]: http://x'), ENTRIES],
  ])('%s', (_label, changelog, message) => {
    expect(changelogProblems(changelog).join('\n')).toMatch(message);
  });
});

describe('the CLI', () => {
  it('--check passes good fragments and a clean CHANGELOG', () => {
    const { root } = tree({ '7-x.md': frag('Added', '- x') });
    const r = cli(['--check'], root);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/1 fragment/);
  });

  it('--check fails a bad fragment and names it', () => {
    const { root } = tree({ '7-x.md': frag('Nope', '- x') });
    const r = cli(['--check'], root);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/7-x\.md/);
  });

  it('--check fails a hand edit under [Unreleased]', () => {
    const { root } = tree({}, CHANGELOG.replace(UNRELEASED_NOTE, '### Added\n\n- hand edit'));
    expect(cli(['--check'], root).code).toBe(1);
  });

  it('--preview prints the assembled [Unreleased] without writing', () => {
    const { root, changelog } = tree({ '7-x.md': frag('Added', '- **New (#7).**') });
    const r = cli(['--preview'], root);
    expect(r.code).toBe(0);
    expect(r.out).toContain('## [Unreleased]\n\n### Added\n\n- **New (#7).**');
    expect(readFileSync(changelog, 'utf8')).toBe(CHANGELOG);
  });

  it('--release writes the version section and deletes the released fragments, keeping README.md', () => {
    const { root, dir, changelog } = tree({
      'README.md': '# Fragments\n',
      '7-x.md': frag('Added', '- **New (#7).**'),
    });
    const r = cli(['--release', '0.6.0', '--date', '2026-11-02'], root);
    expect(r.code).toBe(0);
    expect(readFileSync(changelog, 'utf8')).toContain('## [0.6.0] — 2026-11-02\n\n### Added\n\n- **New (#7).**');
    expect(readdirSync(dir)).toEqual(['README.md']);
  });

  it('--release changes nothing when it refuses', () => {
    const { root, dir, changelog } = tree({ '7-x.md': frag('Added', '- x') });
    expect(cli(['--release', '0.5.0', '--date', '2026-11-02'], root).code).toBe(1);
    expect(readFileSync(changelog, 'utf8')).toBe(CHANGELOG);
    expect(existsSync(path.join(dir, '7-x.md'))).toBe(true);
  });
});

describe("this repository's own changelog", () => {
  it('has a clean [Unreleased] and valid fragments (pnpm validate:changelog)', () => {
    const r = cli(['--check'], REPO);
    expect(r.out).toMatch(/OK/);
    expect(r.code).toBe(0);
  });
});

// Pre-PR review findings (ADR-0072 landing): each case failed before its fix.
describe('review: fragment parsing edge cases', () => {
  it('accepts a byte-order mark and trailing spaces on the fence lines', () => {
    expect(parseFragment('1-x.md', '\uFEFF---  \nsection: Added\n---\t\n\n- x\n').section).toBe('Added');
  });

  it('rejects a fence glued to the last frontmatter line', () => {
    expect(() => parseFragment('1-x.md', '---\nsection: Added---\n\n- x\n')).toThrow(/frontmatter/);
  });

  it('allows a heading-like line inside a fenced code block', () => {
    expect(parseFragment('1-x.md', frag('Added', '- x:\n\n```md\n## [0.6.0]\n```')).section).toBe('Added');
  });

  it.each([
    ['an indented heading', '- x\n\n   ## y', /heading/],
    ['a setext heading (---)', '- x\n\nTitle\n---', /heading/],
    ['a setext heading (===)', '- x\n\nTitle\n===', /heading/],
    ['an unclosed code fence', '- x\n\n  ```js\n  const a = 1;', /unclosed code fence/],
    ['an unclosed HTML comment', '- x <!-- note', /unclosed HTML comment/],
    ['a link that climbs out with ../', '- x, see [ADR](../adr/0072-x.md).', /repository root/],
  ])('rejects %s', (_label, body, message) => {
    expect(() => parseFragment('1-x.md', frag('Added', body))).toThrow(message);
  });

  it('names a folder inside the fragments folder instead of failing on it', () => {
    const { dir } = tree({ '1-a.md': frag('Added', '- a') });
    mkdirSync(path.join(dir, 'drafts'));
    expect(() => readFragments(dir)).toThrow(/drafts: is a folder/);
  });
});

describe('review: [Unreleased] span and release edits', () => {
  it('finds an entry hidden after a link reference inside [Unreleased]', () => {
    const sneaky = CHANGELOG.replace(UNRELEASED_NOTE, `${UNRELEASED_NOTE}\n\n[x]: https://x.example\n\n- sneaky entry`);
    expect(changelogProblems(sneaky)).not.toEqual([]);
  });

  it('moves only the real [Unreleased] link, never a quote of it in history', () => {
    const quoted = CHANGELOG.replace(
      '- **Old entry (#200).** Stays byte for byte.',
      `- **Old entry (#200).** Stays byte for byte. It quotes \`[Unreleased]: ${URL_BASE}/compare/v0.5.0...HEAD\`.`,
    );
    const out = releaseChangelog(quoted, [parseFragment('7-x.md', frag('Added', '- **New (#7).** Now.'))], {
      version: '0.6.0',
      date: '2026-11-02',
    });
    const history = quoted.slice(quoted.indexOf('## [0.5.0]'), quoted.lastIndexOf('[Unreleased]: '));
    expect(out).toContain(history);
    expect(out).toContain(`[Unreleased]: ${URL_BASE}/compare/v0.6.0...HEAD\n[0.6.0]: ${URL_BASE}/compare/v0.5.0...v0.6.0`);
  });

  it('refuses a date that does not exist', () => {
    expect(() =>
      releaseChangelog(CHANGELOG, [parseFragment('7-x.md', frag('Added', '- x'))], { version: '0.6.0', date: '2026-13-45' }),
    ).toThrow(/not a YYYY-MM-DD date/);
  });
});

describe('review: the CLI', () => {
  it('refuses more than one mode', () => {
    const { root } = tree({});
    const r = cli(['--check', '--preview'], root);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/one of --check, --preview, --release/);
  });

  it('applyRelease leaves CHANGELOG.md and every fragment as they were when a delete fails', () => {
    const { dir, changelog } = tree({ '7-x.md': frag('Added', '- x'), '8-y.md': frag('Fixed', '- y') });
    const fragments = readFragments(dir);
    let calls = 0;
    const failingUnlink = (p: string) => {
      calls += 1;
      if (calls === 2) throw Object.assign(new Error(`EPERM: operation not permitted, unlink '${p}'`), { code: 'EPERM' });
      rmSync(p);
    };
    expect(() =>
      applyRelease({ changelogPath: changelog, dir, fragments, released: 'NEW' }, { unlink: failingUnlink }),
    ).toThrow(/EPERM[\s\S]*nothing was released/);
    expect(readFileSync(changelog, 'utf8')).toBe(CHANGELOG);
    expect(readdirSync(dir).sort()).toEqual(['7-x.md', '8-y.md']);
    expect(readFileSync(path.join(dir, '7-x.md'), 'utf8')).toBe(frag('Added', '- x'));
  });
});

