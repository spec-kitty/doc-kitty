/**
 * The `dockitty-tom-annex` CLI end to end (WP07 T032, T034): it runs as a
 * child process on a temporary `dist` holding a built, stamped index.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, linkSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTomAnnex, serializeTomAnnex } from '../lib/tom-annex/core.mjs';
import { contentHash, stampAnnex } from '../lib/tom-annex/stamp.mjs';
import { canonical } from './fixtures/tom-annex/graph.mjs';

const CLI = fileURLToPath(new URL('../scripts/tom-annex.mjs', import.meta.url));
const { graph, catalog } = canonical();
const base = stampAnnex(buildTomAnnex(graph as never, catalog as never, { site: new URL('https://docs.example.org'), base: '/docs/' }), {
  inputs: [{ key: 'docs/a.md', sha256: 'a'.repeat(64) }],
});
type Annex = typeof base;

/** A temp project: `dist/api/tom-annex.json` holds `annex` (or nothing). */
function project(annex: Annex | null = base) {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-tom-cli-'));
  mkdirSync(path.join(root, 'dist', 'api'), { recursive: true });
  if (annex) writeFileSync(path.join(root, 'dist', 'api', 'tom-annex.json'), serializeTomAnnex(annex));
  const snapshot = path.join(root, 'docs', '_meta', 'tom-annex.snapshot.json');
  const hub = path.join(root, 'docs', 'context', 'evidence-index', 'index.md');
  const run = (...flags: string[]) => runWith([], ...flags);
  const runWith = (nodeArgs: string[], ...flags: string[]) => {
    const r = spawnSync(process.execPath, [...nodeArgs, CLI, ...flags], { cwd: root, encoding: 'utf8' });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  };
  const both = ['--dist', 'dist', '--snapshot', snapshot, '--hub', hub];
  const rebuild = (a: Annex) => writeFileSync(path.join(root, 'dist', 'api', 'tom-annex.json'), serializeTomAnnex(a));
  return { root, snapshot, hub, run, runWith, both, rebuild };
}

const variant = (edit: (a: Annex) => void): Annex => {
  const a = structuredClone(base);
  edit(a);
  a.generated.content_hash = contentHash(a);
  return a;
};

