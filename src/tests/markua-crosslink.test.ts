/**
 * WP09 — crosslink ids: precedence + span resolution (VERIFICATION ONLY).
 *
 * Contract: `../../kitty-specs/markua-syntax-support-01M167JG/contracts/attribute-list-plugin.md`.
 * Requirement refs: FR-007 (crosslink ids), FR-008 (heading anchors still auto-id),
 * C-005 (explicit-id-wins precedence). See `data-model.md`'s "Id precedence rule"
 * and `research.md`'s D-06.
 *
 * This WP owns exactly ONE file — this test. The attribute-list plugin
 * (`../lib/remark/markua-attributes.ts` / `.internal.ts`) that WRITES the ids
 * this file verifies is owned WHOLE by WP08 and is imported, never re-edited,
 * here (a source diff in this WP is a finding — see the WP prompt's IC-01/IC-04
 * overlap note).
 *
 * SCOPE SPLIT (T038 — hand-off to WP10): a standard `[text](#id)` crosslink is
 * plain CommonMark — the link *syntax* is not Markua at all — so proving that a
 * link actually RESOLVES to its target in a rendered page (coverage rows 27-31
 * at the DOM level) needs the live corpus/build and is owned by WP10's
 * a11y/render lane. This file owns the unit-level proofs only:
 *   1. span forms (`[text]{#id}`, `word{#id}`) produce a `<span id>` (T036);
 *   2. block `{#id}` / `{id: …}` sets `hProperties.id` on the following block
 *      (T036);
 *   3. explicit-id-wins precedence, proven by RUNNING the real, pinned
 *      `@astrojs/markdown-remark@6.3.11` `rehypeHeadingIds` pass over a tree
 *      carrying a genuine collision — not cited, not re-implemented (T037);
 *   4. a closing consistency check (T038) that the ids proven here are exactly
 *      the anchors WP10's fixture links (`[go](#intro)`, `[span](#ipsum)`)
 *      target, so the two lanes don't drift apart.
 *
 * No `rehype-slug` dependency and no ordering shim exists anywhere in this
 * mission (D-06) — `rehypeHeadingIds` (Astro's own built-in, which runs LAST,
 * after user rehype plugins) already skips slug generation whenever
 * `node.properties.id` is already a string
 * (`@astrojs/markdown-remark/dist/rehype-collect-headings.js:52`). The comment
 * is here for the reader; the PASSING TEST below is the proof, never this
 * citation.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import markuaAttributes from '../lib/remark/markua-attributes.js';

/** Minimal structural mdast/hast node shape — enough to walk + assert on. */
interface Node {
  type: string;
  tagName?: string;
  value?: string;
  depth?: number;
  url?: string;
  properties?: Record<string, unknown>;
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
    hChildren?: Node[];
    [key: string]: unknown;
  };
  children?: Node[];
}

/** Depth-first search for the first node matching `predicate`. */
function find(tree: Node, predicate: (n: Node) => boolean): Node | undefined {
  if (predicate(tree)) return tree;
  for (const child of tree.children ?? []) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return undefined;
}

/** Depth-first collection of every node matching `predicate`. */
function findAll(tree: Node, predicate: (n: Node) => boolean): Node[] {
  const out: Node[] = [];
  const walk = (n: Node): void => {
    if (predicate(n)) out.push(n);
    for (const child of n.children ?? []) walk(child);
  };
  walk(tree);
  return out;
}

/** Parse `source` and run the real WP08 `markuaAttributes` plugin over it. */
function parseWithAttributes(source: string): Node {
  const tree = unified().use(remarkParse).parse(source) as unknown as Node;
  (markuaAttributes() as (t: Node) => void)(tree);
  return tree;
}

// ---------------------------------------------------------------------------
// T036 — span-form + block-id shape unit tests
// ---------------------------------------------------------------------------

describe('markuaAttributes — span forms (US3 sc.2, FR-007)', () => {
  it('[is lorem]{#lorem} -> <span id="lorem">is lorem</span> (bracketed span form)', () => {
    const tree = parseWithAttributes('Here [is lorem]{#lorem}.\n');
    const span = find(tree, (n) => n.data?.hName === 'span');
    expect(span, 'expected a markuaSpan node in the tree').toBeDefined();
    expect(span?.data?.hProperties).toEqual({ id: 'lorem' });
    expect(span?.data?.hChildren?.[0]?.value).toBe('is lorem');
  });

  it('This is ipsum{#ipsum}. -> <span id="ipsum">ipsum</span> around the preceding token (trailing word form)', () => {
    const tree = parseWithAttributes('This is ipsum{#ipsum}.\n');
    const span = find(tree, (n) => n.data?.hName === 'span');
    expect(span, 'expected a markuaSpan node in the tree').toBeDefined();
    expect(span?.data?.hProperties).toEqual({ id: 'ipsum' });
    expect(span?.data?.hChildren?.[0]?.value).toBe('ipsum');
  });

  it('a non-id key on a span (e.g. [x]{title: y}) is ignored — only id/#id is honoured on a span', () => {
    const tree = parseWithAttributes('See [x]{title: y} here.\n');
    const span = find(tree, (n) => n.data?.hName === 'span');
    expect(span, 'a non-id attribute set on a span must NOT produce a <span id>').toBeUndefined();

    // Degrades to literal text (FR-011 total/local guarantee) — the bracket run
    // survives unrewritten in the paragraph's reconstructed text.
    const paragraph = find(tree, (n) => n.type === 'paragraph');
    const text = (paragraph?.children ?? [])
      .filter((n) => n.type === 'text')
      .map((n) => n.value ?? '')
      .join('');
    expect(text).toContain('[x]{title: y}');
  });
});

