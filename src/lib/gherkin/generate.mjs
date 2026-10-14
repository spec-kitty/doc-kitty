/**
 * Gherkin feature-page generator — codegen INTO the docs collection (ADR-0046,
 * the ADR-0026 glossary seam). From the {@link FeatureModel} the loader built,
 * this writes real Markdown files under `<docsRoot>/<section>/`:
 *
 *   - `<section>/<dir…>/<feature>.md`   — one `kind: Specification` page per feature;
 *   - `<section>/<dir…>/<indexBasename[0]>.md` — a `kind: Hub` page for the section
 *     root and for every directory that (recursively) holds a feature. A
 *     directory with no published feature below it gets a DRAFT hub (#124).
 *
 * Because the files land under the globbed docs base, the existing loader,
 * sidebar, sitemap draft filter, `llms.txt` and agent API pick them up with zero
 * new wiring — and so do the bare-Node gates, which walk files on disk.
 *
 * OWNERSHIP (contract §7, risk R4): every page carries
 * `generated.by: "doc-kitty/gherkin"`. Before writing, the generator scans the
 * output directory; a file WITHOUT that stamp — or ANY symlink, which a write
 * would follow out of the section — is authored content and the run fails
 * BEFORE any write. Stale owned files are deleted, then empty directories. The
 * planner re-reads every page it plans and refuses (internal error) to emit one
 * the next run could not recognise as owned, so a generated section can never
 * lock itself.
 *
 * ROUTES (contract §1): besides two sources mapping to one file, three more
 * plans are fatal because the docs loader would silently drop or merge a page:
 * a feature named like an index basename (it would BE its directory's index), a
 * feature page `x.md` beside a generated hub `x/<index>.md` (one route, two
 * pages), and a leaf that slugs to `log` (a `log.md` at any depth is the loader's
 * reserved change log, excluded from the collection — `schema.ts`).
 *
 * DETERMINISM (risk R3): {@link planFeaturePages} is a pure function of the model
 * and the docs tree it reads (ADR listing, section registry) — no clock, no
 * locale, code-unit ordering throughout — and {@link generateFeaturePages} only
 * rewrites a file whose bytes changed, so a dev-server restart that regenerates
 * the same input never touches the tree (no restart loop).
 *
 * Plain `.mjs` (JSDoc-typed, no `.d.ts`) so the Astro integration and the
 * bare-Node `generate-feature-pages.mjs --check` drift gate share ONE
 * implementation: parity holds by construction.
 *
 * @module gherkin/generate
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {
  compareCodeUnit,
  DEFAULT_INDEX_BASENAME,
  humanizeSection,
  humaniseDirectoryName,
  isIndexPath,
  normalizeIndexBasenames,
  generatedIndexBasename,
  slug,
} from '../vocabulary-core.mjs';
import { resolveSectionRegistryEntries } from '../vocabulary-loader.mjs';
import {
  GENERATED_BY,
  buildFrontmatter,
  missionPrefix,
  serializeFrontmatter,
  serializeHubFrontmatter,
} from './feature-core.mjs';
import { sourceLink, toPosix } from './load.mjs';
import { DEFAULT_GHERKIN_SECTION } from './options.mjs';
import { escapeHeading, escapeInline, renderFeatureBody } from './render.mjs';
import { GHERKIN_LOG_PREFIX as PREFIX } from './text.mjs';

/** @typedef {import('./load.mjs').FeatureModel} FeatureModel */
/** @typedef {import('./load.mjs').FeatureFile} FeatureFile */

/** Default section id (folder under the docs root); defined in `./options.mjs`. */
export { DEFAULT_GHERKIN_SECTION };

/**
 * The leaf slug the docs loader reserves: a `log.md` at any depth is an optional,
 * frontmatter-free change log, EXCLUDED from the docs collection (`schema.ts`
 * `docsLoader`), so a generated `log.md` would never be built.
 */
const RESERVED_LEAF = 'log';

/** The one-line intro every generated hub carries (contract §6). */
const HUB_INTRO = "Behaviour specifications generated from the repository's Gherkin feature files.";

/**
 * A directory hub's `description`. Long enough (≥50 chars for any title) to clear
 * the frontmatter gate's soft minimum, so generated hubs never add warnings.
 *
 * @param {string} title
 * @returns {string}
 */
function hubDescription(title) {
  return `Behaviour specifications for ${title}, generated from Gherkin feature files.`;
}

