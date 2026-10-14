/**
 * WP04 T025 — sidebar and table-of-contents shaping, proven against the BUILT
 * HTML of the example site (FR-011, FR-019..FR-022, NFR-006, SC-006).
 *
 * `route-shaping.test.ts` proves the rules on hand-built trees. That cannot show
 * that Starlight actually runs the toolkit's route middleware, that the
 * directory metadata reaches it, or that every page ends up with the same
 * sidebar. This suite builds the example ("the example IS the test") and reads
 * the result.
 *
 * The build runs once, into its own `DK_OUTDIR`, and the file is listed in
 * `vitest.workspace.ts`'s serialized `build` project, for the reasons
 * `toc-rail-build-html.test.ts` gives: build suites share `example/.astro` and
 * must not overlap.
 *
 * Mission: sidebar-frame-header-carrier-01M4T3CB, WP04.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { REVEAL_CURRENT_SCRIPT } from '../lib/route-shaping.js';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT_DIR_NAME = 'dist-wp04-sidebar-shaping-test';
const OUT_DIR = path.join(REPO_ROOT, 'example', OUT_DIR_NAME);
const CONSUMER_OUT_DIR_NAME = 'dist-wp07-consumer-sidebar-test';
const CONSUMER_OUT_DIR = path.join(REPO_ROOT, 'example', CONSUMER_OUT_DIR_NAME);
const CONSUMER_CONFIG = fileURLToPath(
  new URL('./fixtures/consumer-sidebar/astro.config.mjs', import.meta.url),
);
const SITE_BASE = '/doc-kitty';

/**
 * The authored directories whose names Starlight showed as group labels before
 * the sidebar-frame-header-carrier mission. Kept as a named regression list;
 * the check below also covers every generated group (#112).
 */
const AUTHORED_DIRECTORY_SLUGS = ['audience', 'missions', 'book-one', 'book-two', 'book-three'];

interface Node {
  label: string;
  href?: string;
  current?: boolean;
  children?: Node[];
}

let build: { status: number | null; stdout: string; stderr: string };

function readOut(relPath: string): string {
  const abs = path.join(OUT_DIR, relPath);
  if (!existsSync(abs)) throw new Error(`expected built file missing: ${relPath} (${abs})`);
  return readFileSync(abs, 'utf8');
}

/** The sidebar pane's markup: from its id to the end of the enclosing `<nav>`. */
function sidebarHtml(doc: string): string {
  const start = doc.indexOf('id="starlight__sidebar"');
  if (start === -1) throw new Error('page has no sidebar pane');
  return doc.slice(start, doc.indexOf('</nav>', start));
}

