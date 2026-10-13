/**
 * ADR-0046 WP07 — the `generate-feature-pages.mjs` CLI and its `--check` drift
 * gate (`pnpm validate:features` in CI's doc-sanity lane).
 *
 * Every case spawns the REAL script with `node` against a throwaway site in the
 * OS temp dir, so the exit code and the printed path list are what CI sees. The
 * site carries its own inline `.feature` sources (no shared fixture coupling).
 *
 * Contract pinned here:
 *   - write mode generates the section; `--check` on the result exits 0;
 *   - `--check` exits 1 and lists every drifted path, one per line, prefixed by
 *     its kind (`added` / `changed` / `stale` / `authored`), with a hint to run
 *     the write mode;
 *   - a missing source dir or a Gherkin syntax error exits 1 with the
 *     `[dk-gherkin]` message;
 *   - `--check` never writes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/generate-feature-pages.mjs', import.meta.url));

const BOOK = `@dk:context=shipping
Feature: Book a consignment
  A booking reserves space on one sailing for one consignment.

  Scenario: Book cargo that fits
    Given a consignment of 12 TEU
    When the shipper books the consignment onto the sailing
    Then the booking is confirmed
`;

const CUSTOMS = `Feature: Declare customs
  A declaration lists every line of a consignment before it sails.

  Scenario: Declare a single line
    Given a consignment with one line
    When the shipper declares it
    Then the declaration is accepted
`;

const sites: string[] = [];

afterEach(() => {
  for (const dir of sites.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A throwaway site: `<site>/features/shipping/*.feature` and an empty `<site>/docs/`. */
function makeSite(): string {
  const site = mkdtempSync(path.join(tmpdir(), 'dk-gherkin-cli-'));
  sites.push(site);
  mkdirSync(path.join(site, 'features', 'shipping'), { recursive: true });
  mkdirSync(path.join(site, 'docs'), { recursive: true });
  writeFileSync(path.join(site, 'features', 'shipping', 'book-consignment.feature'), BOOK);
  writeFileSync(path.join(site, 'features', 'shipping', 'declare-customs.feature'), CUSTOMS);
  return site;
}

function run(site: string, ...extra: string[]) {
  const res = spawnSync(
    process.execPath,
    [
      SCRIPT,
      '--root',
      site,
      '--sources',
      'features',
      '--docs',
      'docs',
      '--section',
      'behaviour',
      '--index-basename',
      'README,index',
      ...extra,
    ],
    { encoding: 'utf8' },
  );
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

const check = (site: string) => run(site, '--check');

/** Every file under `dir`, POSIX-relative and sorted — a cheap tree snapshot. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out[path.relative(dir, abs).split(path.sep).join('/')] = readFileSync(abs, 'utf8');
    }
  };
  walk(dir);
  return out;
}

describe('generate-feature-pages CLI — write mode', () => {
  it('generates the section and reports a summary', () => {
    const site = makeSite();
    const res = run(site);
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/2 feature file\(s\) → 4 written, 0 unchanged, 0 removed/);
    expect(Object.keys(snapshot(path.join(site, 'docs', 'behaviour')))).toEqual([
      'README.md',
      'shipping/README.md',
      'shipping/book-consignment.md',
      'shipping/declare-customs.md',
    ]);
    // A second run is a no-op.
    expect(run(site).stdout).toMatch(/0 written, 4 unchanged, 0 removed/);
  });

  it('refuses to write into a section that holds an authored file (exit 1, [dk-gherkin])', () => {
    const site = makeSite();
    mkdirSync(path.join(site, 'docs', 'behaviour'), { recursive: true });
    writeFileSync(path.join(site, 'docs', 'behaviour', 'notes.md'), '# Notes\n');
    const res = run(site);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/\[dk-gherkin\] refusing to write into .*notes\.md/);
  });
});

describe('generate-feature-pages CLI — empty source set', () => {
  /** A generated site whose only features were then removed (e.g. a submodule not checked out). */
  function orphanedSite(): string {
    const site = makeSite();
    run(site);
    rmSync(path.join(site, 'features', 'shipping'), { recursive: true });
    return site;
  }

  it('write mode stops (exit 1) and removes nothing; --allow-empty alone removes (exit 0)', () => {
    const site = orphanedSite();
    const before = snapshot(path.join(site, 'docs'));
    const stopped = run(site);
    expect(stopped.status).toBe(1);
    expect(stopped.stderr).toMatch(/\[dk-gherkin\] no \.feature files found in features, but 4 generated page\(s\)/);
    expect(stopped.stderr).toContain('--allow-empty');
    expect(snapshot(path.join(site, 'docs'))).toEqual(before);

    const allowed = run(site, '--allow-empty');
    expect(allowed.status).toBe(0);
    expect(allowed.stdout).toMatch(/0 feature file\(s\) → 0 written, 0 unchanged, 4 removed/);
    expect(snapshot(path.join(site, 'docs'))).toEqual({});
  });

  it('--check is unchanged by the flag: exit 1 listing every page as stale, with or without it', () => {
    const site = orphanedSite();
    const before = snapshot(path.join(site, 'docs'));
    const [plain, flagged] = [[], ['--allow-empty']].map((extra) => {
      const res = run(site, '--check', ...extra);
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('  stale: shipping/book-consignment.md\n');
      return res;
    });
    expect(flagged.stdout).toBe(plain.stdout);
    expect(flagged.stderr).toBe(plain.stderr);
    expect(snapshot(path.join(site, 'docs'))).toEqual(before);
  });
});

