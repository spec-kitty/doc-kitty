import { describe, it, expect } from 'vitest';
import { slug } from '../lib/glossary/anchor.js';

describe('slug', () => {
  it('lowercases and hyphenates a multi-word name', () => {
    expect(slug('Cargo Booking')).toBe('cargo-booking');
  });

  it('collapses runs of punctuation/whitespace to a single hyphen', () => {
    expect(slug('Bill  of   Lading')).toBe('bill-of-lading');
    expect(slug('C&F / CIF (Incoterms)')).toBe('c-f-cif-incoterms');
  });

  it('strips leading and trailing separators', () => {
    expect(slug('  ...Freight!!!  ')).toBe('freight');
    expect(slug('-leading-and-trailing-')).toBe('leading-and-trailing');
  });

  it('collapses non-ascii characters like any other separator', () => {
    expect(slug('Café Con Leche')).toBe('caf-con-leche');
  });

  it('is deterministic — same input yields the same anchor', () => {
    expect(slug('Cargo Booking')).toBe(slug('Cargo Booking'));
  });

  it('is idempotent — slug(slug(x)) === slug(x)', () => {
    for (const input of ['Cargo Booking', 'C&F / CIF (Incoterms)', '  ...Freight!!!  ', 'Café']) {
      expect(slug(slug(input))).toBe(slug(input));
    }
  });

  it('reduces an all-separator name to the empty string', () => {
    expect(slug('!!! ---')).toBe('');
  });
});
