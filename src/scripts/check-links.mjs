#!/usr/bin/env node
/**
 * Internal link & reference integrity check for a Common Docs — Kitty Variation
 * tree, without a full Astro build. Fast enough for a CI gate.
 *
 * Usage:
 *   node src/scripts/check-links.mjs [<root> ...]   # default: docs example/docs
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
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, dirname, resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';

export const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|mailto:|tel:)/i;
const MD_EXT = /\.mdx?$/i;
// Inline links `](target)` and `](target "title")`; also image links `![]()`,
// which are filtered out later by extension (assets are out of scope).
const INLINE_LINK = /\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;

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
 * Does `candidate` resolve to a real doc or route?
 * A route target may name a directory (its section index) or an extension-less
 * path; try the README-as-index and `.md`/`.mdx` forms.
 */
export function resolvesToDoc(candidate) {
  if (existsSync(candidate)) {
    // A directory is a route → require it exist (section index optional here;
    // frontmatter gate already checks any README it holds).
    return true;
  }
  return (
    existsSync(`${candidate}.md`) ||
    existsSync(`${candidate}.mdx`) ||
    existsSync(join(candidate, 'README.md')) ||
    existsSync(join(candidate, 'index.md'))
  );
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
 * Given a docs root and a page's parsed frontmatter, return the internal
 * `related` refs that do not resolve to an existing doc/route.
 */
export function collectDanglingRelated(root, data) {
  const dangling = [];
  const related = data?.related;
  if (!Array.isArray(related)) return dangling;
  for (const entry of related) {
    const ref = relatedRefString(entry);
    if (ref === null) continue;
    const id = stripFragment(ref.trim());
    if (!id || EXTERNAL.test(ref.trim())) continue;
    if (!resolvesToDoc(resolve(root, id))) dangling.push(ref);
  }
  return dangling;
}

/**
 * Decide whether an inline-link target is an internal doc/route link we own.
 * @returns {null | string} the cleaned, fragment-free target, or null to skip.
 */
function docLinkTarget(rawTarget) {
  const target = stripFragment(rawTarget.trim());
  if (!target) return null; // pure anchor / empty
  if (EXTERNAL.test(rawTarget.trim())) return null; // external / site-absolute
  if (rawTarget.trim().startsWith('/')) return null; // site-absolute route
  const ext = extname(target).toLowerCase();
  // Doc link (.md/.mdx) or route (no extension / trailing slash). Any other
  // extension (.png, .jpg, .xml, .json, …) is an asset — out of scope.
  if (ext && !MD_EXT.test(target)) return null;
  return target;
}

/** CLI entry point: scan every `.md`/`.mdx` under each root for dangling refs. */
export function run(argv) {
  const roots = argv.slice(2);
  if (roots.length === 0) roots.push('docs', 'example/docs');

  let dangling = 0;
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

      // 1) Inline Markdown links in the body (code stripped so examples aren't links).
      const body = stripCode(parsed.content);
      let m;
      INLINE_LINK.lastIndex = 0;
      while ((m = INLINE_LINK.exec(body)) !== null) {
        const target = docLinkTarget(m[1]);
        if (target === null) continue;
        checked++;
        const candidate = resolve(dirname(file), target);
        if (!resolvesToDoc(candidate)) {
          dangling++;
          console.error(`✖ ${rel}: dangling link → ${m[1]}`);
        }
      }

      // 2) `related:` frontmatter refs — docs-root-relative ids, no extension.
      // An entry is a bare slug or an object `{ ref, note }` (ADR-0009); both
      // forms resolve, and a dangling object-form ref is an error too.
      const related = parsed.data?.related;
      if (Array.isArray(related)) {
        for (const entry of related) {
          const ref = relatedRefString(entry);
          if (ref === null) continue;
          const id = stripFragment(ref.trim());
          if (!id || EXTERNAL.test(ref.trim())) continue;
          checked++;
          if (!resolvesToDoc(resolve(root, id))) {
            dangling++;
            console.error(`✖ ${rel}: dangling related ref → ${ref}`);
          }
        }
      }
    }
  }

  if (dangling) {
    console.error(
      `\n${dangling} dangling reference(s) across ${fileCount} file(s) (${checked} checked).`,
    );
    process.exit(1);
  }
  console.log(
    `✓ ${checked} internal reference(s) resolve across ${fileCount} file(s) in ${roots.length} root(s): ${roots.join(', ')}.`,
  );
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run(process.argv);
}