describe('generate-feature-pages CLI — --check drift gate', () => {
  it('a clean, freshly generated tree → exit 0 with an "in sync" line', () => {
    const site = makeSite();
    expect(run(site).status).toBe(0);
    const res = check(site);
    expect(res.status).toBe(0);
    expect(res.stdout).toMatch(/regeneration-clean \(2 feature file\(s\) in sync\)/);
    expect(res.stderr).not.toMatch(/✖/);
  });

  it('never generated → exit 1 listing every page as `added`, and writes nothing', () => {
    const site = makeSite();
    const res = check(site);
    expect(res.status).toBe(1);
    for (const rel of [
      'README.md',
      'shipping/README.md',
      'shipping/book-consignment.md',
      'shipping/declare-customs.md',
    ]) {
      expect(res.stderr).toContain(`  added: ${rel}\n`);
    }
    expect(existsSync(path.join(site, 'docs', 'behaviour'))).toBe(false);
  });

  it('a .feature edited without regenerating → exit 1 listing the changed page (and only it)', () => {
    const site = makeSite();
    run(site);
    const before = snapshot(path.join(site, 'docs'));
    const feature = path.join(site, 'features', 'shipping', 'book-consignment.feature');
    writeFileSync(feature, BOOK.replace('12 TEU', '14 TEU'));
    const res = check(site);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('  changed: shipping/book-consignment.md\n');
    expect(res.stderr).not.toMatch(/ (added|stale|authored): /);
    expect(res.stderr).not.toContain('declare-customs');
    // The hint names the fix.
    expect(res.stderr).toMatch(/without `--check`/);
    // --check is read-only.
    expect(snapshot(path.join(site, 'docs'))).toEqual(before);
    // Regenerating makes the gate green again.
    expect(run(site).status).toBe(0);
    expect(check(site).status).toBe(0);
  });

  it('a removed .feature leaves its owned page stale → listed as `stale` (exit 1)', () => {
    const site = makeSite();
    run(site);
    unlinkSync(path.join(site, 'features', 'shipping', 'declare-customs.feature'));
    const res = check(site);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('  stale: shipping/declare-customs.md\n');
    // The shipping hub's child list changed too.
    expect(res.stderr).toContain('  changed: shipping/README.md\n');
  });

  it('a new .feature not yet generated → listed as `added` (exit 1)', () => {
    const site = makeSite();
    run(site);
    mkdirSync(path.join(site, 'features', 'hr'));
    writeFileSync(
      path.join(site, 'features', 'hr', 'request-leave.feature'),
      CUSTOMS.replace('Declare customs', 'Request leave'),
    );
    const res = check(site);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('  added: hr/README.md\n');
    expect(res.stderr).toContain('  added: hr/request-leave.md\n');
    expect(res.stderr).toContain('  changed: README.md\n');
  });

  it('an authored file inside the generated section → listed as `authored` (exit 1)', () => {
    const site = makeSite();
    run(site);
    writeFileSync(
      path.join(site, 'docs', 'behaviour', 'shipping', 'notes.md'),
      '---\ntitle: Notes\n---\n\n# Notes\n',
    );
    const res = check(site);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('  authored: shipping/notes.md\n');
  });

  it('a missing source directory → exit 1 with the [dk-gherkin] message naming it', () => {
    const site = makeSite();
    rmSync(path.join(site, 'features'), { recursive: true });
    const res = check(site);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/\[dk-gherkin\] source directory not found: features \(resolved to .*features\)/);
  });

  it('a Gherkin syntax error → exit 1 with the [dk-gherkin] path:line:col message', () => {
    const site = makeSite();
    writeFileSync(
      path.join(site, 'features', 'shipping', 'broken.feature'),
      'Feature: Broken\n  Scenario: x\n    Given a step\n  Examples:\n    | a |\n',
    );
    const res = check(site);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/\[dk-gherkin\] features\/shipping\/broken\.feature:\d+:\d+ /);
  });

  it('a bad invocation (missing --sources) → exit 1 with a usage message', () => {
    const res = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/--sources is required/);
  });
});

