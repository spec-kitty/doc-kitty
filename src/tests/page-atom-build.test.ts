/**
 * Per-page Atom entries on built sites (page-chrome WP08; FR-020, NFR-001, NFR-008,
 * and FR-022's half). The chrome fixture builds with `DK_PUBLISH_DRAFTS=on` unless a
 * request says otherwise, and has a draft page (`adr/template`), an undated page
 * (`guides/undated`) and a generated-stamp page. The example is built once into its
 * own `DK_OUTDIR` for the coverage count. Serialized in the `build` project.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import sax from 'sax';
import { describe, expect, it } from 'vitest';
import { stripNonContent } from '../lib/routes/strip-non-content.js';
import { clearInternalEnv } from '../lib/internal-env.mjs';
import { buildChromeFixture, REPO_ROOT } from './fixtures/chrome/harness.mjs';

const BUILD_TIMEOUT = 240_000;
const ATOM_NS = 'http://www.w3.org/2005/Atom';
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** Strict-parse an entry document; returns problems (empty when it is a valid entry). */
function entryProblems(xml: string): string[] {
  const problems: string[] = [];
  const parser = sax.parser(true, { xmlns: true });
  const depthNames: string[] = [];
  const counts: Record<string, number> = {};
  let text = '';
  let updated = '';
  parser.onerror = (error) => {
    problems.push(`not well-formed: ${error.message.split('\n')[0]}`);
    parser.error = null as never;
  };
  parser.onopentag = (tag) => {
    const node = tag as sax.QualifiedTag;
    if (depthNames.length === 0) {
      if (node.local !== 'entry' || node.uri !== ATOM_NS) problems.push(`root is ${node.uri}:${node.local}, not Atom entry`);
    } else if (depthNames.length === 1 && node.uri === ATOM_NS) {
      counts[node.local] = (counts[node.local] ?? 0) + 1;
    }
    depthNames.push(node.local);
    text = '';
  };
  parser.ontext = (chunk) => {
    text += chunk;
  };
  parser.onclosetag = () => {
    if (depthNames.length === 2 && depthNames[1] === 'updated') updated = text.trim();
    depthNames.pop();
  };
  parser.write(xml).close();
  for (const name of ['id', 'title', 'updated', 'author']) {
    if (counts[name] !== 1) problems.push(`expected exactly one <${name}>, found ${counts[name] ?? 0}`);
  }
  if (!RFC3339.test(updated)) problems.push(`updated "${updated}" is not RFC 3339`);
  return problems;
}

/** The glossary pages a build generated, as `files` for a second root. */
function generatedGlossaryFiles(root: string): Record<string, string> {
  const base = path.join(root, 'docs', 'glossary');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  return Object.fromEntries(walk(base).map((f) => [path.relative(root, f).split(path.sep).join('/'), readFileSync(f, 'utf8')]));
}

function atomFiles(dist: string): string[] {
  const root = path.join(dist, 'api', 'pages');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.atom.xml') ? [path.join(dir, e.name)] : [],
    );
  return existsSync(root) ? walk(root).map((f) => path.relative(root, f).split(path.sep).join('/')).sort() : [];
}

describe('entry check (NFR-008 control)', () => {
  const good = `<?xml version="1.0" encoding="utf-8"?><entry xmlns="${ATOM_NS}"><id>u</id><title>t</title><updated>2026-10-31T00:00:00.000Z</updated><author><name>n</name></author></entry>`;
  it('accepts a valid entry', () => expect(entryProblems(good)).toEqual([]));
  it('rejects an unescaped &', () => {
    expect(entryProblems(good.replace('<title>t', '<title>a & b'))).not.toEqual([]);
  });
  it('rejects a wrong root namespace, a duplicate id and a bad date', () => {
    expect(entryProblems(good.replace(ATOM_NS, 'urn:x'))).not.toEqual([]);
    expect(entryProblems(good.replace('<id>u</id>', '<id>u</id><id>v</id>'))).not.toEqual([]);
    expect(entryProblems(good.replace('2026-10-31T00:00:00.000Z', 'yesterday'))).not.toEqual([]);
  });
});

