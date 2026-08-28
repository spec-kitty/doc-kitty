import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isGlossaryActive, loadGlossary } from '../lib/glossary/load.js';

// Roots created per test; torn down afterEach.
const roots: string[] = [];

/** Make a temp root; if `yaml` is provided, write `.contextive/definitions.yaml`. */
function makeRoot(yaml?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'dk-glossary-'));
  roots.push(root);
  if (yaml !== undefined) {
    mkdirSync(join(root, '.contextive'), { recursive: true });
    writeFileSync(join(root, '.contextive', 'definitions.yaml'), yaml, 'utf8');
  }
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

const VALID_TWO_CONTEXT = `contexts:
  - name: Shipping
    domainVisionStatement: How goods move.
    terms:
      - name: Cargo Booking
        definition: A reservation of cargo space.
        aliases:
          - Booking
        meta:
          spec: https://example.test/booking
      - name: Bill of Lading
        definition: A receipt for shipped goods.
  - name: Billing
    terms:
      - name: Invoice
        definition: A request for payment.
`;

describe('loadGlossary', () => {
  it('parses a valid two-context file into a shared index', () => {
    const result = loadGlossary(makeRoot(VALID_TWO_CONTEXT));
    expect(result.present).toBe(true);
    if (!result.present) throw new Error('expected present');
    const { index } = result;

    // Names key bySurface (lowercased), across both contexts.
    expect([...index.bySurface.keys()].sort()).toEqual(
      ['bill of lading', 'booking', 'cargo booking', 'invoice'].sort(),
    );

    // Per-context lists with deterministic context slug + carried vision statement.
    const shipping = index.contexts.get('Shipping');
    expect(shipping?.slug).toBe('shipping');
    expect(shipping?.terms.map((t) => t.name)).toEqual(['Cargo Booking', 'Bill of Lading']);
    expect(shipping?.domainVisionStatement).toBe('How goods move.');
    // Absent optional stays absent.
    expect(index.contexts.get('Billing')?.domainVisionStatement).toBeUndefined();
  });

  it('keys aliases alongside names, both carrying the stored anchor + contextSlug (FR-012)', () => {
    const result = loadGlossary(makeRoot(VALID_TWO_CONTEXT));
    if (!result.present) throw new Error('expected present');
    const byName = result.index.bySurface.get('cargo booking');
    const byAlias = result.index.bySurface.get('booking');
    const expected = [
      {
        context: 'Shipping',
        contextSlug: 'shipping',
        anchor: 'cargo-booking',
        termName: 'Cargo Booking',
      },
    ];
    expect(byName).toEqual(expected);
    // The alias resolves exactly like the name — same stored anchor (issue #17).
    expect(byAlias).toEqual(expected);
  });

  it('throws build-fatal naming the context/term/field on a missing definition (FR-002)', () => {
    const malformed = `contexts:
  - name: Shipping
    terms:
      - name: Cargo Booking
        aliases:
          - Booking
`;
    const root = makeRoot(malformed);
    expect(() => loadGlossary(root)).toThrow(/context "Shipping".*term "Cargo Booking".*definition/s);
  });

  it('throws build-fatal on a non-allowlisted meta URL scheme (FR-004)', () => {
    const badScheme = `contexts:
  - name: Shipping
    terms:
      - name: Cargo Booking
        definition: A reservation of cargo space.
        meta:
          url: "javascript:alert(1)"
`;
    const root = makeRoot(badScheme);
    expect(() => loadGlossary(root)).toThrow(/context "Shipping".*term "Cargo Booking".*meta\.url/s);
  });

  it('returns { present: false } with no throw when the file is absent (FR-001)', () => {
    const root = makeRoot(); // no definitions file written
    expect(loadGlossary(root)).toEqual({ present: false });
  });
});