/**
 * @typedef {object} PlanOptions
 * @property {string} docsRoot Absolute docs root (`<site>/<docsDir>`): the ADR
 *   listing and section registry are read from here.
 * @property {string} [section] Section id the pages land under. Default `behaviour`.
 * @property {string | readonly string[]} [indexBasename] The site's index
 *   basename(s); the hub file is `<first>.md`. Default `README`.
 * @property {string} [sourceRoot] Absolute directory `sources[0].resource` paths
 *   are relative to. Default `process.cwd()`.
 * @property {string} [sourceUrlPrefix] Optional browse-URL prefix prepended to
 *   the source path (e.g. `https://github.com/o/r/blob/main/`).
 * @property {Readonly<Record<string, string>>} [titles] Hub titles by
 *   source-relative directory as written (`{ hr: 'HR' }`, `gherkin.titles`,
 *   #125); a directory without one is titled from its name. A key that names no
 *   directory holding a feature warns.
 * @property {(msg: string) => void} [warn] Warning sink. Default no-op.
 */

/**
 * @typedef {object} GenerateOptions
 * @property {string} outDir Absolute output directory (`<docsRoot>/<section>`).
 * @property {readonly string[]} [sources] The configured source directories,
 *   as written — named in the "no .feature files found" warning and error.
 * @property {boolean} [allowEmpty] Deliberately remove the generated pages when
 *   the whole source set yields no feature (default: stop instead; FR-001/FR-003).
 */

/**
 * The configured index basenames, through THE shared normaliser
 * (`normalizeIndexBasenames`, `vocabulary-core.mjs`) — config order, blank
 * entries dropped, `README` when nothing usable is configured.
 *
 * @param {string | readonly string[] | undefined} indexBasename
 * @returns {string[]}
 */
function indexBasenames(indexBasename) {
  const list = normalizeIndexBasenames(
    /** @type {string | string[] | undefined} */ (indexBasename),
  ).filter((b) => typeof b === 'string' && b !== '');
  return list.length > 0 ? list : [DEFAULT_INDEX_BASENAME];
}

/**
 * The first configured index basename — the hub file stem. Taking the first
 * makes README-as-index collapse the hub to its directory route under either
 * loader setting (contract §1). The shared rule (`generatedIndexBasename`).
 *
 * @param {string | readonly string[] | undefined} indexBasename
 * @returns {string}
 */
export function hubBasename(indexBasename) {
  return generatedIndexBasename(indexBasename);
}

/**
 * Full lowercase hex sha256 of a string.
 *
 * @param {string} text
 * @returns {string}
 */
function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Plan every generated file WITHOUT touching the output tree: a map from the
 * output path (POSIX, relative to `<docsRoot>/<section>`) to its exact contents,
 * in code-unit order. The single source the writer and the `--check` gate share.
 *
 * Fatal (throws): two sources mapping to the same output path; a feature named
 * like an index basename; a feature page and a directory hub on the same route
 * (`x.feature` beside `x/…`); a leaf slugging to the reserved `log`; and — an
 * internal error — a planned page whose frontmatter would not read back as owned.
 *
 * @param {FeatureModel} model
 * @param {PlanOptions} opts
 * @returns {Map<string, string>}
 */
