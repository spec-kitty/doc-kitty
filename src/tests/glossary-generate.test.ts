import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildIndex, parseAndValidate, parseDefinitionsYaml } from '../lib/glossary/load.internal.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';
import { slug } from '../lib/glossary/anchor.js';
import { generateGlossaryPages } from '../lib/glossary/generate.js';

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
    const written = generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out);

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
    const writtenA = generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), a);
    const writtenB = generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), b);

    expect(writtenA.map((p) => relative(a, p))).toEqual(writtenB.map((p) => relative(b, p)));
    for (const rel of listRelative(a)) {
      expect(readFileSync(join(a, rel), 'utf8')).toBe(readFileSync(join(b, rel), 'utf8'));
    }
  });

  it('presence-gates an empty index: writes nothing, returns [] (INV-G4)', () => {
    const out = makeOutDir();
    const empty = buildIndex([]); // no contexts
    expect(generateGlossaryPages(empty, out)).toEqual([]);
    expect(listRelative(out)).toEqual([]);
  });

  it('a generated context page self-declares its glossary_context', () => {
    const out = makeOutDir();
    generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out);
    const page = readFileSync(join(out, 'glossary', 'shipping', 'index.md'), 'utf8');
    expect(page).toContain('glossary_context: "Shipping"');
    expect(page).toContain('kind: Glossary');
  });

  it('emits each term at a deterministic slug(name) anchor', () => {
    const out = makeOutDir();
    generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out);
    const page = readFileSync(join(out, 'glossary', 'shipping', 'index.md'), 'utf8');
    expect(page).toContain(`## Cargo Booking {#${slug('Cargo Booking')}}`);
    expect(page).toContain(`## Bill of Lading {#${slug('Bill of Lading')}}`);
  });

  it('renders the definition as Markdown body (not HTML-escaped to text)', () => {
    const out = makeOutDir();
    generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out);
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
    generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out);
    const shipping = readFileSync(join(out, 'glossary', 'shipping', 'index.md'), 'utf8');
    expect(shipping).toContain('How **goods** move across the network.');
    // Billing has none → no stray vision block, just the heading then terms.
    const billing = readFileSync(join(out, 'glossary', 'billing', 'index.md'), 'utf8');
    expect(billing).toContain('# Billing');
    expect(billing).toContain('## Invoice');
  });

  it('the hub lists every context with a link to its page', () => {
    const out = makeOutDir();
    generateGlossaryPages(indexFrom(VALID_TWO_CONTEXT), out);
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
    generateGlossaryPages(indexFrom(yaml), out);
    const page = readFileSync(join(out, 'glossary', 'langs', 'index.md'), 'utf8');
    expect(page).toContain('## C {#c}');
    expect(page).toContain('## C++ {#c-2}');
    expect(page).toContain('## C# {#c-3}');
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
    const written = generateGlossaryPages(indexFrom(yaml), out);
    const rel = written.map((p) => relative(out, p));
    // Hub + two DISTINCT context pages — no collision, no overwrite.
    expect(rel).toContain(join('glossary', 'ops', 'index.md'));
    expect(rel).toContain(join('glossary', 'ops-2', 'index.md'));
    // No context page collides with the hub, and every path is unique on disk.
    expect(rel).not.toContain(join('glossary', 'index.md', 'index.md'));
    expect(new Set(rel).size).toBe(rel.length);
    expect(listRelative(out)).toEqual([...rel].sort());
  });
});
