/**
 * The pack reader (#330, ADR-0079 D1, D3, D4): the ONLY code in doc-kitty that
 * knows the pack format. It turns a pack directory into doc-kitty's own
 * `PackModel`, an anti-corruption layer over the charter's packs contract.
 *
 * It is tolerant. It never validates a pack (the charter service judges) and it
 * never throws on pack content: what rendering needs to know is a warning in
 * `problems`. It does check what a page would display as fact: each manifest
 * constituent's `content_hash` is recomputed, and `manifest.verified` says
 * whether every hash and the membership matched. It reads files only, imports
 * no Spec Kitty code and fetches nothing.
 *
 * @module packs/read
 */

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { loadContract } from './contract.mjs';
import { createClassifier } from './classify.mjs';
import { parsePackDocument } from './readme.mjs';

/**
 * @typedef {{ severity: 'warning', code: string, file?: string, message: string }} PackProblem
 * @typedef {{ kind: string, ids: string[] }} InventoryKind
 * @typedef {object} PackModel
 * @property {string} dir
 * @property {string} path
 * @property {{ packId: string, name: string, version: string, level?: string, parent?: string | null,
 *   dependsOn: { packId: string, range?: string }[], schemaVersion?: string }} identity
 * @property {{ frontmatter?: Record<string, unknown>, title?: string, preamble: string,
 *   sections: { title: string, content: string }[] }} [document]
 * @property {{ hash: string, verified: boolean,
 *   constituents: { kind: string, id: string, path: string, contentHash: string }[] }} [manifest]
 * @property {{ name: string, path: string }[]} presets
 * @property {{ kindDefaults: Record<string, string>, artifacts: Record<string, string> }} [policy]
 * @property {{ source: 'manifest' | 'file-kinds', kinds: InventoryKind[] }} inventory
 * @property {PackProblem[]} problems
 * @property {{ readWith: string, provenAgainst?: string }} contract
 */

/** @param {string} a @param {string} b */
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The manifest's content-hash recipe: SHA-256, lower hex, of the bytes after
 * CRLF and lone CR are replaced by LF.
 *
 * @param {Buffer} bytes
 */
export function packContentHash(bytes) {
  const normalised = Buffer.from(bytes.toString('latin1').replace(/\r\n?/g, '\n'), 'latin1');
  return createHash('sha256').update(normalised).digest('hex');
}

/**
 * How every pack file is parsed: data only. Known tags (`!!binary`, `!!set`,
 * `!!timestamp`, `!!omap`) are not resolved to objects, and the failsafe schema
 * reads every scalar as a string, so `pack_version: 1.10` stays `1.10` and a
 * manifest's unquoted all-digit hash stays a hash. A pack is another
 * repository's content.
 */
const YAML_OPTIONS = Object.freeze({ schema: 'failsafe', resolveKnownTags: false, logLevel: 'error' });

/**
 * Read and parse a YAML file at an absolute path: `{ value }`, or `{ error }` when
 * it is missing or does not parse.
 *
 * @param {string | undefined} file
 * @returns {{ value?: any, error?: 'missing' | string }}
 */
function readYamlFile(file) {
  if (file === undefined || !existsSync(file)) return { error: 'missing' };
  try {
    return { value: parseYaml(readFileSync(file, 'utf8'), YAML_OPTIONS) };
  } catch (error) {
    return { error: /** @type {Error} */ (error).message.split('\n')[0] };
  }
}

/**
 * The absolute path of a regular file the pack holds at `rel`, or undefined: a
 * path that escapes the pack, or any of whose components is a symlink, is not
 * held (it would be read through the link), and neither is a directory.
 *
 * @param {string} root the pack directory, absolute
 * @param {string} rel pack-relative, `/`-separated
 * @returns {string | undefined}
 */
function heldFile(root, rel) {
  if (rel === '' || path.isAbsolute(rel)) return undefined;
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) return undefined;
  let current = root;
  for (const part of path.relative(root, abs).split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = lstatSync(current);
    } catch {
      return undefined;
    }
    if (stat.isSymbolicLink()) return undefined;
    if (current === abs) return stat.isFile() ? abs : undefined;
  }
  return undefined;
}

/**
 * Read a YAML file the pack holds (see {@link heldFile}).
 *
 * @param {string} root
 * @param {string} rel
 */
