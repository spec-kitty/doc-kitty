#!/usr/bin/env node
/**
 * Internal link & reference integrity check for a DocKitty
 * tree, without a full Astro build. Fast enough for a CI gate.
 *
 * Usage:
 *   node src/scripts/check-links.mjs [<root> ...] [--strict] [--index-basename <name[,name…]>]
 *                                    [--site-root <dir>] [--mode <mode>]
 *   # default roots: docs example/docs
 *
 * Resolves two classes of internal reference and FAILS on any that dangle
 * (mirroring the site's build-fail-on-broken-link guarantee):
 *
 *   1. Inline Markdown links `[text](target)` whose target points at a Markdown
 *      doc (`.md`/`.mdx`) or a route (a directory / extension-less path that
 *      resolves to a section index). Resolution is relative to the linking file.
 *   2. `related:` frontmatter refs — docs-root-relative ids without an
 *      extension (e.g. `context/convention`, `adr/0004-...`). Resolution is
 *      relative to the root that owns the file.
 *
 * Out of scope (handled elsewhere in the pipeline, not here):
 *   - External URLs (http/https/mailto/tel/protocol-relative) — lychee nightly.
 *   - Site-absolute links (`/rss.xml`, `/context/`, `/api/index.json`) — these
 *     are generated routes/artifacts; build-artifact assertions cover them.
 *   - Non-Markdown asset links (`.png`, `.jpg`, `.xml`, `.json`, …) — not doc
 *     links; several appear only as inline syntax examples in prose.
 *
 * ZERO new dependencies: link extraction is string/regex scanning; only
 * `gray-matter` (already vendored, used by the frontmatter gate) parses
 * frontmatter for `related`.
 *
 * ## Two kinds of root
 *
 * A root is strict when it is {@link SITE_ROOTS} (`example/docs`, built by
 * Astro/Starlight under a trailing-slash directory-route base) or when
 * `--strict` is given. Every other root is read as files, as on GitHub (the
 * repository's own `docs/`): the one question there is "does the target exist".
 *
 * Non-strict root (what 0.2.0 did, for every link form). A relative link, a
 * `[label]: target` reference definition and a `related:` ref pass when the file
 * or folder it names exists (`.md`/`.mdx` appended when the path has no
 * extension); a missing target is dangling. Nothing else is reported: a folder
 * with no section index, a link to a file the build does not publish
 * (`log.md`), a draft, a path that leaves the docs folder (and comes back), an
 * existing file outside the tree and a bare extensionless link all pass.
 * Root-absolute links are not resolved.
 *
 * Strict root (agrees with the built site, FR-015..FR-017). A relative
 * `.md`/`.mdx` link is resolved with `resolveRelativeDocLink`
 * (`vocabulary-core.mjs`, the function the build's link rewrite calls) against
 * the root's route table (shared walk + `buildRouteTable`), and is accepted
 * exactly when the build would rewrite it to a published page. A link that does
 * not resolve is reported with the reason: the target is missing; it is inside
 * the docs tree but is not a page (`log.md`, which is never built); its path
 * leaves the docs root and comes back (the build does not rewrite it; the
 * message names the route to use); it leaves the docs tree; it is a malformed
 * `%` escape; or it is an unpublished draft (with `DK_PUBLISH_DRAFTS` off, the
 * setting is read from the process environment and the site's env files,
 * `--site-root`). Also reported: a bare extensionless relative link (the build
 * does not rewrite it, and it resolves under the page's own URL), and a folder
 * link whose folder has no index page. A draft page may link to anything: it is
 * not built either. The bundle root page is never a draft. A root-absolute link
 * (`/architecture/overview/`) is not resolved, apart from the draft check:
 * whether it 200s is the authority of `assert-no-broken-links.mjs`, the
 * base-aware built-output gate.
 *
 * `--index-basename` is the site's section-index setting; without it the
 * effective list is `README,index`. Footnote definitions (`[^label]: text`) are
 * not links.
 */
