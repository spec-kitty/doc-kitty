/**
 * The pack reader (#330, ADR-0079 D3, D4): fixture packs read into the
 * documented `PackModel` with the expected warnings and `verified` flags. The
 * reader never throws on pack content.
 *
 * The fixture manifests' content hashes were computed with `packContentHash`
 * (SHA-256 after CRLF and lone CR become LF). `alpha`'s tactic has CRLF line
 * endings on purpose (`.gitattributes` marks the fixtures `-text`), so its
 * manifest hash proves the recipe; `delta`'s manifest carries unquoted all-digit
 * hashes, which must read as strings, not numbers.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packContentHash, readPack } from '../lib/packs/read.mjs';
import * as packs from '../lib/packs/index.mjs';

const FIXTURES = fileURLToPath(new URL('./fixtures/packs/', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const READ_WITH = '69ec326179246c9a79eca1ba1d424f059f5153e2';
const fixture = (p: string) => path.join(FIXTURES, p);
const codes = (m: { problems: { code: string }[] }) => m.problems.map((p) => p.code);

const temps: string[] = [];
afterEach(() => {
  for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
});
function temp() {
  const dir = mkdtempSync(path.join(tmpdir(), 'dk-packs-read-'));
  temps.push(dir);
  return dir;
}

describe('a pack with a current manifest (alpha)', () => {
  const model = readPack(fixture('with-manifest/alpha'), { repoRoot: REPO_ROOT });

  it('reads the identity in ADR-0079 D4 order, the directory being the slug', () => {
    expect(model.dir).toBe('alpha');
    expect(model.path).toBe('src/tests/fixtures/packs/with-manifest/alpha');
    expect(model.identity).toEqual({
      packId: '01JALPHA0000000000000000AA',
      name: 'alpha-pack',
      version: '1.2.0',
      level: 'org',
      parent: null,
      dependsOn: [{ packId: '01JBETA00000000000000000BB', range: '>=1.0,<2.0' }],
      schemaVersion: '1.0',
    });
    expect(Object.keys(model.identity)).toEqual(['packId', 'name', 'version', 'level', 'parent', 'dependsOn', 'schemaVersion']);
  });

  it('parses the README, keeping its frontmatter apart', () => {
    expect(model.document?.frontmatter).toEqual({ owner: 'docs-team' });
    expect(model.document?.title).toBe('Alpha pack');
    expect(model.document?.preamble).toMatch(/^The alpha pack holds/);
    expect(model.document?.sections.map((s) => s.title)).toEqual(['Purpose', 'Provenance']);
  });

  it('reads the presets and the policy named by mutability_policy', () => {
    expect(model.presets).toEqual([{ name: 'minimal', path: 'presets/minimal.yaml' }]);
    expect(model.policy).toEqual({ kindDefaults: { directive: 'locked' }, artifacts: { 'tactic:t': 'extendable' } });
  });

  it('verifies the manifest, the CRLF tactic included, and takes the inventory from it', () => {
    expect(model.manifest?.verified).toBe(true);
    expect(model.manifest?.hash).toBe('a'.repeat(64));
    const tactic = readFileSync(fixture('with-manifest/alpha/tactics/t.tactic.yaml'));
    expect(tactic.includes(Buffer.from('\r\n'))).toBe(true);
    const raw = createHash('sha256').update(tactic).digest('hex');
    const entry = model.manifest?.constituents.find((c) => c.id === 't');
    expect(entry?.contentHash).toBe(packContentHash(tactic));
    expect(entry?.contentHash).not.toBe(raw);
    expect(model.inventory).toEqual({
      source: 'manifest',
      kinds: [
        { kind: 'directive', ids: ['a'] },
        { kind: 'tactic', ids: ['t'] },
        { kind: 'template', ids: ['spec.md'] },
      ],
    });
  });

  it('has no problems and records the contract it was read with', () => {
    expect(model.problems).toEqual([]);
    expect(model.contract).toEqual({ readWith: READ_WITH });
  });
});

describe('a pack with no manifest (beta)', () => {
  const model = readPack(fixture('no-manifest/beta'));

  it('reads with a file-kinds inventory and no manifest, with no problem', () => {
    expect(model.manifest).toBeUndefined();
    expect(model.policy).toBeUndefined();
    expect(model.inventory).toEqual({ source: 'file-kinds', kinds: [{ kind: 'directive', ids: ['b'] }] });
    expect(model.document?.title).toBeUndefined();
    expect(model.identity.dependsOn).toEqual([]);
    expect(model.problems).toEqual([]);
  });
});

describe('a pack with a retired file (gamma)', () => {
  it('warns on the retired and the unmodelled file only; ignored Markdown is silent', () => {
    const model = readPack(fixture('retired-file/gamma'));
    expect(model.problems.map((p) => [p.code, p.file])).toEqual([
      ['unmodelled', 'notes.txt'],
      ['retired', 'pack.md'],
    ]);
    expect(model.problems[1].message).toMatch(/\*\/pack\.md/);
  });
});

describe('a pack with a stale manifest (delta)', () => {
  const model = readPack(fixture('stale-manifest/delta'));

  it('is unverified, falls back to the file-kinds inventory, and names each gap once', () => {
    expect(model.manifest?.verified).toBe(false);
    expect(model.inventory).toEqual({ source: 'file-kinds', kinds: [{ kind: 'directive', ids: ['changed', 'kept', 'unlisted'] }] });
    expect(model.problems.map((p) => [p.code, p.file])).toEqual([
      ['manifest-hash-mismatch', 'directives/changed.directive.yaml'],
      ['manifest-missing-file', 'directives/gone.directive.yaml'],
      ['manifest-unlisted', 'directives/unlisted.directive.yaml'],
    ]);
  });

  it('reads unquoted all-digit hashes as strings', () => {
    expect(model.manifest?.constituents.map((c) => c.contentHash)).toEqual([
      expect.stringMatching(/^[0-9a-f]{64}$/),
      '0'.repeat(64),
      '1'.repeat(64),
    ]);
  });
});

describe('the charter lock (ADR-0079 D2)', () => {
  it('warns on a mismatched commit and records both', () => {
    const dir = temp();
    writeFileSync(path.join(dir, 'charter.lock.yaml'), `commit: ${'c'.repeat(40)}\n`);
    const model = readPack(fixture('no-manifest/beta'), { charterLock: path.join(dir, 'charter.lock.yaml') });
    expect(model.contract).toEqual({ readWith: READ_WITH, provenAgainst: 'c'.repeat(40) });
    expect(codes(model)).toEqual(['charter-lock-mismatch']);
    expect(model.problems[0].message).toContain('c'.repeat(40));
    expect(model.problems[0].message).toContain(READ_WITH);
  });

  it('is silent when the commits agree', () => {
    const dir = temp();
    writeFileSync(path.join(dir, 'charter.lock.yaml'), `commit: ${READ_WITH}\nrelease_tag: x\n`);
    const model = readPack(fixture('no-manifest/beta'), { charterLock: path.join(dir, 'charter.lock.yaml') });
    expect(model.contract.provenAgainst).toBe(READ_WITH);
    expect(model.problems).toEqual([]);
  });

  it('warns on a missing lock file or one with no commit', () => {
    const dir = temp();
    expect(codes(readPack(fixture('no-manifest/beta'), { charterLock: path.join(dir, 'absent.yaml') }))).toEqual([
      'charter-lock-unreadable',
    ]);
    writeFileSync(path.join(dir, 'empty.yaml'), 'release_tag: x\n');
    const model = readPack(fixture('no-manifest/beta'), { charterLock: path.join(dir, 'empty.yaml') });
    expect(codes(model)).toEqual(['charter-lock-unreadable']);
    expect(model.contract.provenAgainst).toBeUndefined();
  });
});

describe('robustness', () => {
  it('never throws on broken pack content', () => {
    const root = temp();
    const dir = path.join(root, 'broken');
    cpSync(fixture('no-manifest/beta'), dir, { recursive: true });
    writeFileSync(path.join(dir, 'pack.yaml'), 'pack_id: [unclosed\n');
    writeFileSync(path.join(dir, 'README.md'), '');
    writeFileSync(path.join(dir, 'pack-manifest.yaml'), ': : :\n  - [\n');
    writeFileSync(path.join(dir, 'blob.bin'), Buffer.from([0, 255, 1, 254]));
    symlinkSync(path.join(dir, 'directives'), path.join(dir, 'linked'));
    const model = readPack(dir);
    expect(model.identity).toEqual({ packId: '', name: 'broken', version: '', dependsOn: [] });
    // Sorted by file (blob.bin, linked, pack-manifest.yaml, pack.yaml), then code.
    expect(model.problems.map((p) => [p.code, p.file])).toEqual([
      ['unmodelled', 'blob.bin'],
      ['symlink', 'linked'],
      ['manifest-unreadable', 'pack-manifest.yaml'],
      ['descriptor-unreadable', 'pack.yaml'],
    ]);
  });

  it('warns on a missing descriptor, missing and unknown keys, and a named but missing policy', () => {
    const root = temp();
    const none = path.join(root, 'none');
    cpSync(fixture('no-manifest/beta'), none, { recursive: true });
    rmSync(path.join(none, 'pack.yaml'));
    expect(codes(readPack(none))).toEqual(['descriptor-missing']);
    const odd = path.join(root, 'odd');
    cpSync(fixture('no-manifest/beta'), odd, { recursive: true });
    writeFileSync(path.join(odd, 'pack.yaml'), 'name: odd\nflavour: mint\nmutability_policy: policy.yaml\nschema_version: "2.0"\n');
    expect(codes(readPack(odd))).toEqual([
      'descriptor-missing-key',
      'descriptor-missing-key',
      'descriptor-schema-version',
      'descriptor-unknown-key',
      'policy-missing',
    ]);
  });

  it('refuses a manifest entry reached through a symlinked directory, and does not verify', () => {
    const root = temp();
    const dir = path.join(root, 'beta');
    cpSync(fixture('no-manifest/beta'), dir, { recursive: true });
    const outside = path.join(root, 'outside');
    cpSync(path.join(dir, 'directives'), outside, { recursive: true });
    rmSync(path.join(dir, 'directives'), { recursive: true });
    symlinkSync(outside, path.join(dir, 'directives'));
    const hash = packContentHash(readFileSync(path.join(outside, 'b.directive.yaml')));
    writeFileSync(
      path.join(dir, 'pack-manifest.yaml'),
      `schema_version: "1.0"\nmanifest_hash: ${'b'.repeat(64)}\nconstituents:\n  - kind: directive\n    id: b\n    path: directives/b.directive.yaml\n    content_hash: ${hash}\n`,
    );
    const model = readPack(dir);
    expect(model.manifest?.verified).toBe(false);
    expect(model.inventory.source).toBe('file-kinds');
    expect(model.problems.map((p) => [p.code, p.file])).toEqual([
      ['symlink', 'directives'],
      ['manifest-missing-file', 'directives/b.directive.yaml'],
    ]);
  });

  it('reads no file through a symlink: pack.yaml, the README and the policy', () => {
    const root = temp();
    const dir = path.join(root, 'beta');
    cpSync(fixture('no-manifest/beta'), dir, { recursive: true });
    const outside = path.join(root, 'outside');
    mkdirSync(outside);
    writeFileSync(path.join(outside, 'README.md'), '# Outside\n');
    writeFileSync(path.join(outside, 'policy.yaml'), 'schema_version: 1\nkind_defaults:\n  directive: locked\n');
    rmSync(path.join(dir, 'README.md'));
    symlinkSync(path.join(outside, 'README.md'), path.join(dir, 'README.md'));
    symlinkSync(path.join(outside, 'policy.yaml'), path.join(dir, 'policy.yaml'));
    writeFileSync(path.join(dir, 'pack.yaml'), readFileSync(path.join(dir, 'pack.yaml'), 'utf8') + 'mutability_policy: policy.yaml\n');
    const model = readPack(dir);
    expect(model.document).toBeUndefined();
    expect(model.policy).toBeUndefined();
    expect(codes(model)).toEqual(['symlink', 'policy-missing', 'symlink']);
  });

  it('never instantiates YAML tags: frontmatter, descriptor and manifest values stay plain data', () => {
    const root = temp();
    const dir = path.join(root, 'tagged');
    cpSync(fixture('no-manifest/beta'), dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'README.md'),
      '---\nblob: !!binary aGVsbG8=\nwhen: !!timestamp 2026-01-01\nset: !!set {a: null}\nmap: !!omap [{a: 1}]\n---\n\n# Tagged\n',
    );
    writeFileSync(path.join(dir, 'pack.yaml'), 'pack_id: 01JTAGGED0000000000000000T\nname: tagged\npack_version: 1.10\nschema_version: 1.0\n');
    const model = readPack(dir);
    const fm = model.document?.frontmatter as Record<string, unknown>;
    for (const value of Object.values(fm)) {
      expect(Buffer.isBuffer(value) || value instanceof Date || value instanceof Set || value instanceof Map).toBe(false);
    }
    expect(model.identity.version).toBe('1.10');
    expect(model.identity.schemaVersion).toBe('1.0');
    expect(codes(model)).toEqual([]);
  });

  it('treats a non-string descriptor value as absent and warns, never showing a coerced value', () => {
    const root = temp();
    const dir = path.join(root, 'odd');
    cpSync(fixture('no-manifest/beta'), dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'pack.yaml'),
      [
        'pack_id: 01JODD0000000000000000000O',
        'name: odd',
        'pack_version: [x]',
        'parent_pack: {a: 1}',
        'pack_level: [org]',
        'schema_version: {v: 1}',
        'depends_on:',
        '  - pack_id: {x: 1}',
        '    range: ">=1"',
        '  - pack_id: 01JBETA00000000000000000BB',
        '    range: [1]',
        '',
      ].join('\n'),
    );
    const model = readPack(dir);
    expect(model.identity).toEqual({
      packId: '01JODD0000000000000000000O',
      name: 'odd',
      version: '',
      dependsOn: [{ packId: '01JBETA00000000000000000BB' }],
    });
    expect(JSON.stringify(model)).not.toContain('[object Object]');
    const invalid = model.problems.filter((p) => p.code === 'descriptor-invalid-value');
    expect(invalid.map((p) => p.message.match(/`([^`]+)`/)?.[1])).toEqual([
      'depends_on[0].pack_id',
      'depends_on[1].range',
      'pack_level',
      'pack_version',
      'parent_pack',
      'schema_version',
    ]);
  });

  it('refuses a manifest entry whose fields are not strings, and does not verify', () => {
    const root = temp();
    const dir = path.join(root, 'alpha');
    cpSync(fixture('with-manifest/alpha'), dir, { recursive: true });
    const file = path.join(dir, 'pack-manifest.yaml');
    writeFileSync(file, readFileSync(file, 'utf8').replace('    path: directives/a.directive.yaml', '    path: [directives/a.directive.yaml]'));
    const model = readPack(dir);
    expect(model.manifest?.verified).toBe(false);
    expect(model.manifest?.constituents.map((c) => c.id)).toEqual(['t', 'spec.md']);
    expect(JSON.stringify(model)).not.toContain('[object Object]');
    expect(model.problems.map((p) => [p.code, p.file])).toEqual([
      ['manifest-unlisted', 'directives/a.directive.yaml'],
      ['manifest-invalid-entry', 'pack-manifest.yaml'],
    ]);
  });

  it('does not verify a manifest that lists what the pack does not hold as a constituent, twice, or under another kind', () => {
    const root = temp();
    const dir = path.join(root, 'alpha');
    cpSync(fixture('with-manifest/alpha'), dir, { recursive: true });
    const file = path.join(dir, 'pack-manifest.yaml');
    const hashOf = (rel: string) => packContentHash(readFileSync(path.join(dir, rel)));
    const extra = [
      ['directive', 'ghost', 'README.md'],
      ['directive', 'a-again', 'directives/a.directive.yaml'],
    ]
      .map(([kind, id, p]) => `  - kind: ${kind}\n    id: ${id}\n    path: ${p}\n    content_hash: ${hashOf(p)}\n`)
      .join('');
    // The tactic is listed under another known kind.
    writeFileSync(file, readFileSync(file, 'utf8').replace('presets:\n', `${extra}presets:\n`).replace('kind: tactic', 'kind: agent_profile'));
    const model = readPack(dir);
    expect(model.manifest?.verified).toBe(false);
    expect(model.inventory.source).toBe('file-kinds');
    expect(model.problems.map((p) => [p.code, p.file])).toEqual([
      ['manifest-not-a-constituent', 'README.md'],
      ['manifest-duplicate-entry', 'directives/a.directive.yaml'],
      ['manifest-kind-mismatch', 'tactics/t.tactic.yaml'],
    ]);
  });

  it('does not verify a manifest that lists a kind the contract does not know', () => {
    const root = temp();
    const dir = path.join(root, 'alpha');
    cpSync(fixture('with-manifest/alpha'), dir, { recursive: true });
    const file = path.join(dir, 'pack-manifest.yaml');
    writeFileSync(file, readFileSync(file, 'utf8').replace('kind: tactic', 'kind: totally_bogus').replace('schema_version: "1.0"', 'schema_version: "2.0"'));
    const model = readPack(dir);
    expect(model.manifest?.verified).toBe(false);
    expect(model.problems.map((p) => [p.code, p.file])).toEqual([
      ['manifest-schema-version', 'pack-manifest.yaml'],
      ['manifest-unknown-kind', 'tactics/t.tactic.yaml'],
    ]);
  });

  it('keeps only single policy values, and never a prototype key', () => {
    const root = temp();
    const dir = path.join(root, 'alpha');
    cpSync(fixture('with-manifest/alpha'), dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'policy.yaml'),
      'schema_version: 1\nkind_defaults:\n  __proto__: {polluted: yes}\n  directive: [a, b]\n  tactic: locked\nartifacts:\n  constructor: open\n  "tactic:t": extendable\n',
    );
    const model = readPack(dir);
    expect(model.policy).toEqual({ kindDefaults: { tactic: 'locked' }, artifacts: { 'tactic:t': 'extendable' } });
    expect(Object.keys(model.policy?.kindDefaults ?? {})).toEqual(['tactic']);
    expect(model.problems.map((p) => p.code)).toEqual(['policy-invalid-value', 'policy-invalid-value', 'policy-invalid-value']);
  });

  it('warns on a policy that is not a mapping', () => {
    const root = temp();
    const dir = path.join(root, 'alpha');
    cpSync(fixture('with-manifest/alpha'), dir, { recursive: true });
    writeFileSync(path.join(dir, 'policy.yaml'), '- just\n- a list\n');
    const model = readPack(dir);
    expect(model.policy).toBeUndefined();
    expect(model.problems.map((p) => [p.code, p.file])).toEqual([['policy-unreadable', 'policy.yaml']]);
  });

  it('carries the contract snapshot’s own warnings into the model', () => {
    const snapshot = temp();
    cpSync(fileURLToPath(new URL('../lib/packs/contract/', import.meta.url)), snapshot, { recursive: true });
    const fk = path.join(snapshot, 'file-kinds.yaml');
    writeFileSync(fk, readFileSync(fk, 'utf8') + '\nshiny_new_section: []\n');
    const lockFile = path.join(snapshot, 'contract.lock.json');
    const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
    lock.files['file-kinds.yaml'] = createHash('sha256').update(readFileSync(fk)).digest('hex');
    writeFileSync(lockFile, JSON.stringify(lock));
    const model = readPack(fixture('no-manifest/beta'), { contract: snapshot });
    expect(codes(model)).toEqual(['contract-unknown-key']);
    expect(model.problems[0].file).toBeUndefined();
  });

  it('gives the same model whatever order the directory lists its files in', () => {
    const root = temp();
    const copy = path.join(root, 'alpha');
    // Recreate the pack file by file in reverse order, so its directory entries
    // are created in another order than the fixture's.
    const files: string[] = [];
    const walk = (d: string, base = d): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const abs = path.join(d, e.name);
        if (e.isDirectory()) walk(abs, base);
        else files.push(path.relative(base, abs));
      }
    };
    walk(fixture('with-manifest/alpha'));
    for (const rel of [...files].reverse()) {
      mkdirSync(path.dirname(path.join(copy, rel)), { recursive: true });
      writeFileSync(path.join(copy, rel), readFileSync(path.join(fixture('with-manifest/alpha'), rel)));
    }
    const strip = (m: ReturnType<typeof readPack>) => JSON.stringify({ ...m, path: '' });
    expect(strip(readPack(copy))).toBe(strip(readPack(fixture('with-manifest/alpha'))));
  });

  it('is deterministic: two reads give byte-identical JSON', () => {
    for (const p of ['with-manifest/alpha', 'no-manifest/beta', 'retired-file/gamma', 'stale-manifest/delta']) {
      expect(JSON.stringify(readPack(fixture(p)))).toBe(JSON.stringify(readPack(fixture(p))));
    }
  });

  it('refuses a path that is not a directory', () => {
    expect(() => readPack(fixture('with-manifest/alpha/pack.yaml'))).toThrow(/\[dk-packs\]/);
  });
});

describe('the public surface', () => {
  it('re-exports the reader, the parser, the contract loader and the classifier', () => {
    expect(Object.keys(packs).sort()).toEqual(
      ['classify', 'createClassifier', 'loadContract', 'packContentHash', 'parsePackDocument', 'readPack', 'verifyContractLock'].sort(),
    );
  });
});
