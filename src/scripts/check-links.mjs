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
 *
 * ## Fail-closed tightening (#62, FR-005/NFR-003)
 *
 * This gate used to be green-on-broken for two authored-link shapes that 404
 * on the deployed `example/docs` site (root cause: this gate resolves a
 * relative link against the FILESYSTEM, not the served URL — see
 * `research.md` D4). It is now tightened, but ONLY for {@link SITE_ROOTS} —
 * roots that are actually built by Astro/Starlight under a trailing-slash
 * directory-route base (currently `example/docs`). The top-level `docs/` root
 * is plain, unbuilt Markdown (viewed on GitHub, no base, no directory-URL
 * trap) where `.md`-relative cross-links are the correct, working convention
 * — tightening applies there would be pure false positives.
 *
 * For a `SITE_ROOTS` file, an inline link that is INTERNAL and RELATIVE
 * (not root-absolute, not external) is now rejected outright when it is:
 *   - `.md`/`.mdx`-relative — confirmed (WP01 review-cycle-1) to render
 *     VERBATIM, un-rewritten, by this Starlight build: a real 404 in dist.
 *   - extensionless AND missing a trailing slash — the exact class-A trap:
 *     filesystem-relative resolution finds a SIBLING file, but under
 *     trailing-slash directory routing the served URL resolves it as a
 *     CHILD of the current page, which 404s.
 * A relative link that names a real subdirectory route (extensionless, ENDS
 * in `/`, e.g. `./missions/mission-alpha/` from a directory-index page) stays
 * accepted — that shape is genuinely correct under directory-URL semantics.
 * A root-absolute link (`/architecture/overview/`) stays accepted here too —
 * WP01 established that as the correct authored convention (a rehype plugin
 * base-prefixes it at render time); this fast, filesystem-only gate cannot
 * verify a root-absolute target resolves against the real route tree, so it
 * is intentionally left to `assert-no-broken-links.mjs` (the base-aware,
 * built-output gate) to be the authority on whether it actually 200s.
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, dirname, resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';

// FR-003: a directory-link target resolves via EITHER configured index
// basename. `README` is the default; `index` is accepted unconditionally too
// (this gate has no per-root config surface), so an opted-in `index.md` tree
// (FR-001) was already covered before this mission — kept as an explicit,
// documented list rather than two bare literals so a reviewer can see the
// full FR-003 surface in one place.
export const INDEX_BASENAMES = ['README', 'index'];

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
    INDEX_BASENAMES.some((basename) => existsSync(join(candidate, `${basename}.md`)))
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
 * Classify one inline-link target for the internal-doc-link check.
 *
 * @param {string} rawTarget the raw `](target)` capture, untrimmed
 * @param {{ strict?: boolean }} [opts] `strict: true` applies the #62
 *   fail-closed tightening (see the module doc comment) — only meaningful for
 *   a {@link SITE_ROOTS} tree.
 * @returns {{ kind: 'skip' } | { kind: 'invalid', reason: string } | { kind: 'check', target: string }}
 *   `skip` — not an internal doc/route link we own (external, site-absolute,
 *   pure anchor, or a non-Markdown asset); `invalid` — a strict-mode
 *   violation, fail regardless of filesystem resolution; `check` — resolve
 *   `target` (fragment-free) against the filesystem as before.
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

  if (strict) {
    if (MD_EXT.test(target)) {
      return {
        kind: 'invalid',
        reason:
          '.md-relative link is not rewritten by Astro/Starlight and 404s in the deployed site — use a root-absolute route instead (e.g. /section/page/); the base plugin prefixes it',
      };
    }
    if (!ext && !target.endsWith('/')) {
      return {
        kind: 'invalid',
        reason:
          'bare relative link resolves as a CHILD of this page under trailing-slash directory routing, not a sibling — use a root-absolute route instead (e.g. /section/page/)',
      };
    }
  }

  return { kind: 'check', target };
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
    const strict = isSiteRoot(root);

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
        const classified = classifyInlineLink(m[1], { strict });
        if (classified.kind === 'skip') continue;
        checked++;
        if (classified.kind === 'invalid') {
          dangling++;
          console.error(`✖ ${rel}: ${classified.reason} → ${m[1]}`);
          continue;
        }
        const candidate = resolve(dirname(file), classified.target);
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
