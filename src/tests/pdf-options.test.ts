/**
 * The `pdf` option (ADR-0081, #382): validation, resolution order (an authored section
 * value wins), the exclusion floor, the reserved `site` name and the env reader.
 */
import { afterEach, describe, it, expect } from 'vitest';
import {
  ALWAYS_EXCLUDED_KINDS,
  pdfDocumentNames,
  pdfOptions,
  resolvePdfOptions,
  validatePdfOptions,
} from '../lib/pdf-options.js';
import { DK_PDF_OPTIONS_ENV } from '../lib/internal-env.mjs';
import type { SectionRegistry } from '../lib/sections.js';

const registry: SectionRegistry = [
  { id: 'context', label: 'Context', order: 10 },
  { id: 'architecture', label: 'Architecture', order: 20, pdf: { section: true } },
  { id: 'adr', label: 'ADRs', order: 30, pdf: { section: false } },
  { id: 'guides', label: 'Guides', order: 40 },
  { id: 'rhetoric', label: 'Rhetoric', order: 50, pdf: { site: 'appendix' } },
  { id: 'changelog', label: 'Changelog', order: 60, pdf: { site: 'omit' } },
];

describe('validatePdfOptions', () => {
  it('accepts the documented shape', () => {
    const input = { sections: true, site: true, exclude: { sections: ['adr'], kinds: ['Persona'] } };
    expect(validatePdfOptions(input)).toBe(input);
    expect(validatePdfOptions({})).toEqual({});
  });

  it.each([
    [[], '[dk-config] pdf must be an object'],
    [{ paper: 'A4' }, '[dk-config] unknown key "paper" under pdf'],
    [{ site: 'yes' }, '[dk-config] pdf.site must be a boolean'],
    [{ sections: 1 }, '[dk-config] pdf.sections must be a boolean'],
    [{ exclude: { kinds: 'Presentation' } }, '[dk-config] pdf.exclude.kinds must be a list'],
    [{ exclude: { sections: [''] } }, '[dk-config] pdf.exclude.sections must be a list'],
    [{ exclude: { pages: [] } }, '[dk-config] unknown key "pages" under pdf.exclude'],
  ])('rejects %j', (input, message) => {
    expect(() => validatePdfOptions(input)).toThrow(message);
  });
});

describe('resolvePdfOptions', () => {
  it('is all off with no option and no authored key', () => {
    const plain: SectionRegistry = [{ id: 'context', label: 'Context', order: 10 }];
    const resolved = resolvePdfOptions(undefined, plain);
    expect(resolved).toEqual({
      sections: [],
      site: false,
      appendix: [],
      omit: [],
      excludeSections: [],
      excludeKinds: ['Presentation'],
    });
    expect(pdfDocumentNames(resolved)).toEqual([]);
  });

  it('turns authored sections on without any site option', () => {
    expect(resolvePdfOptions(undefined, registry).sections).toEqual(['architecture']);
  });

  it('applies the site default only where a section authors nothing', () => {
    const resolved = resolvePdfOptions({ sections: true }, registry);
    // `adr` authored false and keeps it; the rest follow the default, in registry order.
    expect(resolved.sections).toEqual(['context', 'architecture', 'guides', 'rhetoric', 'changelog']);
  });

  it('places appendix and omitted sections for the whole-site PDF', () => {
    const resolved = resolvePdfOptions({ site: true }, registry);
    expect(resolved.appendix).toEqual(['rhetoric']);
    expect(resolved.omit).toEqual(['changelog']);
    expect(pdfDocumentNames(resolved)).toEqual(['architecture', 'site']);
  });

  it('keeps the deck floor and only adds to it', () => {
    const resolved = resolvePdfOptions({ exclude: { kinds: ['Persona', 'Presentation'] } }, registry);
    expect(resolved.excludeKinds).toEqual(['Presentation', 'Persona']);
    expect(ALWAYS_EXCLUDED_KINDS).toEqual(['Presentation']);
  });

  it('gives an excluded section no print document, and warns about an unknown id', () => {
    const warnings: string[] = [];
    const resolved = resolvePdfOptions({ exclude: { sections: ['architecture', 'nope'] } }, registry, (m) => warnings.push(m));
    expect(resolved.sections).toEqual([]);
    expect(resolved.excludeSections).toEqual(['architecture', 'nope']);
    expect(warnings).toEqual(['pdf.exclude.sections names "nope", which is not a section in sections.yaml']);
  });

  it('reserves the name site for the whole-site PDF', () => {
    const clash: SectionRegistry = [{ id: 'site', label: 'Site', order: 10, pdf: { section: true } }];
    expect(() => resolvePdfOptions(undefined, clash)).toThrow(/\/pdf\/site\.pdf is reserved/);
    // Without its own PDF the section is fine.
    expect(resolvePdfOptions({ site: true }, [{ id: 'site', label: 'Site', order: 10 }]).sections).toEqual([]);
  });
});

describe('pdfOptions()', () => {
  afterEach(() => {
    delete process.env[DK_PDF_OPTIONS_ENV];
  });

  it('is all off when nothing was published', () => {
    delete process.env[DK_PDF_OPTIONS_ENV];
    expect(pdfOptions().sections).toEqual([]);
    expect(pdfOptions().site).toBe(false);
  });

  it('reads what defineDocKittyIntegrations published', () => {
    const resolved = resolvePdfOptions({ site: true }, registry);
    process.env[DK_PDF_OPTIONS_ENV] = JSON.stringify(resolved);
    expect(pdfOptions()).toEqual(resolved);
  });
});