/** Parse Starlight's rendered sidebar (`<details>` groups, `<a>` links) into a tree. */
function sidebarTree(doc: string): Node[] {
  const root: Node = { label: '', children: [] };
  const stack: Node[] = [root];
  const token =
    /<details\b|<\/details>|<span class="large[^"]*"[^>]*>([^<]*)<\/span>|<a href="([^"]*)"([^>]*)>\s*<span[^>]*>([^<]*)<\/span>/g;
  let m: RegExpExecArray | null;
  const html = sidebarHtml(doc);
  while ((m = token.exec(html)) !== null) {
    const top = stack[stack.length - 1]!;
    if (m[0] === '<details') {
      const group: Node = { label: '', children: [] };
      top.children!.push(group);
      stack.push(group);
    } else if (m[0] === '</details>') {
      stack.pop();
    } else if (m[1] !== undefined) {
      top.label = m[1].trim();
    } else {
      top.children!.push({ label: m[4]!.trim(), href: m[2], current: /aria-current="page"/.test(m[3]!) });
    }
  }
  return root.children!;
}

const groupsOf = (nodes: Node[]): Node[] =>
  nodes.flatMap((n) => (n.children ? [n, ...groupsOf(n.children)] : []));
const findGroup = (nodes: Node[], label: string): Node => {
  const found = groupsOf(nodes).find((g) => g.label === label);
  if (!found) throw new Error(`no sidebar group labelled "${label}"`);
  return found;
};
const route = (slug: string): string => `${SITE_BASE}/${slug}/`;

describe('WP04 — sidebar and TOC shaping in the built example', () => {
  let home = '';
  let tree: Node[] = [];

  beforeAll(() => {
    rmSync(OUT_DIR, { recursive: true, force: true });
    const childEnv = { ...process.env };
    // Vitest injects BASE_URL; passed through it would override the site base.
    delete childEnv.BASE_URL;
    build = spawnSync('pnpm', ['--filter', 'example', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      // Every group this suite names holds published pages (the Plans section
      // was promoted from draft), so the build needs no DK_PUBLISH_DRAFTS value.
      env: { ...childEnv, DK_OUTDIR: OUT_DIR_NAME },
    });
    if (build.status === 0 && existsSync(path.join(OUT_DIR, 'index.html'))) {
      home = readOut('index.html');
      tree = sidebarTree(home);
    }
  }, 180_000);

  it('the example build succeeds', () => {
    expect(build.status, `build stderr:\n${build.stderr}`).toBe(0);
    expect(tree.length).toBeGreaterThan(0);
  });

  it('labels no group with its directory name, authored or generated (FR-019, SC-006, #112)', () => {
    const labels = groupsOf(tree).map((g) => g.label);
    for (const slug of AUTHORED_DIRECTORY_SLUGS) {
      expect(labels, `group label "${slug}" is a raw directory name`).not.toContain(slug);
    }
    expect(labels).toContain('Audiences');
    expect(labels).toContain('Missions');
    // Every nested group, generated ones included: its first entry is its
    // directory's index, so that href names the directory.
    for (const top of tree.filter((n) => n.children)) {
      for (const nested of groupsOf(top.children!)) {
        const dir = nested.children![0]!.href!.replace(/\/$/, '');
        const segment = dir.slice(dir.lastIndexOf('/') + 1);
        expect(nested.label, `group for ${dir} is labelled with its directory name`).not.toBe(segment);
      }
    }
  });

  it('starts no group with an entry that repeats the group label (#112)', () => {
    for (const group of groupsOf(tree)) {
      expect(group.children![0]!.label, `"${group.label}" repeats its own label first`).not.toBe(group.label);
    }
    // The repeated index entry reads "Overview"; a group whose index has its
    // own name keeps it.
    expect(findGroup(tree, 'Guides').children![0]).toMatchObject({ label: 'Overview', href: route('guides') });
    expect(findGroup(tree, 'Reference').children![0]).toMatchObject({ label: 'Glossary', href: route('glossary') });
  });

  it('lists each one-page glossary context as a link under the glossary, not as a group (#112)', () => {
    const reference = findGroup(tree, 'Reference').children!;
    expect(reference.filter((n) => n.children), 'Reference holds no subgroup').toEqual([]);
    expect(reference.map((n) => [n.label, n.href])).toEqual([
      ['Glossary', route('glossary')],
      ['hr', route('glossary/hr')],
      ['rhetoric', route('glossary/rhetoric')],
      ['shipping', route('glossary/shipping')],
    ]);
  });

  it('lists the rhetoric section pages in reading order (#112)', () => {
    // The section's own pages: links that are not a book folder shown as a link.
    const pages = findGroup(tree, 'Rhetoric').children!.filter((n) => !n.children && !n.href!.includes('/book-'));
    expect(pages.map((n) => n.href)).toEqual([
      route('rhetoric'),
      route('rhetoric/introduction'),
      route('rhetoric/preamble'),
      route('rhetoric/about-and-license'),
    ]);
  });

  it('keeps the top-level groups in registry order with their registry labels', () => {
    expect(tree.filter((n) => n.children).map((n) => n.label)).toEqual([
      'Context',
      'Architecture',
      'Decision Records',
      'Plans',
      'Behaviour',
      'Guides',
      'Rhetoric',
      'Presentations',
      'Reference',
      'Changelog',
      'Glossary Demo',
    ]);
  });

  it('orders the three books numerically, after the section pages (FR-020)', () => {
    const rhetoric = findGroup(tree, 'Rhetoric').children!;
    // A book folder is a group, or a link when its index is its only page (#112).
    const isBook = (n: Node): boolean => (n.children?.[0]?.href ?? n.href ?? '').includes('/book-');
    const hrefOf = (n: Node): string => (n.children ? n.children[0]!.href! : n.href!);
    expect(rhetoric.filter(isBook).map(hrefOf)).toEqual([
      route('rhetoric/book-one'),
      route('rhetoric/book-two'),
      route('rhetoric/book-three'),
    ]);
    const firstBook = rhetoric.findIndex(isBook);
    expect(rhetoric.slice(firstBook).every(isBook), 'section pages precede the book folders').toBe(true);
    // Non-vacuity: the example holds both shapes of book folder.
    expect(rhetoric.filter(isBook).map((n) => Boolean(n.children))).toEqual([true, false, false]);
  });

  it('puts each section index first in its group (FR-021)', () => {
    const indexOf: Array<[string, string]> = [
      ['Context', 'context'],
      ['Audiences', 'context/audience'],
      ['Plans', 'plans'],
      ['Missions', 'plans/missions'],
      ['Rhetoric', 'rhetoric'],
      ['Reference', 'glossary'],
    ];
    for (const [label, slug] of indexOf) {
      expect(findGroup(tree, label).children![0]!.href, `first entry of "${label}"`).toBe(route(slug));
    }
    // Every nested group, whatever its label: the first entry is the index of
    // the directory its links live in.
    for (const top of tree.filter((n) => n.children)) {
      for (const nested of groupsOf(top.children!)) {
        const first = nested.children![0]!;
        const sibling = nested.children!.find((n) => n.href && n !== first);
        if (sibling) expect(sibling.href!.startsWith(first.href!), `${nested.label}: ${first.href}`).toBe(true);
      }
    }
  });

  it('raises no fallback-label warning: every nested directory has a titled index (FR-023)', () => {
    expect(`${build.stdout}\n${build.stderr}`).not.toContain('[dk-sidebar]');
  });

  it('renders the same sidebar on every page, apart from the current entry (NFR-006)', () => {
    const strip = (doc: string): string =>
      sidebarHtml(doc)
        // Starlight renders `aria-current="false"` on every other link.
        .replace(/aria-current="page"/g, 'aria-current="false"')
        // Starlight opens the groups on the path to the current page.
        .replace(/<details open/g, '<details');
    const deep = readOut('rhetoric/book-one/chapter-02/index.html');
    const hub = readOut('context/audience/index.html');
    expect(strip(deep)).toBe(strip(home));
    expect(strip(hub)).toBe(strip(home));
    // …and the current entry is the page itself, exactly once.
    const current = (doc: string): string[] => {
      const flat = (nodes: Node[]): Node[] => nodes.flatMap((n) => (n.children ? flat(n.children) : [n]));
      return flat(sidebarTree(doc)).filter((n) => n.current).map((n) => n.href!);
    };
    expect(current(deep)).toEqual([route('rhetoric/book-one/chapter-02')]);
    expect(current(hub)).toEqual([route('context/audience')]);
  });

  it('follows the shaped order in prev/next links', () => {
    // `/rhetoric/` is now first in its group, so its next page is the next
    // section page, not the first book (which sorted ahead of it before).
    const next = (doc: string): string | undefined =>
      /<a\b[^>]*\brel="next"[^>]*>/.exec(doc)?.[0].match(/href="([^"]*)"/)?.[1] ??
      /<a\b[^>]*href="([^"]*)"[^>]*\brel="next"/.exec(doc)?.[1];
    expect(next(readOut('rhetoric/index.html'))).toBe(route('rhetoric/introduction'));
    expect(next(readOut('rhetoric/book-one/index.html'))).toBe(route('rhetoric/book-one/chapter-01'));
  });

  it('names a section index by its title in prev/next, not "Overview" (#112)', () => {
    // A ratchet: on main nothing reads "Overview", so this also passes there.
    // Its paired control is the unit case "names pagination links by their
    // page titles", which proves the shaped tree does read "Overview".
    const flat = (nodes: Node[]): Node[] => nodes.flatMap((n) => (n.children ? flat(n.children) : [n]));
    const links = flat(tree).filter((n) => n.href?.startsWith(SITE_BASE));
    const before = links[links.findIndex((n) => n.href === route('guides')) - 1]!;
    const page = readOut(`${before.href!.slice(SITE_BASE.length + 1)}index.html`);
    const nextTitle = /rel="next"[\s\S]*?<span class="link-title[^"]*">([^<]*)<\/span>/.exec(page)?.[1];
    expect(nextTitle, `next link on ${before.href}`).toBe('Guides');
  });

  it('reserves no rail for a near-empty table of contents (FR-011)', () => {
    const hub = readOut('context/audience/index.html');
    expect(hub).not.toContain('right-sidebar');
    expect(/<html[^>]*data-has-toc/.test(hub)).toBe(false);
    // A page with real headings keeps its rail.
    const chapter = readOut('rhetoric/book-one/chapter-02/index.html');
    expect(chapter).toContain('right-sidebar');
    expect(/<html[^>]*data-has-toc/.test(chapter)).toBe(true);
  });

  it('ships the reveal-current-entry script inline in <head> (FR-022)', () => {
    const head = home.slice(0, home.search(/<body[\s>]/i));
    expect(head).toContain(REVEAL_CURRENT_SCRIPT);
  });
});