import { readdirSync, statSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative, dirname, resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import {
  draftRoutesOf,
  resolveDraftPublicationForGate,
  takeSiteFlags,
  unpublishedDraftPaths,
} from '../lib/draft-publication.mjs';
import { buildRouteTable, isPlainIndexName, resolveIndexEntries, resolveRelativeDocLink } from '../lib/vocabulary-core.mjs';
import { walkMarkdownPaths } from '../lib/docs-walk.mjs';

// What this gate accepted as a section index before `--index-basename` existed
// (FR-003): either convention. It is only the value used when the flag is
// absent, so an existing invocation behaves as before; a site should pass its
// own setting. The index rule itself lives in `vocabulary-core.mjs`.
const DEFAULT_CHECK_INDEX_BASENAMES = ['README', 'index'];

// Roots subject to the fail-closed tightening below: built by Astro/Starlight
// under a base-prefixed, trailing-slash directory-route tree (`example/`'s
// `astro.config.mjs`). `docs/` (the Common Docs root) is plain, unbuilt
// Markdown viewed on GitHub — `.md`-relative cross-links there are correct
// and must not be flagged. Matched by the root's own path suffix so both
// `example/docs` (the default invocation) and a future differently-rooted
// invocation of the same site tree still classify correctly.
export const SITE_ROOTS = ['example/docs'];

/** Is `root` (as passed on argv) one of the base-prefixed, site-built trees? */
export function isSiteRoot(root) {
  const normalized = root.replace(/\/+$/, '');
  return SITE_ROOTS.some((siteRoot) => normalized === siteRoot || normalized.endsWith(`/${siteRoot}`));
}

// An Astro config next to a docs folder means the folder is built as a site.
const ASTRO_CONFIG_NAMES = ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'];

export const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|mailto:|tel:)/i;
const MD_EXT = /\.mdx?$/i;
// Inline links `](target)` and `](target "title")`; also image links `![]()`,
// which are filtered out later by extension (assets are out of scope).
const INLINE_LINK = /\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
// Reference definitions `[label]: target "title"` (optional angle brackets and
// title). `[^label]: …` is a footnote definition, whose text is not a link.
const REFERENCE_DEFINITION =
  /^ {0,3}\[(?!\^)[^\]\n]+\]:[ \t]*(?:<([^>\n]*)>|(\S+))(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?[ \t]*$/gm;

/**
 * Blank out code so link-like syntax inside it is never treated as a real link.
 * Fenced blocks (``` / ~~~) are dropped whole; inline `code` spans are stripped.
 * Markdown does not render links inside code, and doc pages routinely show link
 * syntax (`![alt](src)`, `[text](path)`) as examples.
 */
function stripCode(md) {
  const out = [];
  let fence = null;
  for (const line of md.split('\n')) {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
      continue; // inside a fenced block — drop the line
    }
    if (m) { fence = m[1]; continue; } // opening fence
    out.push(line.replace(/`[^`\n]*`/g, ''));
  }
  return out.join('\n');
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (MD_EXT.test(name)) out.push(full);
  }
  return out;
}

/**
 * Does `candidate` name something that exists? The one question a non-strict
 * root asks of a link or a `related:` ref: the file or folder itself, or the
 * file with `.md`/`.mdx` appended. A folder needs no section index there (the
 * frontmatter gate checks any README it holds). A strict root asks the route
 * table instead.
 *
 * @param {string} candidate
 */
export function resolvesToDoc(candidate) {
  return existsSync(candidate) || existsSync(`${candidate}.md`) || existsSync(`${candidate}.mdx`);
}

/** Strip a trailing `#anchor` / `?query` from a link target. */
export function stripFragment(target) {
  return target.replace(/[?#].*$/, '');
}

/**
 * Extract the resolvable ref string from one `related` entry — a bare slug or
 * an object `{ ref, note }` (ADR-0009). Returns null for a non-string / missing
 * ref (a shape the frontmatter validator, not this gate, rejects).
 */
export function relatedRefString(entry) {
  const ref = typeof entry === 'string' ? entry : entry?.ref;
  return typeof ref === 'string' ? ref : null;
}

/**
 * The internal `related` refs of a page's front matter: each ref as written and
 * the id to resolve (no fragment). External refs and non-string entries are
 * left out.
 *
 * @param {Record<string, unknown> | undefined} data parsed front matter
 * @returns {Array<{ ref: string, id: string }>}
 */
function internalRelatedRefs(data) {
  const related = data?.related;
  if (!Array.isArray(related)) return [];
  const out = [];
  for (const entry of related) {
    const ref = relatedRefString(entry);
    if (ref === null) continue;
    const id = stripFragment(ref.trim());
    if (!id || EXTERNAL.test(ref.trim())) continue;
    out.push({ ref, id });
  }
  return out;
}

/**
 * Given a docs root and a page's parsed front matter, return the internal
 * `related` refs that name nothing that exists (the non-strict rule; a strict
 * root asks the route table, see `run`).
 */
export function collectDanglingRelated(root, data) {
  return internalRelatedRefs(data)
    .filter(({ id }) => !resolvesToDoc(resolve(root, id)))
    .map(({ ref }) => ref);
}

/**
 * Classify one inline-link target for the internal-doc-link check.
 *
 * @param {string} rawTarget the raw `](target)` capture, untrimmed
 * @param {{ strict?: boolean }} [opts] `strict: true` rejects a bare
 *   extensionless link (the #62 tightening, see the module doc comment); set
 *   for a {@link SITE_ROOTS} tree or when `--strict` is given.
 * @returns {{ kind: 'skip' } | { kind: 'invalid', reason: string } | { kind: 'check', target: string }}
 *   `skip` — not an internal doc/route link we own (external, site-absolute,
 *   pure anchor, or a non-Markdown asset); `invalid` — a strict-mode
 *   violation, fail regardless of filesystem resolution; `check` — resolve
 *   `target` (fragment-free): a `.md`/`.mdx` target through the route table,
 *   anything else against the filesystem.
 */
export function classifyInlineLink(rawTarget, opts = {}) {
  const strict = opts.strict ?? false;
  const trimmed = rawTarget.trim();
  const target = stripFragment(trimmed);
  if (!target) return { kind: 'skip' }; // pure anchor / empty
  if (EXTERNAL.test(trimmed)) return { kind: 'skip' }; // external
  if (trimmed.startsWith('/')) return { kind: 'skip' }; // site-absolute route — WP01 convention, accepted here; assert-no-broken-links.mjs is the authority on whether it resolves
  const ext = extname(target).toLowerCase();
  // Doc link (.md/.mdx) or route (no extension / trailing slash). Any other
  // extension (.png, .jpg, .xml, .json, …) is an asset — out of scope.
  if (ext && !MD_EXT.test(target)) return { kind: 'skip' };

  // A `.md`/`.mdx` link is not classified here: whether it is a published page
  // is the shared route rule's question, answered per root in `run`.
  if (strict && !ext && !target.endsWith('/')) {
    return {
      kind: 'invalid',
      reason:
        "link has no extension, so the build does not rewrite it and it resolves under this page's own URL, not beside it — link to the file (./setup.md) or use a route (/section/page/)",
    };
  }

  return { kind: 'check', target };
}

const USAGE = `Usage: check-links [<root> ...] [options]

Checks internal links and \`related:\` refs under each docs root (default: docs example/docs).

A root is checked one of two ways. Without --strict a root is read as files, as on GitHub: a
relative link, a reference definition or a related ref passes when the file or folder it names
exists, and nothing else is reported. With --strict (and always for example/docs) the root is
treated as a built site: a relative .md/.mdx link passes exactly when the build would rewrite it
to a published page, and the checks below apply as well.

Options:
  --strict                      Treat every root given as a built site. Also reports: a link to
                                a file that is not a published page (log.md), a path that leaves
                                the docs root and comes back, a link to a file outside the docs
                                tree, a malformed % escape, a folder link whose folder has no
                                index page, a bare relative link with no extension, and (with
                                DK_PUBLISH_DRAFTS=off) a link to a draft page.
  --index-basename <name[,…]>   Section-index file name(s) without extension (default
                                README,index). A site should pass its own setting, the
                                same value its build uses.
  --site-root <dir>             Astro project whose env files set DK_PUBLISH_DRAFTS.
  --mode <mode>                 Astro mode for those env files (default production).
  --help                        Show this text.
`;

/**
 * Take this gate's own flags out of `args`; the rest are roots.
 *
 * @param {string[]} args
 * @returns {{ strict: boolean, indexBasenames: string[], help: boolean, rest: string[] }}
 */
export function takeCheckFlags(args) {
  const out = { strict: false, indexBasenames: DEFAULT_CHECK_INDEX_BASENAMES, help: false, rest: /** @type {string[]} */ ([]) };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--strict') out.strict = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--index-basename') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error('--index-basename needs a value: --index-basename <name[,name…]>');
      const names = value.split(',').map((n) => n.trim()).filter(Boolean);
      if (names.length === 0) throw new Error('--index-basename needs at least one name');
      const bad = names.find((n) => !isPlainIndexName(n));
      if (bad !== undefined) {
        throw new Error(
          `--index-basename must be plain file names (no '/', '\\', no leading '.'): got ${JSON.stringify(bad)}`,
        );
      }
      out.indexBasenames = names;
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`unknown option "${arg}" (see --help; options that take a value are written "--name value")`);
    } else out.rest.push(arg);
  }
  return out;
}

/** URL-decode a link path, as the build does; an undecodable one is used as written. */
function decodePath(target) {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

/**
 * Strict roots only. Why a relative `.md`/`.mdx` link is not a link to a page of
 * `routes`, as one message, or null when it is one. `routes` is the table the
 * root is held to: the pages the build publishes (all pages when the source is
 * itself a draft). `unpublished` is the set of draft files the build withholds,
 * used for the reason only.
 */
function checkMarkdownLink({ file, absRoot, target, routes, unpublished }) {
  const sourcePath = relative(absRoot, file).split(sep).join('/');
  if (resolveRelativeDocLink(routes, sourcePath, target) !== null) return null;

  try {
    decodeURIComponent(target);
  } catch {
    return 'link has a malformed % escape, which the build cannot look up — write the file name without it';
  }
  const abs = resolve(dirname(file), decodePath(target));
  const inside = relative(absRoot, abs).split(sep)[0] !== '..';
  const isFile = existsSync(abs) && statSync(abs).isFile();
  if (!isFile) return 'dangling link';
  if (!inside) {
    return 'link leaves the docs tree, so on a built site it is a 404 — link to a page inside the docs tree, or use an absolute URL';
  }
  const targetPath = relative(absRoot, abs).split(sep).join('/');
  if (unpublished.has(targetPath)) return DRAFT_REASON_LINK;
  if (Object.hasOwn(routes, targetPath)) {
    return `link goes up out of the docs root and back in, so the build does not rewrite it — link to the page by its route, ${routes[targetPath]}, or by a relative path that stays inside the docs root`;
  }
  return 'link target is not a published page (only .md/.mdx files under the docs root are built, and log.md never is) — link to a published page, or drop the link';
}

const DRAFT_REASON =
  'points at a draft page, which is not built with DK_PUBLISH_DRAFTS=off — ' +
  'publish the target, mark this page draft, or drop the link';
const DRAFT_REASON_LINK = `link ${DRAFT_REASON}`;

/** CLI entry point: scan every `.md`/`.mdx` under each root for dangling refs. */
export function run(argv) {
  let site;
  let flags;
  try {
    site = takeSiteFlags(argv.slice(2));
    flags = takeCheckFlags(site.rest);
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(2);
  }
  if (flags.help) {
    console.log(USAGE);
    return;
  }
  const roots = flags.rest;
  const indexBasenames = flags.indexBasenames;
  if (roots.length === 0) roots.push('docs', 'example/docs');

  // The same resolver the build uses, so a value kept in the site's env files
  // counts here too. The site root is the one given, else the nearest Astro
  // config above the first site-built tree (or above the first tree, when none
  // of them is site-built and the value therefore changes nothing).
  let publishDrafts;
  try {
    const resolved = resolveDraftPublicationForGate({
      checkedDir: roots.find(isSiteRoot) ?? roots[0],
      siteRoot: site.siteRoot,
      mode: site.mode,
    });
    publishDrafts = resolved.publish;
    console.log(`check-links: ${resolved.summary}`);
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(2);
  }

  let dangling = 0;
  const filesWithProblems = new Set();
  /** Report one problem found in `rel`. */
  const report = (rel, message) => {
    dangling++;
    filesWithProblems.add(rel);
    console.error(`✖ ${rel}: ${message}`);
  };
  let checked = 0;
  let fileCount = 0;

  for (const root of roots) {
    let files;
    try {
      files = walk(root);
    } catch (err) {
      console.error(`✖ cannot read docs dir "${root}": ${err.message}`);
      process.exit(2);
    }
    fileCount += files.length;
    const strict = flags.strict || isSiteRoot(root);
    const absRoot = resolve(root);
    if (!strict && ASTRO_CONFIG_NAMES.some((name) => existsSync(join(dirname(absRoot), name)))) {
      console.error(
        `check-links: note: ${root} looks like a built site (an Astro config sits next to it). ` +
          'It is checked as plain files; pass --strict to check it the way the build does, which agrees with the built-link gate.',
      );
    }

    // One route table per strict root, built by the shared rules. `allRoutes`
    // keeps the drafts: a draft page is not built either, so it may link to
    // another draft. A strict root is held to `visibleRoutes`, the pages the
    // build publishes (the bundle root is always one: the helper never
    // withholds it). A non-strict root is read as files and needs neither.
    const paths = strict ? walkMarkdownPaths(absRoot) : [];
    const allRoutes = buildRouteTable(paths, { indexBasename: indexBasenames }).routes;
    const unpublished = new Set(strict ? unpublishedDraftPaths(absRoot, publishDrafts, indexBasenames) : []);
    const visibleRoutes = buildRouteTable(paths, {
      indexBasename: indexBasenames,
      unpublishedPaths: [...unpublished],
    }).routes;
    // A folder link is answered from routes: does a page have this route, and is
    // it an unpublished draft. A root-absolute link is asked only the second.
    const routeTables = {
      absRoot,
      pageRoutes: new Set(Object.values(allRoutes)),
      draftRoutes: strict && !publishDrafts ? draftRoutesOf(absRoot, indexBasenames) : new Set(),
    };
    // `related:` refs are page ids, as the build reads them (`resolveRelated`
    // looks a ref up by slug, not by route). The ids come from the shared rule;
    // the loader stores the bundle root under `index`, which maps back to ''.
    // slug -> does any page with that slug get built.
    /** @type {Map<string, boolean>} */
    const slugPublished = new Map();
    for (const [path, id] of resolveIndexEntries(paths, { indexBasename: indexBasenames }).ids) {
      const slug = id === 'index' ? '' : id;
      slugPublished.set(slug, (slugPublished.get(slug) ?? false) || !unpublished.has(path));
    }

    for (const file of files) {
      const rel = relative('.', file);
      const raw = readFileSync(file, 'utf8');

      let parsed;
      try {
        parsed = matter(raw);
      } catch {
        // A broken frontmatter block is the frontmatter gate's problem, not ours;
        // scan the raw body for links so we still catch dangling links.
        parsed = { data: {}, content: raw };
      }

      // Template docs carry copy-me placeholder refs (`XXXX-title.md`, …) by
      // design; their links/refs are scaffolding, not real targets.
      const isTemplate =
        parsed.data?.type === 'Template' || /(^|\/)template\.md$/i.test(rel);
      if (isTemplate) continue;

      // The one answer to "is this page itself an unpublished draft": a draft
      // page is not built, so it may link to anything.
      const sourceUnpublished = unpublished.has(relative(absRoot, file).split(sep).join('/'));
      const checkDrafts = strict && !publishDrafts && !sourceUnpublished;

      // 1) Inline links and reference definitions in the body (code stripped so
      // examples aren't links; footnote definitions never match).
      const body = stripCode(parsed.content);
      const targets = [];
      let m;
      INLINE_LINK.lastIndex = 0;
      while ((m = INLINE_LINK.exec(body)) !== null) targets.push(m[1]);
      REFERENCE_DEFINITION.lastIndex = 0;
      while ((m = REFERENCE_DEFINITION.exec(body)) !== null) targets.push(m[1] ?? m[2]);

      for (const rawTarget of targets) {
        const classified = classifyInlineLink(rawTarget, { strict });
        if (classified.kind === 'skip') {
          // A root-absolute route is not resolved here (see the module comment),
          // but whether it names a draft page is a fact about the route.
          const absolute = stripFragment(rawTarget.trim());
          if (checkDrafts && /^\/(?!\/)/.test(absolute) && routeTables.draftRoutes.has(routeOfPath(decodePath(absolute)))) {
            checked++;
            report(rel, `link ${DRAFT_REASON} → ${rawTarget}`);
          }
          continue;
        }
        checked++;
        if (classified.kind === 'invalid') {
          report(rel, `${classified.reason} → ${rawTarget}`);
          continue;
        }
        if (!strict) {
          if (!resolvesToDoc(resolve(dirname(file), classified.target))) {
            report(rel, `dangling link → ${rawTarget}`);
          }
          continue;
        }
        if (MD_EXT.test(classified.target)) {
          const problem = checkMarkdownLink({
            file,
            absRoot,
            target: classified.target,
            routes: sourceUnpublished ? allRoutes : visibleRoutes,
            unpublished,
          });
          if (problem) {
            report(rel, `${problem} → ${rawTarget}`);
          }
          continue;
        }
        const candidate = resolve(dirname(file), decodePath(classified.target));
        const status = routeStatus(candidate, routeTables);
        const folder = relative(absRoot, candidate).split(sep).join('/');
        const problem = problemOf(status, { subject: 'link', checkDrafts, indexBasenames, folder });
        if (problem) {
          report(rel, `${problem} → ${rawTarget}`);
        }
      }

      // 2) `related:` frontmatter refs — docs-root-relative ids, no extension.
      // An entry is a bare slug or an object `{ ref, note }` (ADR-0009); both
      // forms resolve, and a dangling object-form ref is an error too.
      const refs = internalRelatedRefs(parsed.data);
      checked += refs.length;
      if (!strict) {
        for (const ref of collectDanglingRelated(root, parsed.data)) {
          report(rel, `dangling related ref → ${ref}`);
        }
        continue;
      }
      for (const { ref } of refs) {
        const published = slugPublished.get(ref);
        const status = published === undefined ? 'missing' : published ? 'published' : 'draft';
        const problem = problemOf(status, { subject: 'related ref', checkDrafts, indexBasenames });
        if (problem) {
          report(rel, `${problem} → ${ref}`);
        }
      }
    }
  }

  if (dangling) {
    console.error(
      `\n${dangling} link problem(s) in ${filesWithProblems.size} file(s); ${fileCount} file(s) scanned, ${checked} reference(s) checked.`,
    );
    process.exit(1);
  }
  console.log(
    `✓ ${checked} internal reference(s) resolve across ${fileCount} file(s) in ${roots.length} root(s): ${roots.join(', ')}.`,
  );
}

/**
 * The route a docs-root-relative POSIX path is served at: `/` for the root,
 * `/<path>/` otherwise (trailing and repeated slashes and `.` segments ignored).
 */
function routeOfPath(path) {
  const segments = path.split('/').filter((seg) => seg !== '' && seg !== '.');
  return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
}

/**
 * Strict roots only. The one answer for a folder link and a root-absolute link:
 * map the target to its route and look it up in the tables built from the
 * shared route rule. (A `related:` ref is not a route; see `run`.)
 *
 *   - `published`: a page has this route (or the target is outside the docs
 *     tree and exists, a repository link that is left alone);
 *   - `draft`: the route belongs only to draft pages, which the build withholds
 *     when `DK_PUBLISH_DRAFTS` is off (the caller decides whether that counts);
 *   - `no-index`: the target is a folder in the docs tree but no page has its
 *     route;
 *   - `missing`: nothing is there.
 *
 * @param {string} candidate absolute path the target names
 * @param {{ absRoot: string, pageRoutes: Set<string>, draftRoutes: Set<string> }} tables
 * @returns {'published' | 'draft' | 'no-index' | 'missing'}
 */
function routeStatus(candidate, { absRoot, pageRoutes, draftRoutes }) {
  const rel = relative(absRoot, candidate).split(sep).join('/');
  if (rel.split('/')[0] === '..') return resolvesToDoc(candidate) ? 'published' : 'missing';
  const route = routeOfPath(rel);
  if (pageRoutes.has(route)) return draftRoutes.has(route) ? 'draft' : 'published';
  return existsSync(candidate) && statSync(candidate).isDirectory() ? 'no-index' : 'missing';
}

/**
 * The report for a {@link routeStatus}, or null when the target is fine.
 * `subject` is `link` or `related ref`; a draft target is a problem only when
 * `checkDrafts` (drafts withheld, and the page holding the link is published).
 */
function problemOf(status, { subject, checkDrafts, indexBasenames, folder }) {
  if (status === 'published' || (status === 'draft' && !checkDrafts)) return null;
  if (status === 'draft') return `${subject} ${DRAFT_REASON}`;
  if (subject === 'related ref') return 'dangling related ref';
  if (status === 'missing') return 'dangling link';
  return `link names the folder "${folder}", which has no index page (${indexBasenames.join(', ')}), so the build has no page at its route — add one, or link to a file in the folder`;
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
// CLI guard. Compare against the REAL path of argv[1]: when the package is
// installed behind a symlink (pnpm's node_modules, or a node_modules/.bin shim),
// import.meta.url is the resolved path while argv[1] keeps the symlink path, so a
// plain comparison would never match and the gate would exit 0 having done nothing.
function invokedDirectly() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  run(process.argv);
}
