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

  it('keys aliases alongside names, both pointing at the term anchor (FR-012)', () => {
    const result = loadGlossary(makeRoot(VALID_TWO_CONTEXT));
    if (!result.present) throw new Error('expected present');
    const byName = result.index.bySurface.get('cargo booking');
    const byAlias = result.index.bySurface.get('booking');
    const expected = [{ context: 'Shipping', anchor: 'cargo-booking', termName: 'Cargo Booking' }];
    expect(byName).toEqual(expected);
    // The alias resolves exactly like the name — same anchor (slug of the name).
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

describe('isGlossaryActive', () => {
  it('is true when the definitions file exists', () => {
    expect(isGlossaryActive(makeRoot(VALID_TWO_CONTEXT))).toBe(true);
  });

  it('is false when the definitions file is absent', () => {
    expect(isGlossaryActive(makeRoot())).toBe(false);
  });
});
