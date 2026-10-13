import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildIndex, parseAndValidate, parseDefinitionsYaml } from '../lib/glossary/load.internal.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';
import { slug } from '../lib/glossary/anchor.js';
import { generateGlossaryPages } from '../lib/glossary/generate.js';
import { resolveIndexEntries } from '../lib/vocabulary-core.mjs';

// The example site's setting: lists `index`, so the pre-existing pins keep expecting
// `index.md` and double as the byte-identical proof for such sites (FR-009).
const SITE_INDEX_NAMES = ['README', 'index'];

// Temp out-dirs created per test; torn down afterEach.
const dirs: string[] = [];

function makeOutDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dk-glossary-gen-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

/** Build a SharedTermIndex straight from YAML — no file I/O for the index itself. */
function indexFrom(yaml: string): SharedTermIndex {
  return buildIndex(parseAndValidate(parseDefinitionsYaml(yaml)));
}

/** Recursively list files under `dir`, relativized + sorted, for stable comparison. */
function listRelative(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(dir, full));
    }
  };
  walk(dir);
  return out.sort();
}

const VALID_TWO_CONTEXT = `contexts:
  - name: Shipping
    domainVisionStatement: How **goods** move across the network.
    terms:
      - name: Cargo Booking
        definition: A reservation of cargo space with a *carrier*.
        aliases:
          - Booking
        examples:
          - Book 2 TEU on the Rotterdam sailing.
        meta:
          spec: https://example.test/booking
      - name: Bill of Lading
        definition: A receipt for shipped goods.
  - name: Billing
    terms:
      - name: Invoice
        definition: A request for payment.
`;