export function planFeaturePages(model, opts) {
  const {
    docsRoot,
    section = DEFAULT_GHERKIN_SECTION,
    indexBasename,
    sourceRoot = process.cwd(),
    sourceUrlPrefix,
    titles = {},
    warn = () => {},
  } = opts;
  /** @type {Map<string, string>} */
  const plan = new Map();
  if (model.files.length === 0) return plan;

  const basenames = indexBasenames(indexBasename);
  const hubFile = `${basenames[0]}.md`;
  const adrDir = path.join(docsRoot, 'adr');
  const adrFileNames = existsSync(adrDir)
    ? readdirSync(adrDir).filter((f) => f.endsWith('.md')).sort(compareCodeUnit)
    : [];
  // The registry the BUILD uses (charter.yaml `sections.entries`, else the
  // legacy sections.yaml): the root hub label and the @dk:mission prefix.
  const registry = resolveSectionRegistryEntries(docsRoot);
  const mission = missionPrefix(registry);
  const sectionLabel = registry?.find((s) => s.id === section)?.label ?? humanizeSection(section);

  /** Output path → the source that claimed it (for the collision message). */
  /** @type {Map<string, string>} */
  const claimedBy = new Map();
  /** Directory (POSIX, slugged) → the first source found below it. */
  /** @type {Map<string, string>} */
  const dirSource = new Map();
  /**
   * Directory (POSIX, '' = section root) → its children. `body` is the list
   * line's description as Markdown (already escaped where it is literal text).
   */
  /** @type {Map<string, Array<{ out: string, title: string, body: string, href: string }>>} */
  const children = new Map([['', []]]);
  /** @type {Map<string, string>} */
  const dirTitles = new Map([['', sectionLabel]]);
  /**
   * Directories (POSIX, '' = section root) with at least one NON-draft feature
   * somewhere below them: their hubs are published and linked from the parent
   * hub. Every other directory holding a feature gets a DRAFT hub (#124), so
   * the sidebar finds an index for its draft pages, and draft gating builds the
   * hub exactly when it builds those pages. A published hub never links a
   * draft hub: its Markdown is served raw to agents, and the link would publish
   * the very directory name draft gating keeps out of hubs, sitemaps and the
   * agent API. The section root is always published.
   *
   * The plan never reads the draft-publication setting: the pages are
   * committed and drift-checked, so they must be the same for every build.
   */
  /** @type {Set<string>} */
  const publishedDirs = new Set(['']);
  /** Every source-relative directory as written, for the unknown-`titles` warning. */
  /** @type {Set<string>} */
  const sourceDirs = new Set();

  for (const file of model.files) {
    const feature = file.document.feature;
    if (!feature) continue;
    const { label: sourceLabel, resource: sourceResource } = sourceLink(file.absPath, {
      sourceRoot,
      sourceUrlPrefix,
    });
    const segments = file.relPath.replace(/\.feature$/, '').split('/');
    const slugged = segments.map((s) => slug(s));
    if (slugged.some((s) => s === '')) {
      throw new Error(`${PREFIX} ${sourceLabel}: path has a segment with no slug-able characters`);
    }
    const out = `${slugged.join('/')}.md`;
    // The loader matches index basenames case-insensitively (the shared
    // `isIndexPath` rule), so a feature whose leaf slug is one of them
    // (`README.feature` → `readme.md`, or `index.feature` under
    // `['README','index']`) would be routed as its directory's index and collide
    // with the generated hub — and on a case-insensitive filesystem overwrite it.
    if (isIndexPath(out, basenames)) {
      const hubOut = [...slugged.slice(0, -1), hubFile].join('/');
      throw new Error(
        `${PREFIX} output collision: ${sourceLabel} maps to ${section}/${out}, an index ` +
          `basename that collides with the generated hub ${section}/${hubOut}; rename the feature file`,
      );
    }
    // FR-006: `index.feature` is rejected on every setting. Under a `README`-only site the
    // page `x/index.md` is not an index name, but the site still serves it at its folder's
    // address (`/x/`), the route of the hub.
    if (slugged[slugged.length - 1] === 'index') {
      throw new Error(
        `${PREFIX} reserved output name: ${sourceLabel} maps to ${section}/${out}, which the site ` +
          `serves at its folder's address (/${[section, ...slugged.slice(0, -1)].join('/')}/). Rename the feature file.`,
      );
    }
    if (slugged[slugged.length - 1] === RESERVED_LEAF) {
      throw new Error(
        `${PREFIX} reserved output name: ${sourceLabel} maps to ${section}/${out}, but log.md is the ` +
          'reserved change-log file the docs loader excludes, so the page would never be built and ' +
          'its hub link would dangle; rename the feature file',
      );
    }
    const prior = claimedBy.get(out);
    if (prior !== undefined) {
      throw new Error(
        `${PREFIX} output collision: ${prior} and ${sourceLabel} both map to ${section}/${out}`,
      );
    }
    claimedBy.set(out, sourceLabel);

    const { fields, warnings, descriptionIsName } = buildFrontmatter({
      featureName: feature.name,
      featureKeyword: feature.keyword,
      description: feature.description,
      tags: feature.tags,
      file: sourceLabel,
      sourceResource,
      hash: file.sha256,
      missionPrefix: mission,
      adrFileNames,
      location: feature.location,
    });
    for (const w of warnings) warn(w);
    const body = renderFeatureBody(file.document, { file: sourceLabel, warn });
    plan.set(out, `${serializeFrontmatter(fields)}\n\n${body}`);

    // Register the page with its directory hub, and every ancestor directory
    // with ITS parent hub (a directory with a feature anywhere below it).
    const dirs = slugged.slice(0, -1);
    const parent = dirs.join('/');
    if (!children.has(parent)) children.set(parent, []);
    // A DRAFT page (`@wip`, `@dk:status=draft`) is still generated, but never
    // listed in its hub: the Hub layout's own child listing drops drafts
    // (`hub-children.mjs`, INV-1), and the hub's raw Markdown is served to agents
    // (`/api/pages/<hub>.json`), so a listed draft would leak past draft gating.
    if (fields.doc_status !== 'draft') {
      for (let depth = 1; depth <= dirs.length; depth += 1) {
        publishedDirs.add(dirs.slice(0, depth).join('/'));
      }
      children.get(parent)?.push({
        out,
        title: fields.title,
        // The Feature description's first sentence: Markdown passthrough, the
        // same trust boundary as the page body it was taken from (contract §4).
        // The no-description fallback is built from the Feature NAME instead —
        // literal text, so it is escaped here.
        body: descriptionIsName ? escapeInline(fields.description) : fields.description,
        href: `./${slugged[slugged.length - 1]}/`,
      });
    }
    for (let depth = dirs.length; depth > 0; depth -= 1) {
      const dir = dirs.slice(0, depth).join('/');
      const sourceDir = segments.slice(0, depth).join('/');
      sourceDirs.add(sourceDir);
      if (dirTitles.has(dir)) continue;
      dirTitles.set(
        dir,
        Object.hasOwn(titles, sourceDir) ? titles[sourceDir] : humaniseDirectoryName(segments[depth - 1]),
      );
      dirSource.set(dir, sourceLabel);
      const up = dirs.slice(0, depth - 1).join('/');
      if (!children.has(up)) children.set(up, []);
      if (!children.has(dir)) children.set(dir, []);
    }
  }

  for (const key of Object.keys(titles).sort(compareCodeUnit)) {
    if (!sourceDirs.has(key)) {
      warn(`${PREFIX} gherkin.titles key ${JSON.stringify(key)} matches no source directory with a feature; ignored`);
    }
  }

  // A feature page `x.md` beside a generated hub `x/<index>.md` is ONE route
  // (`<section>/x`): the loader keeps one page and silently drops the other, in
  // either source order. Checked once every directory is known, draft-only ones
  // included (their hub is a draft, but it still takes the route).
  for (const dir of dirTitles.keys()) {
    if (dir === '') continue;
    const leafSource = claimedBy.get(`${dir}.md`);
    if (leafSource !== undefined) {
      throw new Error(
        `${PREFIX} route collision: ${leafSource} (page ${section}/${dir}.md) and ` +
          `${dirSource.get(dir)} (directory hub ${section}/${dir}/${hubFile}) both route to ` +
          `${section}/${dir}; rename the feature file or its directory`,
      );
    }
  }

  // Hubs: link every PUBLISHED child directory hub into its parent (titles are
  // known now). A draft hub is planned below, but never linked.
  for (const dir of dirTitles.keys()) {
    if (dir === '' || !publishedDirs.has(dir)) continue;
    const up = dir.split('/').slice(0, -1).join('/');
    const title = /** @type {string} */ (dirTitles.get(dir));
    children.get(up)?.push({
      out: `${dir}/${hubFile}`,
      title,
      // The (humanised) directory name is LITERAL text: escape it in the body.
      // The hub's own frontmatter `description` keeps it raw (JSON-quoted).
      body: hubDescription(escapeInline(title)),
      href: `./${dir.split('/').pop()}/`,
    });
  }
  for (const [dir, list] of children) {
    const status = publishedDirs.has(dir) ? 'active' : 'draft';
    const title = /** @type {string} */ (dirTitles.get(dir));
    const description = dir === '' ? HUB_INTRO : hubDescription(title);
    const sorted = [...list].sort((a, b) => compareCodeUnit(a.out, b.out));
    // `generated.at` hashes the sorted child list (contract §6): it changes
    // exactly when a child is added, removed or renamed.
    const hash = sha256(sorted.map((c) => c.out).join('\n'));
    const items = sorted.map((c) => `- [${escapeInline(c.title)}](${c.href}) — ${c.body}`);
    const out = dir === '' ? hubFile : `${dir}/${hubFile}`;
    if (claimedBy.has(out)) {
      throw new Error(
        `${PREFIX} output collision: ${claimedBy.get(out)} maps onto the generated hub ${section}/${out}`,
      );
    }
    // A draft hub, and the root hub of an all-draft section, has no items: intro
    // only, and still exactly one trailing newline (markdownlint MD012/MD047).
    const listing = items.length > 0 ? `\n\n${items.join('\n')}` : '';
    plan.set(
      out,
      `${serializeHubFrontmatter({ title, description, hash, status })}\n\n` +
        `# ${escapeHeading(title)}\n\n${HUB_INTRO}${listing}\n`,
    );
  }

  const sortedPlan = new Map([...plan].sort(([a], [b]) => compareCodeUnit(a, b)));
  // Final defence (review #1): never plan a page the NEXT run would classify as
  // authored — its frontmatter must parse and carry the stamp, or the section
  // would lock itself ("refusing to write") until someone deletes it by hand.
  for (const [rel, contents] of sortedPlan) {
    if (!isOwnedPage(contents)) {
      throw new Error(
        `${PREFIX} internal error: the planned page ${rel} does not read back as generated by ` +
          `${GENERATED_BY} (its frontmatter does not parse, or lost the stamp); refusing to write ` +
          'a page the next run could not own. Please report this with the source feature file.',
      );
    }
  }
  return sortedPlan;
}