const readHeldYaml = (root, rel) => readYamlFile(heldFile(root, rel));

/**
 * Is a failsafe-schema scalar one of YAML's null spellings (or absent)?
 *
 * @param {unknown} v
 */
const isYamlNull = (v) => v === null || v === undefined || (typeof v === 'string' && ['', '~', 'null', 'Null', 'NULL'].includes(v));

/** @param {unknown} v @returns {v is Record<string, any>} */
const isMapping = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Every file under the pack, pack-relative POSIX paths, sorted. Symlinks are
 * reported, never followed; `.git` directories are skipped.
 *
 * @param {string} root
 * @returns {{ files: string[], symlinks: string[] }}
 */
function walkPack(root) {
  /** @type {string[]} */
  const files = [];
  /** @type {string[]} */
  const symlinks = [];
  /** @param {string} sub */
  const walk = (sub) => {
    const entries = readdirSync(path.join(root, sub), { withFileTypes: true }).sort((a, b) => byCodeUnit(a.name, b.name));
    for (const entry of entries) {
      const rel = sub === '' ? entry.name : `${sub}/${entry.name}`;
      if (entry.isSymbolicLink()) symlinks.push(rel);
      else if (entry.isDirectory()) {
        if (entry.name !== '.git') walk(rel);
      } else if (entry.isFile()) files.push(rel);
    }
  };
  walk('');
  return { files: files.sort(byCodeUnit), symlinks: symlinks.sort(byCodeUnit) };
}

/**
 * The artefact id the walk inventory uses for a constituent file: the YAML `id`
 * when it parses and has one; a template's path below `templates/` (prefixed
 * `<type>/` for a mission type's templates); else the stem before the kind suffix.
 *
 * @param {string} rel pack-relative path
 * @param {string} artifactKind
 * @param {string} root the pack directory
 */
function artifactId(rel, artifactKind, root) {
  if (artifactKind === 'template') {
    const mission = /^missions\/([^/]+)\/templates\/(.+)$/.exec(rel);
    if (mission) return `${mission[1]}/${mission[2]}`;
    const top = /^templates\/(.+)$/.exec(rel);
    if (top) return top[1];
  }
  if (/\.ya?ml$/.test(rel)) {
    const { value } = readHeldYaml(root, rel);
    if (isMapping(value) && typeof value.id === 'string' && value.id !== '') return value.id;
  }
  const base = rel.split('/').pop() ?? rel;
  const token = artifactKind.replace(/_/g, '-');
  const suffix = new RegExp(`\\.(?:${token}|${artifactKind}|agent)\\.ya?ml$`);
  return base.replace(suffix, '').replace(/\.ya?ml$/, '');
}

/**
 * Read a pack directory into a `PackModel`.
 *
 * @param {string} dir the pack directory
 * @param {{ contract?: string | import('./contract.mjs').LoadedContract, charterLock?: string, repoRoot?: string }} [options]
 * @returns {PackModel}
 */
