import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import { loadGlossary } from '../lib/glossary/load.js';
import glossaryTerm from '../lib/remark/glossary-term.js';
import {
  computePageLinks,
  formatUnresolvedWarning,
  type MdRoot,
} from '../lib/remark/glossary-autolink.internal.js';

/**
 * WP09 T030 (NFR-007 / R-2) — the greppable collision warning proven at the REAL
 * BUILD LAYER, not just in a vitest of the pure core. A context-free page that
 * uses the word "policy" — defined in BOTH the `hr` and `shipping` contexts of
 * `example/.contextive/definitions.yaml` — must leave it plain and emit exactly
 * ONE pinned, greppable line to stderr (the core dedups per distinct surface per
 * PAGE), and the build must still exit 0 (skip-and-warn, INV-G3).
 *
 * gherkin-feature-pages WP08 (ADR-0046) adds a SECOND such page on purpose: the
 * generated `behaviour/hr/request-leave.md` (from the context-free
 * `example/features/hr/request-leave.feature`, whose step says "the leave
 * policy"). The pin therefore moves from "exactly one line" to "exactly one line
 * PER OFFENDING PAGE", with the offending pages NAMED below. The warning text
 * carries no page name, so attribution is proven in two halves:
 *   1. each named page, run through the build's own term/auto-link core with its
 *      own frontmatter context, emits the pinned line (so each contributes one);
 *   2. the build emits the line exactly `OFFENDING_PAGES.length` times.
 * Together: the build's warnings come from exactly these pages — the generated
 * Gherkin page is one of them, and no other page warns (a third offender, or a
 * lost dedup, changes the count and reds).
 *
 * The build is spawned with a cleared Astro content cache so the markdown pipeline
 * genuinely re-runs (a warm cache would reuse a prior render and emit nothing).
 * This is an integration test over the shipped example, so it is given a generous
 * timeout.
 */

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXAMPLE_ROOT = fileURLToPath(new URL('../../example/', import.meta.url));

// The exact line the resolver + wrapper pin (competing contexts sorted): the
// build gate greps for THIS string, so it is pinned here verbatim.
const PINNED_WARNING =
  '[glossary] unresolved collision "policy" in hr, shipping — left unlinked';

// The context-free pages that say "policy", relative to example/docs/.
const OFFENDING_PAGES = [
  // WP09 T033 — the hand-authored glossary demonstrator.
  'glossary-demo/cargo-and-collisions.md',
  // gherkin-feature-pages WP08 — generated from example/features/hr/request-leave.feature.
  'behaviour/hr/request-leave.md',
] as const;

/** The pinned-warning lines the build's term + auto-link core emits for one page. */
function unresolvedWarningsFor(relPath: string): string[] {
  const glossary = loadGlossary(EXAMPLE_ROOT);
  if (!glossary.present) throw new Error('example/.contextive/definitions.yaml is missing');
  const { data, content } = matter(readFileSync(`${EXAMPLE_ROOT}docs/${relPath}`, 'utf8'));
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(glossaryTerm, { index: glossary.index });
  const tree = processor.runSync(processor.parse(content)) as unknown as MdRoot;
  const warnings: string[] = [];
  computePageLinks(
    tree,
    typeof data.glossary_context === 'string' ? data.glossary_context : undefined,
    glossary.index,
    new Set(),
    (surface, competing) => warnings.push(formatUnresolvedWarning(surface, competing)),
  );
  return warnings;
}

describe('example build surfaces the unresolved-collision warning (NFR-007 / R-2)', () => {
  it.each(OFFENDING_PAGES)('%s is context-free and emits the pinned warning exactly once', (relPath) => {
    const { data } = matter(readFileSync(`${EXAMPLE_ROOT}docs/${relPath}`, 'utf8'));
    expect(data.glossary_context, `${relPath} must declare no glossary_context`).toBeUndefined();
    const pinned = unresolvedWarningsFor(relPath).filter((w) => w === PINNED_WARNING);
    expect(pinned, relPath).toHaveLength(1);
  });

  it(
    'emits the pinned warning exactly once per offending page on stderr and exits 0',
    () => {
      // Clear the content-layer cache + prior output so the pipeline re-runs and
      // the warning is actually produced (a warm cache reuses a cached render).
      for (const dir of ['example/.astro', 'example/node_modules/.astro', 'example/dist']) {
        rmSync(new URL(`../../${dir}`, import.meta.url), { recursive: true, force: true });
      }

      // Vitest's OWN process env carries a `BASE_URL` variable (it mirrors
      // Vite's client `import.meta.env.BASE_URL` for Node-environment tests,
      // defaulting to `/`). Passing `process.env` straight through leaks it into
      // this REAL `astro build` child, where it silently overrides the site's
      // configured `base` (`/doc-kitty`) for every SSR-rendered
      // `import.meta.env.BASE_URL` read — and this build writes the SHARED
      // `example/dist`, so `pnpm assert:artifacts` then fails after `pnpm test`.
      // Strip it so the child computes its own base from
      // `example/astro.config.mjs` (mirrors `example-adopter.test.ts`).
      const childEnv = { ...process.env };
      delete childEnv.BASE_URL;
      const result = spawnSync('pnpm', ['--filter', 'example', 'build'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: childEnv,
      });

      // The build must SUCCEED — the collision is a warning, never fatal.
      expect(result.status, `build stderr:\n${result.stderr}`).toBe(0);

      // One pinned line per offending page (the dedup is per distinct surface per
      // page), and no more: see the attribution argument in the header.
      const occurrences = stripVTControlCharacters(result.stderr).split(PINNED_WARNING).length - 1;
      expect(
        occurrences,
        `expected exactly ${OFFENDING_PAGES.length} pinned collision warnings ` +
          `(one per page in OFFENDING_PAGES); stderr:\n${result.stderr}`,
      ).toBe(OFFENDING_PAGES.length);
      // This build writes the SHARED `example/dist`: it must carry the site's own
      // base, not vitest's leaked BASE_URL.
      const home = readFileSync(new URL('../../example/dist/index.html', import.meta.url), 'utf8');
      expect(home).toContain('href="/doc-kitty/behaviour/');
      expect(home).not.toContain('href="/behaviour/');
    },
    180_000,
  );
});
