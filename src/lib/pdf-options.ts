/**
 * The `pdf` options: their shape, validation, resolution and their one reader
 * (ADR-0081, #382).
 *
 * Two inputs decide which print documents and PDFs a site has: each section's `pdf`
 * key in `sections.yaml` (information architecture) and the site-level `pdf` option of
 * `defineDocKittyIntegrations` (defaults and the whole-site switch). An authored
 * section value wins over the site default. `defineDocKittyIntegrations` resolves them
 * once and publishes the result through `DK_PDF_OPTIONS`; `pdfOptions()` reads it. This
 * module must not import `config.ts`.
 */
import { DK_PDF_OPTIONS_ENV } from './internal-env.mjs';
import type { SectionRegistry } from './sections.js';

/** The page kind no PDF ever holds: slide decks (operator ruling on #377, ADR-0081). */
export const ALWAYS_EXCLUDED_KINDS: readonly string[] = Object.freeze(['Presentation']);

/** The reserved PDF name of the whole-site document (`/pdf/site.pdf`). */
export const SITE_PDF_NAME = 'site';

/** What a site may set. Everything is optional; the defaults are all off. */
export interface PdfOptionsInput {
  /** The default for a section that authors no `pdf.section`. Default `false`. */
  sections?: boolean;
  /** The whole-site PDF at `/pdf/site.pdf`. Default `false`. */
  site?: boolean;
  /** Sections and page kinds to leave out of every print document, on top of the floor. */
  exclude?: { sections?: string[]; kinds?: string[] };
}

/** The resolved settings every consumer reads. Section ids are in registry order. */
export interface ResolvedPdfOptions {
  /** Sections with their own PDF and print route. */
  sections: string[];
  /** The whole-site PDF and its `/print/` route. */
  site: boolean;
  /** Sections placed after the main body of the whole-site document. */
  appendix: string[];
  /** Sections left out of the whole-site document only. */
  omit: string[];
  /** Sections left out of every print document. */
  excludeSections: string[];
  /** Page kinds left out of every print document; always starts with the floor. */
  excludeKinds: string[];
}

const DISABLED: ResolvedPdfOptions = Object.freeze({
  sections: [],
  site: false,
  appendix: [],
  omit: [],
  excludeSections: [],
  excludeKinds: [...ALWAYS_EXCLUDED_KINDS],
}) as ResolvedPdfOptions;

function fail(message: string): never {
  throw new Error(`[dk-config] ${message}`);
}

function assertKeys(value: unknown, key: string, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${key} must be an object with ${keys.join(', ')}`);
  }
  const extra = Object.keys(value).find((name) => !keys.includes(name));
  if (extra !== undefined) fail(`unknown key "${extra}" under ${key}; expected ${keys.join(', ')}`);
}

function assertStringList(value: unknown, key: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item === '')) {
    fail(`${key} must be a list of non-empty strings`);
  }
}

/** Throw a `[dk-config]` error naming the first invalid key, and return the input. */
export function validatePdfOptions(input: unknown): PdfOptionsInput {
  assertKeys(input, 'pdf', ['sections', 'site', 'exclude']);
  for (const key of ['sections', 'site'] as const) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') fail(`pdf.${key} must be a boolean`);
  }
  if (input.exclude !== undefined) {
    assertKeys(input.exclude, 'pdf.exclude', ['sections', 'kinds']);
    assertStringList(input.exclude.sections, 'pdf.exclude.sections');
    assertStringList(input.exclude.kinds, 'pdf.exclude.kinds');
  }
  return input as PdfOptionsInput;
}

/**
 * Resolve the site option against the section registry. An authored `pdf.section`
 * wins over `input.sections`; excluded sections get no print document at all; the
 * `site` name is reserved for the whole-site PDF, so a section with that id cannot
 * have its own. `warn` receives advisory messages (an excluded id that is no section).
 */
export function resolvePdfOptions(
  input: PdfOptionsInput | undefined,
  registry: SectionRegistry | null,
  warn: (message: string) => void = (m) => console.warn(`[dk-config] ${m}`),
): ResolvedPdfOptions {
  if (input === undefined && !registry?.some((entry) => entry.pdf !== undefined)) return { ...DISABLED };
  const entries = registry ?? [];
  const ids = new Set(entries.map((entry) => entry.id));
  const excludeSections = [...new Set(input?.exclude?.sections ?? [])];
  for (const id of excludeSections) {
    if (!ids.has(id)) warn(`pdf.exclude.sections names "${id}", which is not a section in sections.yaml`);
  }
  const excluded = new Set(excludeSections);
  const sectionDefault = input?.sections ?? false;
  const resolved: ResolvedPdfOptions = {
    sections: [],
    site: input?.site ?? false,
    appendix: [],
    omit: [],
    excludeSections,
    excludeKinds: [...new Set([...ALWAYS_EXCLUDED_KINDS, ...(input?.exclude?.kinds ?? [])])],
  };
  for (const entry of entries) {
    if (excluded.has(entry.id)) continue;
    if (entry.pdf?.section ?? sectionDefault) {
      if (entry.id === SITE_PDF_NAME) {
        fail(
          `section "${SITE_PDF_NAME}" cannot have its own PDF: /pdf/${SITE_PDF_NAME}.pdf is reserved for the whole-site PDF (ADR-0081)`,
        );
      }
      resolved.sections.push(entry.id);
    }
    if (entry.pdf?.site === 'appendix') resolved.appendix.push(entry.id);
    if (entry.pdf?.site === 'omit') resolved.omit.push(entry.id);
  }
  return resolved;
}

/** The PDF names a resolved setting produces: each section id, then `site` when on. */
export function pdfDocumentNames(resolved: ResolvedPdfOptions): string[] {
  return resolved.site ? [...resolved.sections, SITE_PDF_NAME] : [...resolved.sections];
}

let cached: { raw: string | undefined; options: ResolvedPdfOptions } | undefined;

/**
 * The settings in force. With the handoff unset, as under Vitest or on a site that
 * never resolved them, every PDF is off.
 */
export function pdfOptions(): ResolvedPdfOptions {
  const raw = process.env[DK_PDF_OPTIONS_ENV];
  if (cached?.raw !== raw || cached === undefined) {
    cached = { raw, options: raw === undefined ? { ...DISABLED } : (JSON.parse(raw) as ResolvedPdfOptions) };
  }
  return cached.options;
}