describe('generate-feature-pages CLI — --help', () => {
  it.each(['--help', '-h'])('%s prints the usage block and exits 0, whatever else is given', (flag) => {
    const res = spawnSync(process.execPath, [SCRIPT, flag, '--check'], { encoding: 'utf8' });
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toMatch(/^Usage:\n\s+node src\/scripts\/generate-feature-pages\.mjs/);
    expect(res.stdout).toMatch(/--allow-empty\s+Remove the generated pages/);
    expect(res.stdout).not.toMatch(/^ \* /m); // no header-comment markers leaked into the usage
  });
});

describe('generate-feature-pages CLI — option validation parity with the integration (review #6)', () => {
  it.each(['../../escaped', '..', 'a/b', '.hidden', 'a\\b', ' '])('--section %s is rejected (exit 1) and nothing is written', (section) => {
    const site = makeSite();
    // A regression would write OUTSIDE the temp site (`<tmp>/escaped`): clean that up too.
    if (section.startsWith('../../')) sites.push(path.resolve(site, 'docs', section));
    const res = run(site, '--section', section);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(/\[dk-gherkin\] --section must be a single folder name/);
    expect(existsSync(path.resolve(site, 'docs', section))).toBe(section === '..');
    expect(existsSync(path.resolve(site, 'docs', section, 'README.md'))).toBe(false);
  });

  it.each(['../guides/a', 'sub/index', '.hidden', 'a\\b'])(
    '--index-basename %s is rejected (exit 1) and no page outside the section is replaced',
    (basename) => {
      const site = makeSite();
      mkdirSync(path.join(site, 'docs', 'guides'), { recursive: true });
      const authored = path.join(site, 'docs', 'guides', 'a.md');
      writeFileSync(authored, '# Hand-written\n');
      const res = run(site, '--index-basename', basename);
      expect(res.status).toBe(1);
      expect(res.stderr).toMatch(/\[dk-gherkin\] --index-basename must be a plain file name/);
      expect(readFileSync(authored, 'utf8')).toBe('# Hand-written\n');
      expect(existsSync(path.join(site, 'docs', 'behaviour'))).toBe(false);
    },
  );

  it.each(['glossary', '_meta'])('--section %s is reserved (exit 1)', (section) => {
    const site = makeSite();
    const res = run(site, '--section', section);
    expect(res.status).toBe(1);
    expect(res.stderr).toMatch(new RegExp(`\\[dk-gherkin\\] --section "${section}" is reserved`));
    expect(existsSync(path.join(site, 'docs', section))).toBe(false);
  });
});