describe('dockitty-tom-annex (WP07 T034)', () => {
  it('writes both files, then --check is clean (exit 0)', () => {
    const p = project();
    expect(p.run(...p.both).status).toBe(0);
    expect(readFileSync(p.snapshot, 'utf8')).toBe(serializeTomAnnex(base));
    expect(readFileSync(p.hub, 'utf8')).toMatch(/^---\n[\s\S]*kind: Hub[\s\S]*doc-kitty-tom-annex\//);
    const check = p.run(...p.both, '--check');
    expect(check.status).toBe(0);
    expect(check.out).toBe('');
  });

  it('reports stale-source for both files when the build digested other inputs (exit 1, with the hint)', () => {
    const p = project();
    p.run(...p.both);
    p.rebuild(variant((a) => (a.generated.source_digest = `sha256:${'b'.repeat(64)}`)));
    const check = p.run(...p.both, '--check');
    expect(check.status).toBe(1);
    expect(check.out).toContain(`doc-kitty-tom-annex stale-source ${p.snapshot}`);
    expect(check.out).toContain(`doc-kitty-tom-annex stale-source ${p.hub}`);
    expect(check.out).toMatch(/dockitty-tom-annex --dist/);
  });

  it('reports hand-edited for an edited snapshot body', () => {
    const p = project();
    p.run(...p.both);
    writeFileSync(p.snapshot, readFileSync(p.snapshot, 'utf8').replace('"counsel": [', '"counsel": [\n    "Edited.",'));
    const check = p.run(...p.both, '--check');
    expect(check.status).toBe(1);
    expect(check.out).toContain(`doc-kitty-tom-annex hand-edited ${p.snapshot}`);
    expect(check.out).not.toContain(p.hub);
  });

  it('reports stale-render when the digests agree but the rendering differs', () => {
    const p = project();
    p.run(...p.both);
    p.rebuild(variant((a) => (a.scopes.system[0].label = `${a.scopes.system[0].label} (reworded)`)));
    const check = p.run(...p.both, '--check');
    expect(check.out).toContain(`doc-kitty-tom-annex stale-render ${p.snapshot}`);
    expect(check.out).toContain(`doc-kitty-tom-annex stale-render ${p.hub}`);
  });

  it('reports missing for a file that was never written', () => {
    const p = project();
    const check = p.run(...p.both, '--check');
    expect(check.status).toBe(1);
    expect(check.out).toContain(`doc-kitty-tom-annex missing ${p.snapshot}`);
    expect(check.out).toContain(`doc-kitty-tom-annex missing ${p.hub}`);
  });

  it('treats a missing build index as an input error, not a D3 verdict, in both modes (exit 2; R24 squad)', () => {
    const p = project(null);
    const check = p.run(...p.both, '--check');
    expect(check.status).toBe(2);
    expect(check.out).toMatch(/no evidence index at .*tom-annex\.json[\s\S]*no published classified pages\?/);
    expect(check.out).not.toMatch(/^doc-kitty-tom-annex missing/m);
    const write = p.run(...p.both);
    expect(write.status).toBe(2);
    expect(existsSync(p.snapshot)).toBe(false);
  });

  it('exits 2 with usage when no target or no --dist is named', () => {
    const p = project();
    expect(p.run('--dist', 'dist').status).toBe(2);
    expect(p.run('--snapshot', p.snapshot).status).toBe(2);
    expect(p.run('--dist', 'dist', '--bogus').out).toMatch(/usage: dockitty-tom-annex/);
    expect(p.run('--help').status).toBe(0);
  });

  it('refuses to overwrite an authored file at either target (exit 1), and writes nothing', () => {
    const p = project();
    mkdirSync(path.dirname(p.hub), { recursive: true });
    writeFileSync(p.hub, '---\ntitle: "Mine"\nkind: Hub\n---\n\n# Mine\n');
    const r = p.run(...p.both);
    expect(r.status).toBe(1);
    expect(r.out).toContain(`refusing to overwrite ${p.hub}`);
    expect(readFileSync(p.hub, 'utf8')).toContain('# Mine');
    expect(existsSync(p.snapshot)).toBe(false);
    // The same file under --check is unowned.
    expect(p.run(...p.both, '--check').out).toContain(`doc-kitty-tom-annex unowned ${p.hub}`);
  });

  it('refuses an unstamped or foreign snapshot when only --snapshot is named (review cycle 1, R1)', () => {
    const p = project();
    mkdirSync(path.dirname(p.snapshot), { recursive: true });
    for (const foreign of ['{"mine": true}\n', serializeTomAnnex(variant((a) => (a.generated.by = 'doc-kitty-gherkin/1.0.0')))]) {
      writeFileSync(p.snapshot, foreign);
      const r = p.run('--dist', 'dist', '--snapshot', p.snapshot);
      expect(r.status).toBe(1);
      expect(r.out).toContain(`refusing to overwrite ${p.snapshot}`);
      expect(readFileSync(p.snapshot, 'utf8')).toBe(foreign);
    }
  });

  it('replaces a file by rename, never rewriting it in place (review cycle 1, F1)', () => {
    const p = project();
    p.run(...p.both);
    // A second name for the same inode sees an in-place write, but not a rename over the path.
    const other = path.join(p.root, 'other-name.json');
    linkSync(p.snapshot, other);
    const before = readFileSync(other, 'utf8');
    p.rebuild(variant((a) => (a.generated.source_digest = `sha256:${'c'.repeat(64)}`)));
    expect(p.run(...p.both).status).toBe(0);
    expect(readFileSync(p.snapshot, 'utf8')).not.toBe(before);
    expect(readFileSync(other, 'utf8')).toBe(before);
    // No temporary file is left behind.
    expect(readdirSync(path.dirname(p.snapshot))).toEqual(['tom-annex.snapshot.json']);
    expect(readdirSync(path.dirname(p.hub))).toEqual(['index.md']);
  });

  it('removes its temporary file when the rename fails, and keeps the old file (R24, WP07 cycle 2 finding 2)', () => {
    const p = project();
    p.run(...p.both);
    const before = readFileSync(p.snapshot, 'utf8');
    p.rebuild(variant((a) => (a.generated.source_digest = `sha256:${'d'.repeat(64)}`)));
    const preload = fileURLToPath(new URL('./fixtures/tom-annex/fail-rename.mjs', import.meta.url));
    const r = p.runWith(['--import', preload], '--dist', 'dist', '--snapshot', p.snapshot);
    expect(r.status).toBe(2);
    expect(r.out).toMatch(/simulated rename failure/);
    expect(readFileSync(p.snapshot, 'utf8')).toBe(before);
    expect(readdirSync(path.dirname(p.snapshot))).toEqual(['tom-annex.snapshot.json']);
  });

  it('names the dockitty-tom-annex command, with both targets, in the regenerate hint (R24, WP08 review item 10)', () => {
    const p = project();
    const check = p.run(...p.both, '--check');
    expect(check.out).toMatch(/dockitty-tom-annex --dist <dist> \[--snapshot <path>\] \[--hub <path>\]/);
    expect(check.out).not.toMatch(/node <toolkit>/);
  });

  it('refuses a --dist, --snapshot or --hub path outside the working directory (exit 2; SonarCloud S8707)', () => {
    const p = project();
    const outside = mkdtempSync(path.join(tmpdir(), 'dk-tom-outside-'));
    const target = path.join(outside, 'snap.json');
    for (const args of [
      ['--dist', 'dist', '--snapshot', target],
      ['--dist', 'dist', '--hub', '../escape/index.md'],
      ['--dist', outside, '--snapshot', p.snapshot, '--check'],
    ]) {
      const r = p.run(...args);
      expect(r.status).toBe(2);
      expect(r.out).toMatch(/outside the working directory/);
    }
    expect(existsSync(target)).toBe(false);
    expect(existsSync(path.join(p.root, '..', 'escape'))).toBe(false);
  });

  it('accepts absolute paths when the project is reached through a symlink (#455 review, finding 1)', () => {
    const p = project();
    // A second spelling of the project root, as macOS /var -> /private/var or a symlinked workspace gives.
    const alias = path.join(mkdtempSync(path.join(tmpdir(), 'dk-tom-alias-')), 'proj');
    symlinkSync(p.root, alias, 'dir');
    const viaAlias = (rel: string) => path.join(alias, rel);
    const r = spawnSync(
      process.execPath,
      [CLI, '--dist', viaAlias('dist'), '--snapshot', viaAlias('docs/_meta/tom-annex.snapshot.json'), '--hub', viaAlias('docs/context/evidence-index/index.md')],
      { cwd: alias, encoding: 'utf8' },
    );
    expect(`${r.stdout}${r.stderr}`).not.toMatch(/outside the working directory/);
    expect(r.status).toBe(0);
    expect(existsSync(p.snapshot)).toBe(true);
  });

  it('refuses a path that leaves the project through a directory symlink (#455 review, finding 2)', () => {
    const p = project();
    const outside = mkdtempSync(path.join(tmpdir(), 'dk-tom-elsewhere-'));
    symlinkSync(outside, path.join(p.root, 'out'), 'dir');
    const write = p.run('--dist', 'dist', '--snapshot', 'out/pwned.json');
    expect(write.status).toBe(2);
    expect(write.out).toMatch(/outside the working directory/);
    expect(existsSync(path.join(outside, 'pwned.json'))).toBe(false);
    // Reading through such a link is refused too: a real dist outside the project.
    mkdirSync(path.join(outside, 'dist', 'api'), { recursive: true });
    writeFileSync(path.join(outside, 'dist', 'api', 'tom-annex.json'), serializeTomAnnex(base));
    symlinkSync(path.join(outside, 'dist'), path.join(p.root, 'dist-link'), 'dir');
    expect(p.run('--dist', 'dist-link', '--snapshot', p.snapshot, '--check').status).toBe(2);
  });

  it('refuses --dist .. and accepts a file whose name merely starts with two dots (#455 review, finding 3)', () => {
    const p = project();
    const up = p.run('--dist', '..', '--snapshot', p.snapshot);
    expect(up.status).toBe(2);
    expect(up.out).toMatch(/outside the working directory/);
    const dotted = p.run('--dist', 'dist', '--snapshot', '..snapshot.json');
    expect(dotted.status).toBe(0);
    expect(existsSync(path.join(p.root, '..snapshot.json'))).toBe(true);
  });

  it('writes nothing when the index has no date for the hub (exit 2)', () => {
    const p = project(variant((a) => (a.generated.at = null as never)));
    const r = p.run(...p.both);
    expect(r.status).toBe(2);
    expect(r.out).toMatch(/needs a date/);
    expect(existsSync(p.snapshot)).toBe(false);
  });
});