describe('markuaAttributes — block id form (US3 sc.1, FR-007)', () => {
  it('{#intro} above a heading -> hProperties.id = "intro"', () => {
    const tree = parseWithAttributes('{#intro}\n# Section One\n');
    const heading = find(tree, (n) => n.type === 'heading');
    expect(heading?.data?.hProperties?.id).toBe('intro');
    // The consumed attribute-list paragraph must not survive as literal text
    // (contract: "the consumed attribute-list paragraph is removed").
    const stray = find(tree, (n) => n.type === 'paragraph');
    expect(stray, 'the {#id} attribute-list paragraph must be spliced out').toBeUndefined();
  });

  it('{id: foo} above a heading -> hProperties.id = "foo"', () => {
    const tree = parseWithAttributes('{id: foo}\n# Section Two\n');
    const heading = find(tree, (n) => n.type === 'heading');
    expect(heading?.data?.hProperties?.id).toBe('foo');
  });
});

// ---------------------------------------------------------------------------
// T037 — Explicit-id-wins precedence: RUN the real, pinned rehypeHeadingIds
// pass (no citation escape hatch — the assertion must exercise the actual
// pass, not the documented rule).
// ---------------------------------------------------------------------------

/**
 * Resolve a module transitively hung off `astro` (a direct devDependency of
 * `src/package.json`), the same chain `remark-version-pin.test.ts` uses (issue
 * #21 guard) for the identical reason: `@astrojs/markdown-remark` and its own
 * dependency `remark-rehype` are TRANSITIVE dependencies under pnpm's strict,
 * non-hoisted `node_modules` — a bare `import '@astrojs/markdown-remark'` from
 * this test file would not resolve them. Anchoring resolution at `astro`'s own
 * installed location, then at `@astrojs/markdown-remark`'s, replays Node's
 * resolution the same way the real Astro build does — so we import the EXACT
 * pinned pass the build runs, not a hand-picked copy.
 */
function resolveAstroMarkdownRemark(): { entry: string; version: string } {
  const req = createRequire(import.meta.url);
  let astroPkgJsonPath: string;
  try {
    astroPkgJsonPath = req.resolve('astro/package.json');
  } catch (err) {
    throw new Error(
      `markua-crosslink T037 guard: could not resolve "astro/package.json" (expected as a ` +
        `devDependency of src/package.json): ${(err as Error).message}`,
      { cause: err },
    );
  }
  const anchorRequire = createRequire(astroPkgJsonPath);
  let entry: string;
  try {
    entry = anchorRequire.resolve('@astrojs/markdown-remark');
  } catch (err) {
    throw new Error(
      `markua-crosslink T037 guard: could not resolve "@astrojs/markdown-remark" from astro's ` +
        `installed location (${astroPkgJsonPath}): ${(err as Error).message}`,
      { cause: err },
    );
  }
  // `@astrojs/markdown-remark`'s own `exports` map only exposes ".", so its
  // "package.json" subpath cannot be `require.resolve`d directly; derive the
  // package root from the resolved entry file instead (entry is always
  // ".../<pkg>/dist/index.js").
  const packageJsonPath = path.join(path.dirname(entry), '..', 'package.json');
  let version: string;
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    if (typeof pkg.version !== 'string' || pkg.version.length === 0) {
      throw new Error(`${packageJsonPath} has no string "version" field.`);
    }
    version = pkg.version;
  } catch (err) {
    throw new Error(
      `markua-crosslink T037 guard: could not read the resolved @astrojs/markdown-remark's ` +
        `own package.json at ${packageJsonPath}: ${(err as Error).message}`,
      { cause: err },
    );
  }
  return { entry, version };
}

/** Resolve `remark-rehype` off `@astrojs/markdown-remark`'s own install (a real dependency of it). */
function resolveRemarkRehype(markdownRemarkEntry: string): string {
  const anchorRequire = createRequire(markdownRemarkEntry);
  try {
    return anchorRequire.resolve('remark-rehype');
  } catch (err) {
    throw new Error(
      `markua-crosslink T037 guard: could not resolve "remark-rehype" from ` +
        `@astrojs/markdown-remark's installed location (${markdownRemarkEntry}): ` +
        `${(err as Error).message}`,
      { cause: err },
    );
  }
}