/**
 * C-004 — a sidebar the consumer wrote is rendered as written.
 *
 * `config-invariants.test.ts` proves the switch (`shapeSidebar` is false when a
 * `sidebar` is supplied) at config level. This proves the other end: the route
 * middleware, running in a real build, leaves that sidebar alone, nested groups
 * included, while its table-of-contents shaping still applies.
 *
 * Same pages as the suite above, built with `fixtures/consumer-sidebar`.
 */
describe('WP07 — a consumer-supplied sidebar is not reshaped (C-004)', () => {
  let consumer: { status: number | null; stdout: string; stderr: string };
  let tree: Node[] = [];

  beforeAll(() => {
    rmSync(CONSUMER_OUT_DIR, { recursive: true, force: true });
    const env: Record<string, string | undefined> = {
      ...process.env,
      DK_OUTDIR: CONSUMER_OUT_DIR_NAME,
    };
    // Vitest's own `import.meta.env` values; see `header-carrier.test.ts`.
    for (const name of ['NODE_ENV', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL']) delete env[name];
    consumer = spawnSync(
      'pnpm',
      ['--filter', 'example', 'exec', 'astro', 'build', '--config', path.relative(path.join(REPO_ROOT, 'example'), CONSUMER_CONFIG)],
      { cwd: REPO_ROOT, encoding: 'utf8', env },
    );
    const index = path.join(CONSUMER_OUT_DIR, 'index.html');
    if (consumer.status === 0 && existsSync(index)) tree = sidebarTree(readFileSync(index, 'utf8'));
  }, 180_000);

  const page = (rel: string): string => readFileSync(path.join(CONSUMER_OUT_DIR, rel), 'utf8');

  it('the build succeeds with exactly the two groups the consumer wrote', () => {
    expect(consumer.status, `build stderr:\n${consumer.stderr}`).toBe(0);
    // Groups only: the pane also holds the mobile social link after them.
    expect(tree.filter((n) => n.children).map((n) => n.label)).toEqual([
      'Hand-written',
      'rhetoric as generated',
    ]);
  });

  it('keeps a hand-written group in the written order: nested group before the link', () => {
    const [written] = tree;
    expect(written!.children).toEqual([
      {
        label: 'nested-group',
        children: [
          { label: 'Second chapter', href: route('rhetoric/book-one/chapter-02'), current: false },
          { label: 'First chapter', href: route('rhetoric/book-one/chapter-01'), current: false },
        ],
      },
      { label: 'Link after the group', href: route('guides/getting-started'), current: false },
    ]);
  });

  it('keeps Starlight\'s own labels and order in an autogenerated group', () => {
    const generated = findGroup(tree, 'rhetoric as generated').children!;
    // Starlight labels each subgroup with its directory name; the toolkit's own
    // sidebar shows the index titles instead.
    expect(generated.filter((n) => n.children).map((n) => n.label)).toEqual([
      'book-one',
      'book-two',
      'book-three',
    ]);
    // Starlight places the section index after the ordered pages and keeps a
    // one-page folder as a group; shaping would put the index first, labelled
    // "Overview", and show `book-two` as a link (#112).
    expect(generated[0]!.children, 'the first entry is a subgroup').toBeDefined();
    expect(generated.at(-1)).toEqual({ label: 'Rhetoric', href: route('rhetoric'), current: false });
    expect(findGroup(tree, 'book-two').children!.map((n) => n.href)).toEqual([route('rhetoric/book-two')]);
  });

  it('reports no shaping warning for a sidebar it did not shape', () => {
    expect(`${consumer.stdout}\n${consumer.stderr}`).not.toContain('[dk-sidebar]');
  });

  it('still runs the middleware: a near-empty table of contents gets no rail', () => {
    // Non-vacuity for the tests above: the toolkit's route middleware did run on
    // this build. Its sidebar step was skipped; its TOC step was not.
    expect(/<html[^>]*data-has-toc/.test(page('context/audience/index.html'))).toBe(false);
    expect(/<html[^>]*data-has-toc/.test(page('rhetoric/book-one/chapter-02/index.html'))).toBe(true);
  });
});