/**
 * Walk `outDir` and classify every file: OWNED (a `.md` whose frontmatter has
 * `generated.by === "doc-kitty/gherkin"`) or AUTHORED (anything else). ANY
 * symlink — to a file or a directory, stamped target or not — is AUTHORED and
 * never followed: the writer would otherwise write (or prune) through it,
 * outside `outDir`. Dotfiles are ignored. Returns POSIX paths relative to
 * `outDir`, code-unit sorted.
 *
 * @param {string} outDir
 * @returns {{ owned: string[], authored: string[] }}
 */
export function scanOutputDir(outDir) {
  /** @type {string[]} */
  const owned = [];
  /** @type {string[]} */
  const authored = [];
  if (!existsSync(outDir)) return { owned, authored };
  // The section root itself a symlink: every write and prune would land in its
  // target. Same rule as an inner symlink — authored, never followed.
  if (lstatSync(outDir).isSymbolicLink()) return { owned, authored: ['.'] };
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      const rel = toPosix(path.relative(outDir, abs));
      if (entry.isSymbolicLink()) {
        authored.push(rel);
        continue;
      }
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (entry.name.endsWith('.md') && isOwnedPage(readFileSync(abs, 'utf8'))) owned.push(rel);
      else authored.push(rel);
    }
  };
  walk(outDir);
  return { owned: owned.sort(compareCodeUnit), authored: authored.sort(compareCodeUnit) };
}