describe('crosslink id precedence — the REAL, pinned rehypeHeadingIds pass (C-005, US3 sc.3, FR-008)', () => {
  it('pins @astrojs/markdown-remark@6.3.11 — the exact version research.md (D-06) proves this against', () => {
    const { version } = resolveAstroMarkdownRemark();
    expect(
      version,
      'astro now resolves a different @astrojs/markdown-remark version than the one D-06 ' +
        'proved explicit-id-wins against; re-verify rehype-collect-headings.js:52 still skips ' +
        'slugging when node.properties.id is already a string, then update this pin.',
    ).toBe('6.3.11');
  });

  it('an explicit {#overview} heading keeps its id UNCHANGED while a sibling plain heading still gets an auto-slug — same tree, real pass', async () => {
    const { entry: markdownRemarkEntry } = resolveAstroMarkdownRemark();
    const remarkRehypeEntry = resolveRemarkRehype(markdownRemarkEntry);

    const [{ rehypeHeadingIds }, remarkRehypeMod] = await Promise.all([
      import(markdownRemarkEntry) as Promise<{ rehypeHeadingIds: () => (tree: Node, file: unknown) => void }>,
      import(remarkRehypeEntry) as Promise<{ default: unknown }>,
    ]);

    // ONE source, carrying BOTH cases in a single tree:
    //  (a) an explicit {#overview} heading whose OWN text ("Overview") would
    //      ALSO auto-slug to "overview" — a genuine collision, not a
    //      contrived id; the attribute-list plugin (WP08, real, imported
    //      above) is what writes this id, exactly as it would for a real
    //      page.
    //  (b) a sibling heading with NO Markua id syntax at all, proving
    //      FR-008 (auto-id keeps working) on the same pass.
    const source = ['{#overview}', '# Overview', '', '# Getting Started', ''].join('\n');

    const processor = unified()
      .use(remarkParse)
      .use(markuaAttributes)
      .use(remarkRehypeMod.default as never)
      .use(rehypeHeadingIds as never);

    const mdast = processor.parse(source);
    const hast = processor.runSync(mdast) as unknown as Node;

    const headings = findAll(hast, (n) => n.type === 'element' && /^h[1-6]$/.test(n.tagName ?? ''));
    expect(headings).toHaveLength(2);

    const explicitHeading = find(hast, (n) => n.type === 'element' && n.properties?.id === 'overview');
    const plainHeading = headings.find((h) => h !== explicitHeading);

    // (a) explicit id survives EXACTLY unchanged — the real rehypeHeadingIds
    // pass saw `properties.id === 'overview'` already a string and skipped
    // slug generation entirely (rehype-collect-headings.js:52) — it did NOT
    // suffix it (e.g. "overview-1") the way a naive collision handler would.
    expect(explicitHeading, 'the {#overview} heading must still be present after the real pass').toBeDefined();
    expect(explicitHeading?.properties?.id).toBe('overview');

    // (b) the sibling plain heading — no Markua id syntax — still received a
    // real auto-generated slug from the SAME pass (FR-008).
    expect(plainHeading, 'expected a second, plain heading in the tree').toBeDefined();
    expect(typeof plainHeading?.properties?.id).toBe('string');
    expect(plainHeading?.properties?.id).toBe('getting-started');
    expect(plainHeading?.properties?.id).not.toBe('overview');
  });
});

// ---------------------------------------------------------------------------
// T038 — resolution scope note + hand-off to WP10 consistency check
// ---------------------------------------------------------------------------

describe('T038 — resolution scope note (hand-off to WP10)', () => {
  it('the anchors proven above (#intro, #ipsum) are exactly what WP10 fixture links target', () => {
    // `[text](#id)` link RESOLUTION at the DOM level (does the browser actually
    // land on the target element — coverage rows 27-31) is a render-time
    // assertion owned by WP10's a11y/render lane against the live corpus; that
    // is intentionally NOT re-proven here (it would duplicate WP10 and risk the
    // two lanes drifting apart, per the WP09 prompt's "Don't duplicate WP10").
    //
    // What THIS file can — and does — assert without a live build: the ids
    // this suite proves the block/span passes attach (`intro` from the
    // `{#intro}` block-id case above, `ipsum` from the `word{#id}` span case
    // above) are the SAME strings WP10's fixture links target
    // (`[go](#intro)`, `[span](#ipsum)`), so a future rename of either side is
    // caught here rather than silently drifting.
    const introTree = parseWithAttributes('{#intro}\n# Intro\n');
    const introId = find(introTree, (n) => n.type === 'heading')?.data?.hProperties?.id;

    const ipsumTree = parseWithAttributes('This is ipsum{#ipsum}.\n');
    const ipsumId = find(ipsumTree, (n) => n.data?.hName === 'span')?.data?.hProperties?.id as
      | string
      | undefined;

    const fixtureLinkTargets = unified()
      .use(remarkParse)
      .parse('[go](#intro)\n\n[span](#ipsum)\n') as unknown as Node;
    const linkUrls = findAll(fixtureLinkTargets, (n) => n.type === 'link').map((n) => n.url);

    expect(linkUrls).toEqual([`#${introId}`, `#${ipsumId}`]);
  });
});
