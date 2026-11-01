/**
 * ADR-0072, decision 2: the ADR index table in `docs/adr/README.md` is
 * regenerated after merge by a bot PR, not hand-edited in every PR. Per PR, CI
 * instead fails two ADRs that share a number (`--check-ids`). Strict branch
 * protection re-runs it on top of the first PR today; a merge queue with
 * `merge_group` would check the combined commit as well.
 *
 * The workflow's shape (triggers, permissions, steps) is not pinned as text: CI
 * and the first real run exercise it. Two things CI cannot see stay pinned:
 * ci.yml is dispatchable, and the bot workflow pins its actions by SHA.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverAdrs, duplicateAdrIds } from '../scripts/generate-adr-index.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/generate-adr-index.mjs', import.meta.url));
const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

const adr = (title: string) =>
  `---\ntitle: "${title}"\ndescription: A fixture ADR.\ndoc_status: active\nupdated: 2026-11-01\nkind: ADR\n---\n\n# ${title}\n\n## Status\n\nAccepted\n`;

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function adrDir(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'adr-ids-'));
  dirs.push(root);
  const dir = path.join(root, 'docs', 'adr');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'README.md'), '# ADRs\n\n| ID | Title | Status | Date |\n|----|----|----|----|\n');
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), text);
  }
  return dir;
}

function cli(args: string[]) {
  const r = spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('duplicateAdrIds — two ADRs that took the same number', () => {
  it('names each shared id with all of its files', () => {
    const dir = adrDir({
      '0001-a.md': adr('A'),
      '0002-b.md': adr('B'),
      '0002-c.md': adr('C'),
      'era/0001-d.md': adr('D'),
    });
    expect(duplicateAdrIds(discoverAdrs(dir))).toEqual([
      { number: '0001', files: ['0001-a.md', 'era/0001-d.md'] },
      { number: '0002', files: ['0002-b.md', '0002-c.md'] },
    ]);
  });

  it('is empty when every number is unique', () => {
    expect(duplicateAdrIds(discoverAdrs(adrDir({ '0001-a.md': adr('A'), '0002-b.md': adr('B') })))).toEqual([]);
  });
});

describe('generate-adr-index --check-ids', () => {
  it('fails on a shared number, naming the files and the fix', () => {
    const dir = adrDir({ '0072-a.md': adr('A'), '0072-b.md': adr('B') });
    const r = cli(['--check-ids', '--dir', dir]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/0072.*0072-a\.md.*0072-b\.md/s);
    expect(r.out).toMatch(/renumber/);
  });

  it('passes unique numbers even when the README table is stale', () => {
    const dir = adrDir({ '0001-a.md': adr('A'), '0002-b.md': adr('B') });
    const r = cli(['--check-ids', '--dir', dir]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/2 ADR id\(s\), all unique/);
  });

  // A file the id rule cannot read is in neither the table nor this check, so
  // a mistyped number (72- for 0072-) would slip past both. Say so, without
  // failing: a docs folder may hold notes that are not ADRs.
  it('warns about a markdown file that looks like a mistyped ADR, and still passes', () => {
    const dir = adrDir({
      '0001-a.md': adr('A'),
      '72-typo.md': adr('Typo'),
      'era/ADR-x.md': adr('Misnamed'),
      'template.md': adr('Template'),
      'notes.md': 'Not an ADR.\n',
    });
    const r = cli(['--check-ids', '--dir', dir]);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/72-typo\.md/);
    expect(r.out).toMatch(/era\/ADR-x\.md/);
    expect(r.out).not.toMatch(/template\.md|README\.md|notes\.md/);
  });
});

// The bot's `gh workflow run ci.yml` fails only after merge if this is lost, and
// no CI job exercises it, so it stays pinned.
describe('CI: ci.yml stays dispatchable for the ADR index bot', () => {
  const ci = read('.github/workflows/ci.yml');

  // A push or PR made with GITHUB_TOKEN starts no workflow, but a
  // workflow_dispatch does, and its ci-ok check run lands on the branch head the
  // bot PR shows.
  it('ci.yml can be dispatched', () => {
    const on = ci.slice(ci.indexOf('\non:'), ci.indexOf('\npermissions:'));
    expect(on).toMatch(/^ {2}workflow_dispatch:/m);
  });
});

describe('adr-index.yml', () => {
  const wf = read('.github/workflows/adr-index.yml');

  it('pins every action by commit SHA', () => {
    const uses = [...wf.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/);
  });
});