const DATED = [
  'adr', 'context', 'context/audience/reader', 'guides', 'guides/authoring', 'guides/authoring/advanced',
  'guides/authoring/advanced/deep-page', 'guides/authoring/style', 'guides/empty-hub', 'guides/getting-started',
  'glossary', 'glossary/fixture', 'home', 'reference', 'reference/generated-page', 'reference/notes/first', 'reference/notes/second',
];

describe('fixture build', () => {
  it(
    'emits a valid entry for every published dated page, and none for a draft or an undated page',
    () => {
      const build = buildChromeFixture();
      expect(build.status, build.output).toBe(0);
      const files = atomFiles(build.dist);
      // Draft and undated pages exist in this build (drafts are on): the controls.
      expect(existsSync(path.join(build.dist, 'adr', 'template', 'index.html')), 'control: the draft page is built').toBe(true);
      expect(existsSync(path.join(build.dist, 'api', 'pages', 'adr', 'template.json')), 'control: the draft has a JSON record').toBe(true);
      expect(existsSync(path.join(build.dist, 'guides', 'undated', 'index.html')), 'control: the undated page is built').toBe(true);
      expect(files).toEqual(DATED.map((slug) => `${slug}.atom.xml`).sort());
      for (const file of files) {
        expect(entryProblems(readFileSync(path.join(build.dist, 'api', 'pages', file), 'utf8')), file).toEqual([]);
      }
    },
    BUILD_TIMEOUT,
  );

  it(
    'carries the page body, the absolute URL under the base, and the generated page via generated.at',
    () => {
      const build = buildChromeFixture();
      expect(build.status, build.output).toBe(0);
      const read = (slug: string) => readFileSync(path.join(build.dist, 'api', 'pages', `${slug}.atom.xml`), 'utf8');
      const entry = read('guides/getting-started');
      expect(entry).toContain('The table of contents needs at least one heading.');
      expect(entry).toContain('<id>https://spec-kitty.github.io/doc-kitty/guides/getting-started/</id>');
      expect(entry).toContain('<summary>Getting started fixture page.</summary>');
      expect(entry).toContain('<updated>2026-10-31T00:00:00.000Z</updated>');
      expect(read('home')).toContain('<id>https://spec-kitty.github.io/doc-kitty/</id>');
      expect(read('reference/generated-page')).toContain('<updated>');
    },
    BUILD_TIMEOUT,
  );

  it(
    'a build is deterministic: the same input gives the same bytes',
    () => {
      const first = buildChromeFixture();
      expect(first.status, first.output).toBe(0);
      // `makeStamp` keeps `generated.at` from the page already on disk while its
      // content hash is unchanged, and a fresh root has no page on disk, so it would
      // stamp `now`. Seed the second root with the first root's generated glossary
      // pages, as a rebuild in the same root would find them, then compare every entry.
      const files = generatedGlossaryFiles(first.root);
      expect(Object.keys(files).length, 'control: generated glossary pages are seeded').toBeGreaterThan(1);
      const second = buildChromeFixture({ files });
      expect(second.status, second.output).toBe(0);
      expect(second.root).not.toBe(first.root);
      const all = atomFiles(first.dist);
      expect(all.length, 'control: pages are compared').toBeGreaterThan(10);
      expect(all.filter((f) => f.startsWith('glossary')).length, 'control: glossary entries are compared').toBeGreaterThan(0);
      expect(atomFiles(second.dist)).toEqual(all);
      for (const file of all) {
        expect(readFileSync(path.join(second.dist, 'api', 'pages', file)), file).toEqual(readFileSync(path.join(first.dist, 'api', 'pages', file)));
      }
    },
    BUILD_TIMEOUT * 2,
  );

  it(
    'leaves scripts, styles, links and comments out of the content, and keeps the body',
    () => {
      const build = buildChromeFixture();
      expect(build.status, build.output).toBe(0);
      const html = readFileSync(path.join(build.dist, 'guides', 'getting-started', 'index.html'), 'utf8');
      const entry = readFileSync(path.join(build.dist, 'api', 'pages', 'guides', 'getting-started.atom.xml'), 'utf8');
      const sentinel = 'The table of contents needs at least one heading.';
      expect(entry).toContain(sentinel);
      // Control: the built page does carry such markup, so the checks below can fail.
      expect(html).toMatch(/<script\b/);
      expect(html).toMatch(/<link\b/);
      for (const file of atomFiles(build.dist)) {
        const xml = readFileSync(path.join(build.dist, 'api', 'pages', file), 'utf8');
        const content = xml.slice(xml.indexOf('<content'));
        expect(content, file).not.toMatch(/&lt;(script|style|link)\b|&lt;!--/i);
      }
      const glossary = readFileSync(path.join(build.dist, 'api', 'pages', 'glossary', 'fixture.atom.xml'), 'utf8');
      expect(glossary).not.toContain('dk-glossary-definitions');
    },
    BUILD_TIMEOUT,
  );

  it(
    'has no entry for a draft under DK_PUBLISH_DRAFTS=on, while a published page in the same build has one',
    () => {
      const build = buildChromeFixture({ env: { DK_PUBLISH_DRAFTS: 'on' } });
      expect(build.status, build.output).toBe(0);
      expect(existsSync(path.join(build.dist, 'adr', 'template', 'index.html')), 'control: the draft is published as a page').toBe(true);
      const files = atomFiles(build.dist);
      expect(files).not.toContain('adr/template.atom.xml');
      expect(files).toContain('guides/getting-started.atom.xml');
    },
    BUILD_TIMEOUT,
  );

  it(
    'a site can turn the entries off, and the route pattern does not disturb the page JSON',
    () => {
      const off = buildChromeFixture({ options: { pageFormats: { atom: false } } });
      expect(off.status, off.output).toBe(0);
      expect(atomFiles(off.dist)).toEqual([]);
      expect(existsSync(path.join(off.dist, 'api', 'pages', 'guides', 'getting-started.json')), 'control: the JSON route still builds').toBe(true);
      const on = buildChromeFixture();
      expect(existsSync(path.join(on.dist, 'api', 'pages', 'guides', 'getting-started.json'))).toBe(true);
    },
    BUILD_TIMEOUT * 2,
  );

  it(
    'a site with no `site` gets no entries, no Atom link in footer or head, and one warning naming `site`; with `site` both are present',
    () => {
      let build = buildChromeFixture({ options: { site: null } });
      // A cached build keeps no output, and the warning is printed by the build itself.
      if (build.cached) {
        rmSync(build.root, { recursive: true, force: true });
        build = buildChromeFixture({ options: { site: null } });
      }
      expect(build.cached, 'the warning is asserted on a fresh build').toBeFalsy();
      expect(build.status, build.output).toBe(0);
      expect(atomFiles(build.dist)).toEqual([]);
      expect(build.output.match(/No Atom entries: set `site`/g) ?? []).toHaveLength(1);
      const html = readFileSync(path.join(build.dist, 'guides', 'getting-started', 'index.html'), 'utf8');
      expect(html).not.toContain('atom.xml');
      const control = buildChromeFixture();
      expect(control.status, control.output).toBe(0);
      expect(atomFiles(control.dist).length, 'control: entries with site').toBeGreaterThan(10);
      expect(readFileSync(path.join(control.dist, 'guides', 'getting-started', 'index.html'), 'utf8')).toContain('atom.xml');
    },
    BUILD_TIMEOUT * 2,
  );

  it(
    'a page with a character XML 1.0 forbids still gets a well-formed entry (NFR-008)',
    () => {
      const page = (extra: string) =>
        `---\ntitle: "Ctl\\f title"\ndescription: "Desc \\f \\x1b end"\ndoc_status: active\nkind: How-To\nupdated: 2026-10-31\n---\n\n# Ctl\n\nBody before\f${extra} after.\n`;
      const build = buildChromeFixture({ files: { 'docs/guides/ctl.md': page('\x1b') } });
      expect(build.status, build.output).toBe(0);
      const xml = readFileSync(path.join(build.dist, 'api', 'pages', 'guides', 'ctl.atom.xml'), 'utf8');
      expect(xml, 'control: the page is in the entry').toContain('Body before');
      expect(entryProblems(xml)).toEqual([]);
      expect(xml).toContain('<summary>Desc   end</summary>');
    },
    BUILD_TIMEOUT,
  );

  it(
    'an .mdx page gets an entry with a summary and the alternate link, and no <content>',
    () => {
      const mdx = '---\ntitle: Mdx page\ndescription: An MDX fixture page.\ndoc_status: active\nkind: How-To\nupdated: 2026-10-31\n---\n\n# Mdx page\n\nHello from MDX.\n';
      const build = buildChromeFixture({ files: { 'docs/guides/mdx-page.mdx': mdx } });
      expect(build.status, build.output).toBe(0);
      expect(existsSync(path.join(build.dist, 'guides', 'mdx-page', 'index.html')), 'control: the .mdx page is built').toBe(true);
      const xml = readFileSync(path.join(build.dist, 'api', 'pages', 'guides', 'mdx-page.atom.xml'), 'utf8');
      expect(entryProblems(xml)).toEqual([]);
      expect(xml).toContain('<summary>An MDX fixture page.</summary>');
      expect(xml).toContain('rel="alternate"');
      expect(xml).not.toContain('<content');
      // Control: a Markdown page in the same kind of build keeps its content.
      const md = readFileSync(path.join(build.dist, 'api', 'pages', 'guides', 'getting-started.atom.xml'), 'utf8');
      expect(md).toContain('<content type="html">');
    },
    BUILD_TIMEOUT,
  );
});