/**
 * Whether a Markdown file's frontmatter stamps it as generated by this pipeline.
 * A file whose frontmatter does not parse is NOT owned (never delete it).
 *
 * @param {string} contents
 * @returns {boolean}
 */
function isOwnedPage(contents) {
  try {
    const { data } = matter(contents);
    return data?.generated?.by === GENERATED_BY;
  } catch {
    return false;
  }
}

/**
 * Compare the plan against the committed tree without writing (`--check`).
 *
 * @param {Map<string, string>} plan
 * @param {string} outDir
 * @returns {{ added: string[], changed: string[], stale: string[], authored: string[] }}
 */
export function diffFeaturePages(plan, outDir) {
  const { owned, authored } = scanOutputDir(outDir);
  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const changed = [];
  for (const [rel, contents] of plan) {
    const abs = path.join(outDir, rel);
    assertNotDirectory(outDir, rel);
    if (!existsSync(abs)) added.push(rel);
    else if (readFileSync(abs, 'utf8') !== contents) changed.push(rel);
  }
  const stale = owned.filter((rel) => !plan.has(rel));
  return { added, changed, stale, authored };
}

/**
 * Throw unless `rel` resolves to a path under `outDir`.
 *
 * @param {string} outDir
 * @param {string} rel
 */
function assertInside(outDir, rel) {
  const root = path.resolve(outDir);
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`${PREFIX} refusing to write ${rel}: it resolves outside ${outDir}`);
  }
}

/**
 * Throw a readable error when a directory sits where a page must be written
 * (`ship.md/` beside `ship.feature`).
 *
 * @param {string} outDir
 * @param {string} rel
 */
function assertNotDirectory(outDir, rel) {
  const abs = path.join(outDir, rel);
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    throw new Error(
      `${PREFIX} cannot write ${rel}: ${abs} is a directory (a generated page needs that file name; ` +
        'rename or remove the directory)',
    );
  }
}

