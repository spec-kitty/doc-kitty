/**
 * Stub-tool templates (#402): `new-doc.mjs --template <id>` and
 * `scaffold.mjs --preset operating-model`. The contract is
 * kitty-specs/operating-model-templates-01M84X0R/contracts/cli.md.
 *
 * Every case spawns the real script in a temp directory. The tools must never
 * overwrite an existing file (FR-009), and a run without --template or --preset
 * must produce exactly what it produced before this mission (FR-014).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { OPERATING_MODEL_TEMPLATES, TEMPLATE_IDS } from '../lib/operating-model-templates.mjs';

const newDoc = fileURLToPath(new URL('../scripts/new-doc.mjs', import.meta.url));
const scaffold = fileURLToPath(new URL('../scripts/scaffold.mjs', import.meta.url));
const gate = fileURLToPath(new URL('../scripts/validate-frontmatter.mjs', import.meta.url));

const run = (script: string, args: string[]) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

/** Every file under `dir`, as sorted paths relative to `base`. */
function files(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? files(join(dir, e.name), base) : [relative(base, join(dir, e.name))]))
    .sort();
}

function snapshot(dir: string): Record<string, string> {
  return Object.fromEntries(files(dir).map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
}

function fm(path: string): Record<string, unknown> {
  return { ...(matter(readFileSync(path, 'utf8')).data as Record<string, unknown>) };
}

/** The 13 files the preset writes: the section index plus the 12 templates. */
const PRESET_FILES = ['operating-model/README.md', ...OPERATING_MODEL_TEMPLATES.map((t) => `${t.path}.md`)].sort();

let root: string;
let docs: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stub-tools-'));
  docs = join(root, 'docs');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('runs without --template or --preset are unchanged (FR-014)', () => {
  // Digest of the default scaffold tree and `new-doc guides/x`, captured before
  // this mission's changes: paths sorted, each file masked for its clock lines
  // and the toolkit version. When the default scaffold output changes on
  // purpose, regenerate this digest in the same change and say why.
  const PINNED = { files: 53, sha256: '3a0816c98bf398688cc7ba84687e2ccd419c160b947a5b5d52a3c0cad9338686' };
  const mask = (s: string) =>
    s
      .replace(/^updated: .*$/gm, 'updated: <T>')
      .replace(/^ {2}at: .*$/gm, '  at: <T>')
      .replace(/^ {2}by: doc-kitty-scaffold\/.*$/gm, '  by: doc-kitty-scaffold/<V>');

  it('the default scaffold and a plain new-doc produce the pinned output', () => {
    expect(run(scaffold, [docs]).status).toBe(0);
    expect(run(newDoc, ['guides/x', '--base', join(root, 'nd')]).status).toBe(0);
    const all = [...files(docs, root), ...files(join(root, 'nd'), root)].sort();
    const hash = createHash('sha256');
    for (const rel of all) hash.update(`${rel}\0${mask(readFileSync(join(root, rel), 'utf8'))}\0`);
    expect({ files: all.length, sha256: hash.digest('hex') }).toEqual(PINNED);
  });
});

describe('new-doc --template <id> (FR-007)', () => {
  it('writes the template page at its default path, with its kind, type and measures', () => {
    const res = run(newDoc, ['--template', 'incident-response', '--base', docs]);
    expect(res.status, res.stderr).toBe(0);
    const page = join(docs, 'operations/runbooks/incident-response.md');
    expect(res.stdout).toContain(`✓ created ${page} (type: Runbook, kind: How-To)`);
    const data = fm(page);
    expect(data.kind).toBe('How-To');
    expect(data.type).toBe('Runbook');
    expect(data.tom_classification).toEqual([
      { measure: 'availability-restoration', scope: 'organisation' },
      { measure: 'accountability', scope: 'organisation' },
    ]);
    expect(readFileSync(page, 'utf8')).toContain('## Triggers');
  });

  it('takes a slug and a title, for one page per role', () => {
    const res = run(newDoc, ['--template', 'role', 'operating-model/roles/dpo', '--title', 'Data Protection Officer', '--base', docs]);
    expect(res.status, res.stderr).toBe(0);
    const data = fm(join(docs, 'operating-model/roles/dpo.md'));
    expect(data.title).toBe('Data Protection Officer');
    expect(data.kind).toBe('Role');
    expect(data.tom_classification).toEqual([{ measure: 'accountability', scope: 'organisation' }]);
  });

  it('writes a page that passes the frontmatter gate', () => {
    expect(run(newDoc, ['--template', 'role', 'operating-model/roles/dpo', '--base', docs]).status).toBe(0);
    // Non-vacuity: it is the Role template's page, not a plain stub.
    expect(fm(join(docs, 'operating-model/roles/dpo.md')).kind).toBe('Role');
    const res = run(gate, [docs]);
    expect(res.status, `${res.stdout}\n${res.stderr}`).toBe(0);
  });
});

describe('never overwrite (FR-009)', () => {
  it('new-doc --template refuses an existing file and leaves its bytes; a missing sibling is still written', () => {
    const target = join(docs, 'operating-model/people.md');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, 'SENTINEL — hand-written\n', 'utf8');

    const res = run(newDoc, ['--template', 'people', '--base', docs]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(`✖ refusing to overwrite existing file: ${target}`);
    expect(readFileSync(target, 'utf8')).toBe('SENTINEL — hand-written\n');

    // Positive control in the same tree: a template whose file is missing is written.
    expect(run(newDoc, ['--template', 'data-lifecycle', '--base', docs]).status).toBe(0);
    expect(existsSync(join(docs, 'operating-model/data-lifecycle.md'))).toBe(true);
  });

  it('scaffold --preset into an empty tree writes the index and the 12 templates', () => {
    const res = run(scaffold, [docs, '--preset', 'operating-model']);
    expect(res.status, res.stderr).toBe(0);
    expect(res.stdout).toContain(`✓ scaffolded 13 file(s) under ${docs}/`);
    expect(files(docs)).toEqual(PRESET_FILES);
  });

  it('a second scaffold --preset run writes nothing and changes no byte', () => {
    expect(run(scaffold, [docs, '--preset', 'operating-model']).status).toBe(0);
    const before = snapshot(docs);
    const res = run(scaffold, [docs, '--preset', 'operating-model']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ scaffolded 0 file(s)');
    expect(res.stdout).toContain('(skipped 13 existing file(s))');
    expect(snapshot(docs)).toEqual(before);
  });

  it('a partial tree keeps its files byte-identical and gains only the missing ones', () => {
    const kept = ['operating-model/README.md', 'operations/runbooks/incident-response.md'];
    for (const rel of kept) {
      mkdirSync(dirname(join(docs, rel)), { recursive: true });
      writeFileSync(join(docs, rel), `SENTINEL ${rel}\n`, 'utf8');
    }
    const res = run(scaffold, [docs, '--preset', 'operating-model']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ scaffolded 11 file(s)');
    expect(res.stdout).toContain('(skipped 2 existing file(s))');
    for (const rel of kept) expect(readFileSync(join(docs, rel), 'utf8')).toBe(`SENTINEL ${rel}\n`);
    expect(files(docs)).toEqual(PRESET_FILES);
  });
});

describe('scaffold --preset operating-model (FR-008)', () => {
  it('writes the section index as a Hub with type Operations', () => {
    expect(run(scaffold, [docs, '--preset', 'operating-model']).status).toBe(0);
    const data = fm(join(docs, 'operating-model/README.md'));
    expect(data.kind).toBe('Hub');
    expect(data.type).toBe('Operations');
    expect(data.okf_version).toBe('0.2');
  });

  it('honours --index-basename for the section index', () => {
    expect(run(scaffold, [docs, '--preset', 'operating-model', '--index-basename', 'index']).status).toBe(0);
    expect(existsSync(join(docs, 'operating-model/index.md'))).toBe(true);
    expect(existsSync(join(docs, 'operating-model/README.md'))).toBe(false);
  });

  it('writes only the preset, not the default tree', () => {
    expect(run(scaffold, [docs, '--preset', 'operating-model']).status).toBe(0);
    expect(existsSync(join(docs, 'README.md'))).toBe(false);
    expect(existsSync(join(docs, 'guides'))).toBe(false);
  });

  it('writes a tree the frontmatter gate passes', () => {
    expect(run(scaffold, [docs, '--preset', 'operating-model']).status).toBe(0);
    const res = run(gate, [docs]);
    expect(res.status, `${res.stdout}\n${res.stderr}`).toBe(0);
    expect(res.stdout).toMatch(/✓ 13 file\(s\) valid/);
  });
});

describe('conflicts and unknown ids exit 2 and write nothing (D5)', () => {
  const cases: [string, string, string[], RegExp][] = [
    ['--template with --kind', 'new-doc', ['--template', 'people', '--kind', 'Reference'], /--template .*--kind/],
    ['--template with --section', 'new-doc', ['operating-model', '--template', 'policy-index', '--section'], /--template .*--section/],
    ['an unknown template id', 'new-doc', ['--template', 'nope'], /unknown template "nope"/],
    ['--preset with --sections', 'scaffold', ['--preset', 'operating-model', '--sections', 'guides'], /--preset .*--sections/],
    ['an unknown preset', 'scaffold', ['--preset', 'nope'], /unknown preset "nope"/],
    ['--preset=<id> (the = form)', 'scaffold', ['--preset=operating-model'], /use `--preset <id>`/],
    ['--sections=<ids> (the = form)', 'scaffold', ['--sections=guides'], /use `--sections <ids>`/],
  ];
  for (const [name, tool, args, message] of cases) {
    it(name, () => {
      const res =
        tool === 'new-doc' ? run(newDoc, [...args, '--base', docs]) : run(scaffold, [docs, ...args]);
      expect(res.status).toBe(2);
      expect(res.stderr).toMatch(message);
      expect(files(docs)).toEqual([]);
    });
  }

  it('an unknown template id lists the known ids', () => {
    const res = run(newDoc, ['--template', 'nope', '--base', docs]);
    for (const id of TEMPLATE_IDS) expect(res.stderr).toContain(id);
  });

  it('an unknown preset lists the known presets', () => {
    expect(run(scaffold, [docs, '--preset', 'nope']).stderr).toContain('operating-model');
  });
});

describe('--title rejects control characters (review nit, WP03 cycle 1)', () => {
  for (const [name, args] of [
    ['with --template', ['--template', 'people']],
    ['without --template', ['guides/x']],
  ] as const) {
    it(`a newline in --title exits 2 and writes nothing (${name})`, () => {
      const res = run(newDoc, [...args, '--title', 'Line one\nLine two', '--base', docs]);
      expect(res.status).toBe(2);
      expect(res.stderr).toMatch(/--title must not contain control characters/);
      expect(files(docs)).toEqual([]);
    });
  }

  it('an ordinary title with a colon is still accepted (positive control)', () => {
    const res = run(newDoc, ['--template', 'people', '--title', 'People: joiners and leavers', '--base', docs]);
    expect(res.status, res.stderr).toBe(0);
    expect(fm(join(docs, 'operating-model/people.md')).title).toBe('People: joiners and leavers');
  });
});

// ---------------------------------------------------------------------------
// Folded from the WP04 review (cycle 1) into WP05, before the guide documents
// the flags. Each of these failed or was unguarded at 89166d98.
// ---------------------------------------------------------------------------

/** Write the toolkit's own registry plus the operating-model snippet into `<docs>/_meta`. */
function applySnippet(docsRoot: string): void {
  const own = readFileSync(fileURLToPath(new URL('../../docs/_meta/sections.yaml', import.meta.url)), 'utf8');
  // The snippet ships indented for a `sections:` list, so it is appended verbatim.
  const snippet = readFileSync(
    fileURLToPath(new URL('../lib/templates/operating-model/sections.snippet.yaml', import.meta.url)),
    'utf8',
  );
  mkdirSync(join(docsRoot, '_meta'), { recursive: true });
  writeFileSync(join(docsRoot, '_meta/sections.yaml'), `${own.trimEnd()}\n\n${snippet}`, 'utf8');
}

describe('review folds (WP04 cycle 1)', () => {
  it('scaffold: a value flag before the base argument is not taken as the base', () => {
    const res = run(scaffold, ['--index-basename', 'index', docs, '--preset', 'operating-model']);
    expect(res.status, res.stderr).toBe(0);
    expect(existsSync(join(docs, 'operating-model/index.md'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'index'))).toBe(false);
  });

  it('new-doc --template: a slug outside the template section takes that section type', () => {
    expect(run(newDoc, ['--template', 'role', 'guides/dpo', '--base', docs]).status).toBe(0);
    const data = fm(join(docs, 'guides/dpo.md'));
    expect(data.type).toBe('Guide');
    expect(data.kind).toBe('Role');
  });

  it('new-doc --template: the type follows the site registry when the snippet is applied', () => {
    applySnippet(docs);
    expect(run(newDoc, ['--template', 'incident-response', 'operating-model/ir', '--base', docs]).status).toBe(0);
    expect(fm(join(docs, 'operating-model/ir.md')).type).toBe('Operations');
    const res = run(gate, [docs]);
    expect(res.status, `${res.stdout}\n${res.stderr}`).toBe(0);
    expect(`${res.stdout}\n${res.stderr}`).not.toMatch(/operating-model\/ir\.md.*type/);
  });

  it('new-doc --template: without a registry entry the template default type stays (positive control)', () => {
    expect(run(newDoc, ['--template', 'incident-response', 'operating-model/ir', '--base', docs]).status).toBe(0);
    expect(fm(join(docs, 'operating-model/ir.md')).type).toBe('Runbook');
  });

  it('scaffold --preset: a snippet tree validates with no type warnings', () => {
    applySnippet(docs);
    expect(run(scaffold, [docs, '--preset', 'operating-model']).status).toBe(0);
    expect(fm(join(docs, 'operating-model/README.md')).type).toBe('Operations');
    expect(fm(join(docs, 'operations/runbooks/incident-response.md')).type).toBe('Runbook');
    const res = run(gate, [docs]);
    expect(res.status, `${res.stdout}\n${res.stderr}`).toBe(0);
    expect(`${res.stdout}\n${res.stderr}`).not.toMatch(/operating-model\/.*`type/);
  });

  it('new-doc: a C1 control character (U+0085) in --title exits 2 and writes nothing', () => {
    const res = run(newDoc, ['--template', 'people', '--title', 'Line\u0085two', '--base', docs]);
    expect(res.status).toBe(2);
    expect(res.stderr).toMatch(/--title must not contain control characters/);
    expect(files(docs).filter((f) => !f.startsWith('_meta'))).toEqual([]);
  });
});

describe('flag values are checked before writing (R24 squad)', () => {
  for (const flag of ['--base', '--type'] as const) {
    it(`new-doc --template with a bare ${flag} exits 2 with a message, not a stack trace`, () => {
      const res = spawnSync(process.execPath, [newDoc, '--template', 'people', flag], { encoding: 'utf8', cwd: root });
      expect(res.status).toBe(2);
      expect(res.stderr).toMatch(new RegExp(`✖ ${flag} needs a value`));
      expect(res.stderr).not.toMatch(/TypeError|at /);
      expect(files(root)).toEqual([]);
    });
  }
});