describe('example build (coverage)', () => {
  const OUT = 'dist-wp08-page-atom-test';
  it(
    'every entry is valid, and the pages left without one are the known undated ones',
    () => {
      const exampleDist = path.join(REPO_ROOT, 'example', OUT);
      rmSync(exampleDist, { recursive: true, force: true });
      const env: NodeJS.ProcessEnv = { ...process.env, DK_OUTDIR: OUT, DK_PUBLISH_DRAFTS: 'off' };
      delete env.BASE_URL;
      clearInternalEnv(env);
      const run = spawnSync('pnpm', ['--filter', 'example', 'build'], { cwd: REPO_ROOT, encoding: 'utf8', env });
      try {
        expect(run.status, `${run.stdout}\n${run.stderr}`.slice(-3000)).toBe(0);
        const files = atomFiles(exampleDist);
        const index = JSON.parse(readFileSync(path.join(exampleDist, 'api', 'index.json'), 'utf8')).pages as Array<{ source: string }>;
        const published = index
          .map((p) => p.source.replace(/^.*\/api\/pages\//, '').replace(/\.json$/, ''))
          .sort();
        expect(published.length, 'control: the index lists pages').toBeGreaterThan(20);
        for (const file of files) {
          expect(entryProblems(readFileSync(path.join(exampleDist, 'api', 'pages', file), 'utf8')), file).toEqual([]);
        }
        expect(files.length, 'control: entries exist').toBeGreaterThan(0);
        // A local image is Astro's `__ASTRO_IMAGE_` placeholder with no `src`: it becomes its alt text.
        const bodies = files.map((f) => readFileSync(path.join(exampleDist, 'api', 'pages', f), 'utf8'));
        expect(bodies.filter((b) => b.includes('__ASTRO_IMAGE_')), 'no entry carries an image placeholder').toEqual([]);
        const showcase = bodies[files.indexOf('guides/markua-showcase.atom.xml')] ?? '';
        expect(showcase, 'the alt text survives').toContain('a palm-lined tropical beach');
        console.info(`example Atom entries: ${files.length}`);
        const undated = published.filter((slug) => !files.includes(`${slug}.atom.xml`));
        // An unintended rise (a page losing its date) goes red here.
        expect(undated).toEqual(EXAMPLE_UNDATED);
        expect(statSync(exampleDist).isDirectory()).toBe(true);
      } finally {
        rmSync(exampleDist, { recursive: true, force: true });
      }
    },
    BUILD_TIMEOUT * 3,
  );
});

/** Published example pages with no `updated` and no `generated.at`, so no entry. */
const EXAMPLE_UNDATED: string[] = [];

describe('stripNonContent: Astro image placeholders', () => {
  const placeholder = (json: string) => `<img __ASTRO_IMAGE_="${json.replace(/"/g, '&#x22;').replace(/</g, '&#x3C;')}">`;
  it('replaces a placeholder with its escaped alt text, and drops one with no alt', () => {
    expect(stripNonContent(`<p>a${placeholder('{"src":"x.svg","alt":"Fish & <chips>","index":0}')}b</p>`)).toBe('<p>aFish &amp; &lt;chips&gt;b</p>');
    expect(stripNonContent(`<p>a${placeholder('{"src":"x.svg","index":0}')}b</p>`)).toBe('<p>ab</p>');
    expect(stripNonContent('<p>a<img __ASTRO_IMAGE_="not json">b</p>')).toBe('<p>ab</p>');
  });
  it('keeps a real <img src>', () => {
    expect(stripNonContent('<img src="/a.png" alt="x">')).toBe('<img src="/a.png" alt="x">');
  });
});

describe('stripNonContent', () => {
  it('removes script, style, link and comments, keeping the rest', () => {
    const html = '<p>keep</p><!-- c <script>x</script> --><script type="a" id="b">{"a":"</p>"}</script><style>p{}</style><link rel="stylesheet" href="/a>b.css"><p>also</p>';
    expect(stripNonContent(html)).toBe('<p>keep</p><p>also</p>');
  });
  it('leaves a custom element whose name starts with one of these', () => {
    const html = '<link-card href="/a">a</link-card><style-guide>b</style-guide><script-box>c</script-box>';
    expect(stripNonContent(html)).toBe(html);
    expect(stripNonContent(`<link rel="x">${html}<style>p{}</style>`), 'control: the real ones still go').toBe(html);
  });
  it('keeps authored copy markup between two real copy controls (no lazy run-on)', () => {
    const real = (code: string) => `<div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="${code}"><div></div></button></div>`;
    const authored = '<div class="copy"><button>first</button><p>TEXT</p></div>';
    const html = `${authored}<p>para</p><h2>Heading</h2><figure>code${real('a')}</figure>`;
    expect(stripNonContent(html)).toBe(`${authored}<p>para</p><h2>Heading</h2><figure>code</figure>`);
    expect(stripNonContent('<div class="copy"><button>Label</button></div>')).toBe('<div class="copy"><button>Label</button></div>');
    expect(stripNonContent('<div class="copy"><button data-code="x">Label</button></div>'), 'data-code alone is not enough').toBe('<div class="copy"><button data-code="x">Label</button></div>');
  });
  it("removes Expressive Code's copy button and its data-code snippet, not the code", () => {
    const code = '<pre data-language="ini"><code><div class="ec-line"><div class="code"><span style="--0:#919F9F">a = &#x3C;b></span></div></div></code></pre>';
    const copy = '<div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="a = <b>></button> x"><div></div></button></div>';
    expect(stripNonContent(`<figure class="frame">${code}${copy}</figure><p>after</p>`)).toBe(`<figure class="frame">${code}</figure><p>after</p>`);
    expect(stripNonContent('<div class="copy">kept: not a copy button</div>'), 'control: another copy div stays').toBe('<div class="copy">kept: not a copy button</div>');
    expect(stripNonContent('<p data-glossary="x" data-glossary-id="y">t</p>'), 'glossary attributes stay').toBe('<p data-glossary="x" data-glossary-id="y">t</p>');
  });
  it('leaves escaped markup shown as text', () => {
    expect(stripNonContent('<pre>&lt;script&gt;x&lt;/script&gt;</pre>')).toBe('<pre>&lt;script&gt;x&lt;/script&gt;</pre>');
  });
});