describe('generateGlossaryPages', () => {
  it('writes a hub + one page per context under glossary/, returns their paths', () => {
    const out = makeOutDir();
    const written = generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, SITE_INDEX_NAMES);

    expect(written.map((p) => relative(out, p))).toEqual([
      join('glossary', 'index.md'),
      // Name-sorted: Billing before Shipping.
      join('glossary', 'billing', 'index.md'),
      join('glossary', 'shipping', 'index.md'),
    ]);
    expect(listRelative(out)).toEqual(written.map((p) => relative(out, p)).sort());
  });

  it('is deterministic: same index → byte-identical files + identical relative paths (NFR-004)', () => {
    const a = makeOutDir();
    const b = makeOutDir();
    const writtenA = generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), a, SITE_INDEX_NAMES);
    const writtenB = generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), b, SITE_INDEX_NAMES);

    expect(writtenA.map((p) => relative(a, p))).toEqual(writtenB.map((p) => relative(b, p)));
    for (const rel of listRelative(a)) {
      expect(readFileSync(join(a, rel), 'utf8')).toBe(readFileSync(join(b, rel), 'utf8'));
    }
  });

  it('presence-gates an empty index: writes nothing, returns [] (INV-G4)', () => {
    const out = makeOutDir();
    const empty = buildIndex([]); // no contexts
    expect(generateGlossaryPages(empty, out, SITE_INDEX_NAMES)).toEqual([]);
    expect(listRelative(out)).toEqual([]);
  });

  it('a generated context page self-declares its glossary_context', () => {
    const out = makeOutDir();
    generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, SITE_INDEX_NAMES);
    const page = readFileSync(join(out, 'glossary', 'shipping', 'index.md'), 'utf8');
    expect(page).toContain('glossary_context: "Shipping"');
    expect(page).toContain('kind: Glossary');
  });

  it('emits each term at a deterministic slug(name) anchor, in the BLOCK-form attribute (#63)', () => {
    const out = makeOutDir();
    generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, SITE_INDEX_NAMES);
    const page = readFileSync(join(out, 'glossary', 'shipping', 'index.md'), 'utf8');
    // Block form: a lone `{#anchor}` attribute-list paragraph immediately above
    // the heading (markua-attributes.ts §Block form) — NOT the inline
    // `## name {#anchor}` form, which this toolkit's attribute-list plugin never
    // consumes (#63, D3: the inline form doubles the slugger's id and renders the
    // literal `{#…}` as text).
    expect(page).toContain(`{#${slug('Cargo Booking')}}\n\n## Cargo Booking`);
    expect(page).toContain(`{#${slug('Bill of Lading')}}\n\n## Bill of Lading`);
    // Never the inline form.
    expect(page).not.toContain(`## Cargo Booking {#${slug('Cargo Booking')}}`);
    expect(page).not.toContain(`## Bill of Lading {#${slug('Bill of Lading')}}`);
  });

  it('renders the definition as Markdown body (not HTML-escaped to text)', () => {
    const out = makeOutDir();
    generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, SITE_INDEX_NAMES);
    const page = readFileSync(join(out, 'glossary', 'shipping', 'index.md'), 'utf8');
    // The markdown emphasis survives verbatim into the body.
    expect(page).toContain('A reservation of cargo space with a *carrier*.');
    // Aliases, examples, and meta (as a Markdown link) are rendered too.
    expect(page).toContain('**Aliases:** Booking');
    expect(page).toContain('- Book 2 TEU on the Rotterdam sailing.');
    expect(page).toContain('[https://example.test/booking](https://example.test/booking)');
  });

  it("renders the context's domainVisionStatement Markdown when present", () => {
    const out = makeOutDir();
    generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, SITE_INDEX_NAMES);
    const shipping = readFileSync(join(out, 'glossary', 'shipping', 'index.md'), 'utf8');
    expect(shipping).toContain('How **goods** move across the network.');
    // Billing has none → no stray vision block, just the heading then terms.
    const billing = readFileSync(join(out, 'glossary', 'billing', 'index.md'), 'utf8');
    expect(billing).toContain('# Billing');
    expect(billing).toContain('## Invoice');
  });

  it('the hub lists every context with a link to its page', () => {
    const out = makeOutDir();
    generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, SITE_INDEX_NAMES);
    const hub = readFileSync(join(out, 'glossary', 'index.md'), 'utf8');
    expect(hub).toContain('kind: Hub');
    expect(hub).toContain('[Shipping](./shipping/)');
    expect(hub).toContain('[Billing](./billing/)');
  });

  it('anchors colliding term names with the stored de-collided anchor (issue #17)', () => {
    const out = makeOutDir();
    const yaml = `contexts:
  - name: Langs
    terms:
      - name: C
        definition: A systems language.
      - name: C++
        definition: C with classes.
      - name: C#
        definition: A .NET language.
`;
    generateGlossaryPages(indexFrom(yaml), out, SITE_INDEX_NAMES);
    const page = readFileSync(join(out, 'glossary', 'langs', 'index.md'), 'utf8');
    expect(page).toContain('{#c}\n\n## C');
    expect(page).toContain('{#c-2}\n\n## C++');
    expect(page).toContain('{#c-3}\n\n## C#');
  });

  it('two distinct context names sharing a base slug write two distinct dirs (issue #17 #4)', () => {
    const out = makeOutDir();
    const yaml = `contexts:
  - name: Ops
    terms:
      - name: Alpha
        definition: a
  - name: Ops!
    terms:
      - name: Beta
        definition: b
`;
    const written = generateGlossaryPages(indexFrom(yaml), out, SITE_INDEX_NAMES);
    const rel = written.map((p) => relative(out, p));
    // Hub + two DISTINCT context pages — no collision, no overwrite.
    expect(rel).toContain(join('glossary', 'ops', 'index.md'));
    expect(rel).toContain(join('glossary', 'ops-2', 'index.md'));
    // No context page collides with the hub, and every path is unique on disk.
    expect(rel).not.toContain(join('glossary', 'index.md', 'index.md'));
    expect(new Set(rel).size).toBe(rel.length);
    expect(listRelative(out)).toEqual([...rel].sort());
  });
  // US2 / FR-006: the generated files must be a section index UNDER THE SITE'S OWN
  // index-name setting, else the hub routes at /glossary/index/ and every term link 404s.
  it.each([
    [undefined, 'README.md'],
    ['index', 'index.md'],
    [['home'], 'home.md'],
    [['README', 'index'], 'index.md'],
    [['index', 'README'], 'index.md'],
  ])('writes section-index file names the site routes as glossary + glossary/<slug> (%j)', (setting, fileName) => {
    const out = makeOutDir();
    const written = generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, setting);
    const rel = written.map((p) => relative(out, p).split('\\').join('/'));
    expect(rel.map((p) => p.split('/').pop())).toEqual([fileName, fileName, fileName]);
    const { ids } = resolveIndexEntries(rel, { indexBasename: setting });
    expect([...ids.values()].sort()).toEqual(['glossary', 'glossary/billing', 'glossary/shipping']);
  });

  describe('authored files and stale pages (FR-007, FR-008)', () => {
    const FOREIGN = '---\ntitle: "Mine"\n---\n\nHand written.\n';
    const seed = (out: string, rel: string, body: string) => {
      const file = join(out, ...rel.split('/'));
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(file, body, 'utf8');
      return file;
    };

    it('stops on an authored file at a target path and leaves the tree untouched', () => {
      const out = makeOutDir();
      seed(out, 'glossary/shipping/README.md', FOREIGN);
      const before = listRelative(out).map((r) => [r, readFileSync(join(out, r), 'utf8')]);
      expect(() => generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, undefined)).toThrow(
        /glossary[\\/]shipping[\\/]README\.md.*glossary generator writes this path.*move or remove/s,
      );
      expect(listRelative(out).map((r) => [r, readFileSync(join(out, r), 'utf8')])).toEqual(before);
    });

    it.each([['../x'], ['sub/x'], ['a\\b'], ['..'], ['.hidden']])(
      'rejects index name %j before any write or removal (authored pages outside glossary/ survive)',
      (bad) => {
        const out = makeOutDir();
        const rootHub = '---\ntitle: "Home"\ndescription: "x"\nkind: Hub\ndoc_status: active\n---\n\nAuthored.\n';
        seed(out, 'index.md', rootHub);
        seed(out, 'glossary/index.md', rootHub);
        const snap = () => listRelative(out).map((r) => [r, readFileSync(join(out, r), 'utf8')]);
        const before = snap();
        // The bad name is NOT the chosen (first) one: the whole list must be validated.
        for (const setting of [bad, ['README', bad]]) {
          expect(() => generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, setting)).toThrow(
            /indexBasename must be a plain file name.*one path segment/s,
          );
          expect(snap()).toEqual(before);
        }
      },
    );

    it('stops on a symlink at a target path (generated-looking file or dangling) and writes through neither', () => {
      const looksGenerated =
        '---\ntitle: "Glossary"\ndescription: "x"\nkind: Hub\ndoc_status: active\n---\n\nOutside.\n';
      for (const linked of [true, false]) {
        const out = makeOutDir();
        const outside = join(makeOutDir(), 'elsewhere.md');
        if (linked) writeFileSync(outside, looksGenerated, 'utf8');
        mkdirSync(join(out, 'glossary'), { recursive: true });
        try {
          symlinkSync(outside, join(out, 'glossary', 'README.md'));
        } catch {
          return; // symlinks cannot be created in this environment
        }
        expect(() => generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, undefined)).toThrow(
          /glossary[\\/]README\.md.*glossary generator writes this path/s,
        );
        if (linked) expect(readFileSync(outside, 'utf8')).toBe(looksGenerated);
        else expect(existsSync(outside)).toBe(false);
        expect(lstatSync(join(out, 'glossary', 'README.md')).isSymbolicLink()).toBe(true);
        expect(existsSync(join(out, 'glossary', 'shipping'))).toBe(false);
      }
    });

    it.each([['glossary'], ['glossary/shipping']])(
      'stops when %s is a symlink to a folder outside the docs tree, which stays unchanged',
      (linked) => {
        const out = makeOutDir();
        const outside = makeOutDir();
        const stale =
          '---\ntitle: "Shipping"\ndescription: "x"\nkind: Glossary\ndoc_status: active\nglossary_context: "shipping"\n---\n\nOutside.\n';
        writeFileSync(join(outside, 'index.md'), stale, 'utf8');
        if (linked === 'glossary/shipping') mkdirSync(join(out, 'glossary'));
        try {
          symlinkSync(outside, join(out, ...linked.split('/')), 'dir');
        } catch {
          return; // symlinks cannot be created in this environment
        }
        expect(() => generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, undefined)).toThrow(
          /is a symbolic link.*real folder inside the docs tree/s,
        );
        expect(listRelative(outside)).toEqual(['index.md']);
        expect(readFileSync(join(outside, 'index.md'), 'utf8')).toBe(stale);
      },
    );

    it('removes stale generated index.md pages after a run under another index name', () => {
      const out = makeOutDir();
      generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, 'index');
      generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, undefined);
      expect(listRelative(out).map((r) => r.split('\\').join('/'))).toEqual([
        'glossary/README.md',
        'glossary/billing/README.md',
        'glossary/shipping/README.md',
      ]);
    });

    it('keeps a hand-written page with exactly the generator keys when it differs from the current output, and warns', () => {
      const out = makeOutDir();
      // On a site that lists both names the natural way to override the hub is a
      // README.md with the hub's own four keys: it must survive, not be pruned.
      const handWritten =
        '---\ntitle: "Glossary"\ndescription: "Our own words."\nkind: Hub\ndoc_status: active\n---\n\nWritten by hand.\n';
      const hub = seed(out, 'glossary/README.md', handWritten); // the generator writes index.md here
      const warnings: string[] = [];
      generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, ['README', 'index'], (m) => warnings.push(m));
      expect(readFileSync(hub, 'utf8')).toBe(handWritten);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/keeping .*glossary[\\/]README\.md.*content differs/is);
      expect(existsSync(join(out, 'glossary', 'index.md'))).toBe(true);
    });

    it('keeps a hub-like page with an extra field (with a warning) and any other kind', () => {
      const out = makeOutDir();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const lookalike =
          '---\ntitle: "Glossary"\ndescription: "x"\nkind: Hub\ndoc_status: active\nowner: me\n---\n\nMine.\n';
        const hub = seed(out, 'glossary/index.md', lookalike);
        const other = seed(
          out,
          'glossary/shipping/index.md',
          '---\ntitle: "Notes"\nkind: Guide\n---\n\nAuthored.\n',
        );
        generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out, undefined);
        expect(readFileSync(hub, 'utf8')).toBe(lookalike);
        expect(readFileSync(other, 'utf8')).toContain('Authored.');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toMatch(/keeping .*glossary[\\/]index\.md.*different frontmatter/is);
        expect(existsSync(join(out, 'glossary', 'README.md'))).toBe(true);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
