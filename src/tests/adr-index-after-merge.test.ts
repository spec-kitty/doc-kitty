/**
 * ADR-0072, decision 2: the ADR index table in `docs/adr/README.md` is
 * regenerated after merge by a bot PR, not hand-edited in every PR. Per PR, CI
 * instead fails two ADRs that share a number (`--check-ids`). Strict branch
 * protection re-runs it on top of the first PR today; a merge queue with
 * `merge_group` would check the combined commit as well.
 *
 * The workflow is checked as text (no YAML parser), like the other workflow
 * tests (plantuml-service-hardening, regen-workflow-render-setup).
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

  it("passes on this repository's own ADRs (pnpm validate:adr-ids)", () => {
    expect(cli(['--check-ids']).code).toBe(0);
  });
});

describe('CI: the per-PR gate checks ids, not the table', () => {
  const ci = read('.github/workflows/ci.yml');
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

  it('package.json has validate:adr-ids', () => {
    expect(pkg.scripts['validate:adr-ids']).toBe('node src/scripts/generate-adr-index.mjs --check-ids');
  });

  it('doc-sanity runs validate:adr-ids and no longer runs the table lockfile check', () => {
    expect(ci).toMatch(/run: pnpm validate:adr-ids/);
    expect(ci).not.toMatch(/run: pnpm validate:adr-index/);
  });

  // The bot dispatches CI on its branch: a push or PR made with GITHUB_TOKEN
  // starts no workflow, but a workflow_dispatch does, and its ci-ok check run
  // lands on the branch head the bot PR shows.
  it('ci.yml can be dispatched', () => {
    const on = ci.slice(ci.indexOf('\non:'), ci.indexOf('\npermissions:'));
    expect(on).toMatch(/^ {2}workflow_dispatch:/m);
  });
});

describe('adr-index.yml — regenerate the table after merge', () => {
  const wf = read('.github/workflows/adr-index.yml');

  it('runs on a push to main that touches docs/adr, and on demand', () => {
    expect(wf).toMatch(/push:\n\s+branches: \[main\]\n\s+paths:\n\s+- 'docs\/adr\/\*\*'/);
    expect(wf).toMatch(/^ {2}workflow_dispatch:/m);
  });

  it('asks only for what it uses: push a branch, open a PR, dispatch CI', () => {
    const perms = wf.slice(wf.indexOf('\npermissions:'), wf.indexOf('\nconcurrency:'));
    expect(perms).toMatch(/contents: write/);
    expect(perms).toMatch(/pull-requests: write/);
    expect(perms).toMatch(/actions: write/);
  });

  it('keeps one run at a time, the newest winning', () => {
    expect(wf).toMatch(/concurrency:\n\s+group: adr-index\n\s+cancel-in-progress: true/);
  });

  it('regenerates with the generator and force-updates the single ci/adr-index branch', () => {
    expect(wf).toMatch(/node src\/scripts\/generate-adr-index\.mjs\n/);
    expect(wf).toMatch(/BRANCH: ci\/adr-index/);
    expect(wf).toMatch(/git push --force origin "HEAD:refs\/heads\/\$BRANCH"/);
  });

  it('dispatches CI on the branch so its PR gets the required ci-ok', () => {
    expect(wf).toMatch(/gh workflow run ci\.yml --ref "\$BRANCH"/);
  });

  it('opens the PR when Actions may, and links it in the run summary when not', () => {
    expect(wf).toMatch(/gh pr create/);
    expect(wf).toMatch(/GITHUB_STEP_SUMMARY/);
  });

  it('deletes a stale branch (closing its PR) when the table is already current', () => {
    expect(wf).toMatch(/git push origin --delete "\$BRANCH"/);
  });

  it('pins every action by commit SHA', () => {
    const uses = [...wf.matchAll(/uses: (\S+)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/);
  });
});