// ---------------------------------------------------------------------------
// issue #17 — per-context anchor de-collision + build-fatal empty/duplicate guards
// ---------------------------------------------------------------------------
describe('buildIndex de-collision + build-fatal guards (issue #17)', () => {
  const C_FAMILY = `contexts:
  - name: Langs
    terms:
      - name: C
        definition: A systems language.
      - name: C++
        definition: C with classes.
      - name: C#
        definition: A .NET language.
`;

  it('de-collides colliding anchors in source order: c, c-2, c-3', () => {
    const result = loadGlossary(makeRoot(C_FAMILY));
    if (!result.present) throw new Error('expected present');
    const langs = result.index.contexts.get('Langs');
    // Stored, de-collided anchor per term name.
    expect(langs?.anchors.get('C')).toBe('c');
    expect(langs?.anchors.get('C++')).toBe('c-2');
    expect(langs?.anchors.get('C#')).toBe('c-3');
    // The same de-collided anchors propagate onto the bySurface entries.
    expect(result.index.bySurface.get('c')?.[0].anchor).toBe('c');
    expect(result.index.bySurface.get('c++')?.[0].anchor).toBe('c-2');
    expect(result.index.bySurface.get('c#')?.[0].anchor).toBe('c-3');
  });

  it('is deterministic: two builds of the same input store identical anchors', () => {
    const a = loadGlossary(makeRoot(C_FAMILY));
    const b = loadGlossary(makeRoot(C_FAMILY));
    if (!a.present || !b.present) throw new Error('expected present');
    const anchorsOf = (r: typeof a) =>
      r.present ? [...(r.index.contexts.get('Langs')?.anchors.entries() ?? [])] : [];
    expect(anchorsOf(a)).toEqual([
      ['C', 'c'],
      ['C++', 'c-2'],
      ['C#', 'c-3'],
    ]);
    expect(anchorsOf(a)).toEqual(anchorsOf(b));
  });

  it('guards re-collision: a term literally slugging to a taken suffix skips ahead', () => {
    // Source order: `C 2` claims `c-2` first; then C, then C++ (both slug base `c`).
    const yaml = `contexts:
  - name: Langs
    terms:
      - name: C 2
        definition: Claims c-2 literally.
      - name: C
        definition: Base c.
      - name: C++
        definition: Would want c-2, but it is taken.
`;
    const result = loadGlossary(makeRoot(yaml));
    if (!result.present) throw new Error('expected present');
    const langs = result.index.contexts.get('Langs');
    expect(langs?.anchors.get('C 2')).toBe('c-2');
    expect(langs?.anchors.get('C')).toBe('c');
    expect(langs?.anchors.get('C++')).toBe('c-3'); // NOT c-2 — that was taken
  });

  it('de-collides distinct context names that slug to the same page slug', () => {
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
    const result = loadGlossary(makeRoot(yaml));
    if (!result.present) throw new Error('expected present');
    expect(result.index.contexts.get('Ops')?.slug).toBe('ops');
    expect(result.index.contexts.get('Ops!')?.slug).toBe('ops-2');
  });

  it('is build-fatal when a term name produces an empty anchor (all non-Latin)', () => {
    const yaml = `contexts:
  - name: Shipping
    terms:
      - name: 製品
        definition: A product, named only in CJK.
`;
    expect(() => loadGlossary(makeRoot(yaml))).toThrow(/term .* empty anchor/s);
  });

  it('is build-fatal when a context name produces an empty page slug (all non-Latin)', () => {
    const yaml = `contexts:
  - name: 製品
    terms:
      - name: Widget
        definition: A widget.
`;
    expect(() => loadGlossary(makeRoot(yaml))).toThrow(/context .* empty page slug/s);
  });

  it('is build-fatal on two byte-identical term names in one context (C-3)', () => {
    const yaml = `contexts:
  - name: Shipping
    terms:
      - name: Cargo
        definition: First.
      - name: Cargo
        definition: Duplicate name.
`;
    expect(() => loadGlossary(makeRoot(yaml))).toThrow(
      /context "Shipping".*term "Cargo".*duplicate term name/s,
    );
  });
});

describe('isGlossaryActive', () => {
  it('is true when the definitions file exists', () => {
    expect(isGlossaryActive(makeRoot(VALID_TWO_CONTEXT))).toBe(true);
  });

  it('is false when the definitions file is absent', () => {
    expect(isGlossaryActive(makeRoot())).toBe(false);
  });
});