export function readPack(dir, options = {}) {
  const root = path.resolve(dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`[dk-packs] ${dir} is not a directory`);
  const contract = typeof options.contract === 'object' ? options.contract : loadContract(options.contract);
  const { fileKinds, schemas } = contract;
  const classifyPath = createClassifier(fileKinds);
  const artifactKinds = new Set(Array.isArray(fileKinds.artifact_kinds) ? fileKinds.artifact_kinds : []);
  const packDir = path.basename(root);
  /** @type {PackProblem[]} */
  const problems = [];
  /** @param {string} code @param {string} message @param {string} [file] */
  const warn = (code, message, file) => problems.push({ severity: 'warning', code, ...(file ? { file } : {}), message });

  // --- walk and classify --------------------------------------------------
  const { files, symlinks } = walkPack(root);
  for (const link of symlinks) warn('symlink', 'a symlink inside the pack is not followed', link);
  /** @type {Map<string, import('./classify.mjs').Classification>} */
  const classes = new Map();
  for (const rel of files) {
    const c = classifyPath(`${packDir}/${rel}`);
    classes.set(rel, c);
    if (c.expect === 'retired') warn('retired', `retired by the contract rule \`${c.rule}\`: ${c.reason ?? 'a retired layout'}`, rel);
    else if (c.expect === 'unmodelled') warn('unmodelled', 'no rule of the packs contract classifies this file', rel);
  }
  /** @param {string} kind */
  const filesOfKind = (kind) => files.filter((rel) => classes.get(rel)?.expect === 'mapped' && classes.get(rel)?.kind === kind);

  // --- descriptor ---------------------------------------------------------
  /** @type {{ packId: string, name: string, version: string, level?: string, parent?: string | null,
   *   dependsOn: { packId: string, range?: string }[], schemaVersion?: string }} */
  const id = { packId: '', name: packDir, version: '', dependsOn: [] };
  const descriptorSchema = schemas['pack-descriptor'] ?? {};
  const descriptor = readHeldYaml(root, 'pack.yaml');
  /** @type {Record<string, any>} */
  let desc = {};
  if (descriptor.error === 'missing') warn('descriptor-missing', 'the pack has no pack.yaml', 'pack.yaml');
  else if (descriptor.error || !isMapping(descriptor.value)) {
    warn('descriptor-unreadable', `pack.yaml does not parse as a mapping${descriptor.error ? `: ${descriptor.error}` : ''}`, 'pack.yaml');
  } else {
    desc = descriptor.value;
    const known = new Set(Object.keys(descriptorSchema.properties ?? {}));
    for (const key of Object.keys(desc)) {
      if (known.size > 0 && !known.has(key)) warn('descriptor-unknown-key', `pack.yaml has a key \`${key}\` the contract does not declare`, 'pack.yaml');
    }
    for (const key of descriptorSchema.required ?? []) {
      if (desc[key] === undefined || desc[key] === null || desc[key] === '') warn('descriptor-missing-key', `pack.yaml has no \`${key}\``, 'pack.yaml');
    }
    // Under the failsafe schema every scalar is a string. A mapping or a list
    // where a single value belongs is absent, with a warning: it is never shown
    // coerced (`[object Object]`, or `[x]` as `x`).
    /** @param {string} key */
    const invalid = (key) =>
      warn('descriptor-invalid-value', `\`${key}\` in pack.yaml is not a single value; it is ignored`, 'pack.yaml');
    /** @param {string} key @param {unknown} value @returns {string | undefined} */
    const scalar = (key, value) => {
      if (value === undefined || typeof value === 'string') return value;
      invalid(key);
      return undefined;
    };
    const schemaVersion = scalar('schema_version', desc.schema_version);
    if (schemaVersion !== undefined && schemaVersion !== '1.0') {
      warn('descriptor-schema-version', `pack.yaml has schema_version ${JSON.stringify(schemaVersion)}; this reader knows 1.0`, 'pack.yaml');
    }
    const packId = scalar('pack_id', desc.pack_id);
    if (packId !== undefined) id.packId = packId;
    const name = scalar('name', desc.name);
    if (name !== undefined && name !== '') id.name = name;
    id.version = scalar('pack_version', desc.pack_version) ?? '';
    const level = scalar('pack_level', desc.pack_level);
    if (level !== undefined) id.level = level;
    if ('parent_pack' in desc) {
      if (isYamlNull(desc.parent_pack)) id.parent = null;
      else {
        const parent = scalar('parent_pack', desc.parent_pack);
        if (parent !== undefined) id.parent = parent;
      }
    }
    if (Array.isArray(desc.depends_on)) {
      /** @type {{ packId: string, range?: string }[]} */
      const deps = [];
      desc.depends_on.forEach((/** @type {unknown} */ d, /** @type {number} */ i) => {
        if (!isMapping(d)) {
          invalid(`depends_on[${i}]`);
          return;
        }
        const depId = scalar(`depends_on[${i}].pack_id`, d.pack_id);
        const range = scalar(`depends_on[${i}].range`, d.range);
        if (depId !== undefined) deps.push({ packId: depId, ...(range !== undefined ? { range } : {}) });
      });
      id.dependsOn = deps;
    } else if (desc.depends_on !== undefined && !isYamlNull(desc.depends_on)) {
      invalid('depends_on');
    }
    if (schemaVersion !== undefined) id.schemaVersion = schemaVersion;
  }

  // ADR-0079 D4 key order, so the JSON is stable and reads like the interface.
  /** @type {PackModel['identity']} */
  const identity = {
    packId: id.packId,
    name: id.name,
    version: id.version,
    ...(id.level !== undefined ? { level: id.level } : {}),
    ...('parent' in id ? { parent: id.parent } : {}),
    dependsOn: id.dependsOn,
    ...(id.schemaVersion !== undefined ? { schemaVersion: id.schemaVersion } : {}),
  };

  // --- README -------------------------------------------------------------
  /** @type {PackModel['document']} */
  let document;
  const readme = heldFile(root, 'README.md');
  if (readme !== undefined) {
    try {
      const parsed = parsePackDocument(readFileSync(readme, 'utf8'));
      for (const p of parsed.problems) warn(p.code, p.message, 'README.md');
      const { problems: _drop, ...doc } = parsed;
      document = doc;
    } catch (error) {
      warn('readme-unreadable', `README.md could not be read: ${/** @type {Error} */ (error).message}`, 'README.md');
    }
  }

  // --- presets ------------------------------------------------------------
  const presets = filesOfKind('preset').map((rel) => {
    const { value } = readHeldYaml(root, rel);
    const stem = (rel.split('/').pop() ?? rel).replace(/\.ya?ml$/, '');
    return { name: isMapping(value) && typeof value.id === 'string' ? value.id : stem, path: rel };
  });

  // --- policy -------------------------------------------------------------
  /** @type {PackModel['policy']} */
  let policy;
  if (typeof desc.mutability_policy === 'string') {
    const rel = desc.mutability_policy;
    const read = readHeldYaml(root, rel);
    if (read.error === 'missing') warn('policy-missing', `mutability_policy names ${rel}, which the pack does not hold`, rel);
    else if (read.error || !isMapping(read.value)) warn('policy-unreadable', `${rel} does not parse as a mapping${read.error ? `: ${read.error}` : ''}`, rel);
    else {
      policy = {
        kindDefaults: isMapping(read.value.kind_defaults) ? { ...read.value.kind_defaults } : {},
        artifacts: isMapping(read.value.artifacts) ? { ...read.value.artifacts } : {},
      };
    }
  }

  // --- constituents and the walk inventory -----------------------------------
  /** @type {Map<string, { kind: string, id: string }>} */
  const candidates = new Map();
  for (const rel of files) {
    const c = classes.get(rel);
    if (c?.expect !== 'mapped' || !c.kind) continue;
    const artifactKind = c.kind.replace(/-/g, '_');
    if (!artifactKinds.has(artifactKind)) continue;
    candidates.set(rel, { kind: artifactKind, id: artifactId(rel, artifactKind, root) });
  }
  /** @param {Iterable<{ kind: string, id: string }>} entries @returns {InventoryKind[]} */
  const inventoryOf = (entries) => {
    /** @type {Map<string, Set<string>>} */
    const byKind = new Map();
    for (const { kind, id } of entries) {
      if (!byKind.has(kind)) byKind.set(kind, new Set());
      byKind.get(kind)?.add(id);
    }
    return [...byKind.keys()].sort(byCodeUnit).map((kind) => ({ kind, ids: [...(byKind.get(kind) ?? [])].sort(byCodeUnit) }));
  };

  // --- manifest -----------------------------------------------------------
  /** @type {PackModel['manifest']} */
  let manifest;
  const manifestRead = readHeldYaml(root, 'pack-manifest.yaml');
  if (manifestRead.error && manifestRead.error !== 'missing') {
    warn('manifest-unreadable', `pack-manifest.yaml does not parse: ${manifestRead.error}`, 'pack-manifest.yaml');
  } else if (manifestRead.error === undefined && !isMapping(manifestRead.value)) {
    warn('manifest-unreadable', 'pack-manifest.yaml is not a mapping', 'pack-manifest.yaml');
  } else if (manifestRead.error === undefined) {
    const m = manifestRead.value;
    let verified = true;
    if (typeof m.schema_version === 'string' && m.schema_version !== '1.0') {
      warn('manifest-schema-version', `pack-manifest.yaml has schema_version ${JSON.stringify(m.schema_version)}; this reader knows 1.0`, 'pack-manifest.yaml');
    }
    // An entry whose path is not a string, or any of whose fields is a mapping or
    // a list, is refused as a whole: it is never shown coerced.
    /** @param {unknown} e @returns {e is Record<string, any>} */
    const validEntry = (e) =>
      isMapping(e) && typeof e.path === 'string' && Object.values(e).every((v) => typeof v === 'string' || v === null);
    /** @type {Record<string, any>[]} */
    const constituents = [];
    /** @type {{ e: Record<string, any>, preset: boolean }[]} */
    const entries = [];
    for (const [list, preset] of /** @type {const} */ ([['constituents', false], ['presets', true]])) {
      (Array.isArray(m[list]) ? m[list] : []).forEach((/** @type {unknown} */ e, /** @type {number} */ i) => {
        if (!validEntry(e)) {
          verified = false;
          warn('manifest-invalid-entry', `\`${list}[${i}]\` in pack-manifest.yaml has a path or field that is not a single value; it is ignored`, 'pack-manifest.yaml');
          return;
        }
        entries.push({ e, preset });
        if (!preset) constituents.push(e);
      });
    }
    const listed = new Set();
    for (const { e, preset } of entries) {
      const rel = /** @type {string} */ (e.path);
      listed.add(rel);
      if (!preset && e.kind !== undefined && !artifactKinds.has(e.kind)) {
        warn('manifest-unknown-kind', `pack-manifest.yaml lists ${rel} with kind \`${e.kind}\`, which the contract does not know`, rel);
      }
      const abs = heldFile(root, rel);
      if (abs === undefined) {
        verified = false;
        warn('manifest-missing-file', 'pack-manifest.yaml lists this file, but the pack does not hold it', rel || 'pack-manifest.yaml');
        continue;
      }
      const actual = packContentHash(readFileSync(abs));
      if (actual !== e.content_hash) {
        verified = false;
        warn('manifest-hash-mismatch', `content_hash ${e.content_hash} in pack-manifest.yaml, ${actual} recomputed`, rel);
      }
    }
    const shouldList = [...candidates.keys(), ...presets.map((p) => p.path)];
    for (const rel of shouldList.sort(byCodeUnit)) {
      if (!listed.has(rel)) {
        verified = false;
        warn('manifest-unlisted', 'the pack holds this file, but pack-manifest.yaml does not list it', rel);
      }
    }
    manifest = {
      hash: typeof m.manifest_hash === 'string' ? m.manifest_hash : '',
      verified,
      constituents: constituents.map((e) => ({
        kind: e.kind ?? '',
        id: e.id ?? '',
        path: e.path,
        contentHash: e.content_hash ?? '',
      })),
    };
  }
  const inventory = manifest?.verified
    ? { source: /** @type {const} */ ('manifest'), kinds: inventoryOf(manifest.constituents) }
    : { source: /** @type {const} */ ('file-kinds'), kinds: inventoryOf(candidates.values()) };

  // --- contract commits -----------------------------------------------------
  /** @type {PackModel['contract']} */
  const contractInfo = { readWith: contract.lock.commit };
  if (options.charterLock !== undefined) {
    const lock = readYamlFile(path.resolve(options.charterLock));
    const commit = isMapping(lock.value) && typeof lock.value.commit === 'string' ? lock.value.commit : undefined;
    if (commit === undefined) {
      warn('charter-lock-unreadable', `charterLock ${options.charterLock} has no readable \`commit\`${lock.error && lock.error !== 'missing' ? `: ${lock.error}` : lock.error === 'missing' ? ' (missing)' : ''}`);
    } else {
      contractInfo.provenAgainst = commit;
      if (commit !== contract.lock.commit) {
        warn('charter-lock-mismatch', `the packs were proven against charter ${commit}, and doc-kitty reads them with the contract at ${contract.lock.commit}`);
      }
    }
  }
  for (const w of contract.warnings) warn(w.code, w.message);

  problems.sort(
    (a, b) =>
      byCodeUnit(a.file === undefined ? '' : `~${a.file}`, b.file === undefined ? '' : `~${b.file}`) ||
      byCodeUnit(a.code, b.code) ||
      byCodeUnit(a.message, b.message),
  );
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  return {
    dir: packDir,
    path: path.relative(repoRoot, root).split(path.sep).join('/') || '.',
    identity,
    ...(document ? { document } : {}),
    ...(manifest ? { manifest } : {}),
    presets,
    ...(policy ? { policy } : {}),
    inventory,
    problems,
    contract: contractInfo,
  };
}