/**
 * Generate the section: plan, refuse to clobber authored content, write changed
 * files, delete stale owned files, then remove emptied directories.
 *
 * Fatal (throws, before ANY write): an output collision, or a non-generated file
 * inside `outDir` (a generated section has a single owner).
 *
 * @param {FeatureModel} model
 * @param {PlanOptions & GenerateOptions} opts
 * @returns {{ written: string[], unchanged: string[], removed: string[] }}
 */
export function generateFeaturePages(model, opts) {
  const { outDir, sources, allowEmpty, warn = () => {} } = opts;
  const plan = planFeaturePages(model, opts);
  const { owned, authored } = scanOutputDir(outDir);
  if (existsSync(outDir) && lstatSync(outDir).isSymbolicLink()) {
    throw new Error(
      `${PREFIX} refusing to write into ${outDir}: the section directory is a symlink ` +
        '(pages would be written and pruned in its target; make it a real directory)',
    );
  }
  if (authored.length > 0) {
    throw new Error(
      `${PREFIX} refusing to write into ${outDir}: ${authored.join(', ')} ` +
        `${authored.length === 1 ? 'is' : 'are'} not generated by ${GENERATED_BY} ` +
        '(a generated section has a single owner, and a symlink always counts as authored; ' +
        'move authored pages elsewhere or choose another gherkin.section)',
    );
  }
  if (model.files.length === 0) {
    const where = sources && sources.length > 0 ? ` in ${sources.join(', ')}` : '';
    // Whole-set emptiness only (C-004). An uninitialised git submodule looks exactly
    // like "every feature was deleted", and pruning on it silently destroys the
    // section, so with pages present this stops before any write (FR-001/FR-002).
    if (owned.length > 0 && allowEmpty !== true) {
      throw new Error(
        `${PREFIX} no .feature files found${where}, but ${owned.length} generated page(s) exist in ` +
          `${outDir} and would be removed. The usual cause is a source directory that is not ` +
          'checked out, such as an uninitialised git submodule (run `git submodule update --init`). ' +
          'Nothing was removed. If the features were removed on purpose, set `gherkin.allowEmpty: true` ' +
          '(or pass `--allow-empty` to the CLI) to remove the pages; to keep the pages as they are, ' +
          'remove the `gherkin` option so they stay frozen.',
      );
    }
    warn(
      `${PREFIX} no .feature files found${where}; ${owned.length} previously generated page(s) will be removed`,
    );
  }

  // Emptiness is judged on the whole set (C-004), so one empty source among
  // several does not stop. Name it anyway: a submodule that is not checked out
  // looks exactly like this, and its pages are about to be pruned.
  if (model.files.length > 0 && sources && sources.length > 1) {
    const seen = new Set(model.files.map((file) => file.sourceDirIndex));
    sources.forEach((source, index) => {
      if (!seen.has(index)) {
        warn(
          `${PREFIX} no .feature files found in ${source}, although other sources have some; ` +
            'if it is a git submodule, run `git submodule update --init`',
        );
      }
    });
  }

  // Defence in depth: nothing planned or pruned may resolve outside `outDir`.
  const removed = owned.filter((rel) => !plan.has(rel));
  for (const rel of [...plan.keys(), ...removed]) assertInside(outDir, rel);
  for (const rel of plan.keys()) assertNotDirectory(outDir, rel);

  /** @type {string[]} */
  const written = [];
  /** @type {string[]} */
  const unchanged = [];
  for (const [rel, contents] of plan) {
    const abs = path.join(outDir, rel);
    if (existsSync(abs) && readFileSync(abs, 'utf8') === contents) {
      unchanged.push(rel);
      continue;
    }
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
    written.push(rel);
  }

  for (const rel of removed) unlinkSync(path.join(outDir, rel));
  if (removed.length > 0) pruneEmptyDirs(outDir);

  return { written, unchanged, removed };
}

/**
 * Remove empty directories under (and including) `dir`, bottom-up. Only reached
 * after deleting owned files, and the authored-file check guarantees `dir` holds
 * nothing but generated output (dotfiles aside — a dir holding one is kept).
 *
 * @param {string} dir
 * @returns {boolean} Whether `dir` itself was removed.
 */
function pruneEmptyDirs(dir) {
  if (!existsSync(dir)) return false;
  let empty = true;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && pruneEmptyDirs(path.join(dir, entry.name))) continue;
    empty = false;
  }
  if (empty) rmdirSync(dir);
  return empty;
}
