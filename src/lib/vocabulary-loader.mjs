/**
 * Filesystem loader layer over {@link module:vocabulary-core} (#49 IC-01).
 *
 * The thin fs half of the two-layer vocabulary core: it reads
 * `<docsRoot>/_meta/vocabulary.yaml` and `<docsRoot>/_meta/sections.yaml` off
 * disk and hands the raw text to the PURE parsers in `./vocabulary-core.mjs`. It
 * MAY use `node:fs`; therefore `metadata.ts` (which must stay fs-free and must
 * never import `sections.ts`) must NOT import this module — it consumes the pure
 * core directly. This layer is safe for `sections.ts` and the bare-Node
 * `validate-frontmatter.mjs` gate (WP02 rewires both onto it), and it loads
 * under plain `node` with no Astro build context (C-001).
 *
 * Extracted behavior-preserving (DISCIPLINED_REFACTORING) from the fs halves of
 * `sections.ts` — `loadVocabulary` (`:410-415`), `loadSectionRegistry`
 * (`:191-202`) + `parseSectionRegistry` (`:99-181`), `sectionTypes`
 * (`:228-234`), `sectionSubtypes` (`:243-251`) — and their bare-Node twins in
 * `validate-frontmatter.mjs` (`loadVocabulary` `:427-432`, `loadSectionTypes`
 * `:263-282`, `loadSectionSubtypes` `:290-311`). No new dependency: the same
 * `gray-matter` wrap-in-fences trick the toolkit already uses.
 *
 * @module vocabulary-loader
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import { identityVocabulary, parseVocabulary } from './vocabulary-core.mjs';

/**
 * @typedef {import('./vocabulary-core.mjs').VocabularyResolver} VocabularyResolver
 * @typedef {import('./vocabulary-core.mjs').SectionSubtypeRule} SectionSubtypeRule
 */

/** The vocabulary file, relative to a docs root (`<docsRoot>/_meta/vocabulary.yaml`). */
export const VOCABULARY_REGISTRY_RELPATH = path.join('_meta', 'vocabulary.yaml');

/** The section-registry file, relative to a docs root (`<docsRoot>/_meta/sections.yaml`). */
export const SECTIONS_REGISTRY_RELPATH = path.join('_meta', 'sections.yaml');

/**
 * One authored section entry from `sections.yaml` (the subset consumed here).
 *
 * @typedef {object} SectionRegistryEntry
 * @property {string} id Section slug — maps 1:1 to a top-level folder.
 * @property {string} label Display name.
 * @property {number} order Integer sort key; lower first.
 * @property {string} [type] The section-default frontmatter `type` (issue #24).
 * @property {SectionSubtypeRule[]} [subtypes] Sub-path → `type` rules (E-02/FR-005).
 */

/** The resolved registry: entries sorted by `order`, tie-broken by `id`. */
/** @typedef {SectionRegistryEntry[]} SectionRegistry */

/**
 * Load and parse `<docsRoot>/_meta/vocabulary.yaml` into a
 * {@link VocabularyResolver}.
 *
 * A MISSING file is graceful: returns the {@link identityVocabulary} resolver so
 * the shipped default applies unchanged and `Feature` stays valid (NFR-002). A
 * present-but-malformed file THROWS (it is authored, and a silent skip would hide
 * the mistake).
 *
 * @param {string} docsRoot
 * @returns {VocabularyResolver}
 */
export function loadVocabulary(docsRoot) {
  const file = path.join(docsRoot, VOCABULARY_REGISTRY_RELPATH);
  if (!existsSync(file)) return identityVocabulary();
  const raw = readFileSync(file, 'utf8');
  return parseVocabulary(raw, path.relative(process.cwd(), file));
}

/**
 * Read `<docsRoot>/_meta/sections.yaml` and return the parsed, order-sorted
 * registry, or `null` when no registry file is present (graceful fallback — a
 * registry-less tree still derives expectations from the frozen defaults). Uses
 * the same gray-matter wrap-in-fences trick as the toolkit / `validate-catalog`.
 *
 * Only well-formed entries (a string `id`, `label`, and numeric `order`) are
 * kept; `type` and `subtypes` are carried through when present. Sorted by
 * `order` ascending, ties broken by `id`.
 *
 * @param {string} docsRoot
 * @returns {SectionRegistry | null}
 */
export function loadSectionRegistry(docsRoot) {
  const file = path.join(docsRoot, SECTIONS_REGISTRY_RELPATH);
  if (!existsSync(file)) return null;
  const raw = readFileSync(file, 'utf8');
  const data = /** @type {{ sections?: unknown } | null} */ (
    matter(['---', raw, '---', ''].join('\n')).data
  );
  const rawSections = data && typeof data === 'object' ? data.sections : undefined;
  if (!Array.isArray(rawSections)) return null;

  /** @type {SectionRegistry} */
  const entries = [];
  for (const rec of rawSections) {
    if (rec == null || typeof rec !== 'object') continue;
    const { id, label, order, type, subtypes } = /** @type {Record<string, unknown>} */ (rec);
    if (typeof id !== 'string' || id === '') continue;
    if (typeof label !== 'string' || label === '') continue;
    if (typeof order !== 'number' || !Number.isFinite(order)) continue;
    /** @type {SectionRegistryEntry} */
    const entry = { id, label, order };
    if (typeof type === 'string') entry.type = type;
    if (Array.isArray(subtypes)) {
      entry.subtypes = subtypes.filter(
        /** @returns {r is SectionSubtypeRule} */
        (r) =>
          r != null &&
          typeof r === 'object' &&
          typeof (/** @type {Record<string, unknown>} */ (r).match) === 'string' &&
          typeof (/** @type {Record<string, unknown>} */ (r).type) === 'string',
      );
    }
    entries.push(entry);
  }

  entries.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return entries;
}

/**
 * The `id → type` map — the section-default `type` authority (issue #24). Only
 * entries that declare a string `type` appear; pass the result as the
 * `typesBySection` argument of `expectedDocType` (`./vocabulary-core.mjs`).
 *
 * @param {SectionRegistry} registry
 * @returns {Record<string, string>}
 */
export function sectionTypes(registry) {
  /** @type {Record<string, string>} */
  const types = {};
  for (const entry of registry) {
    if (typeof entry.type === 'string') types[entry.id] = entry.type;
  }
  return types;
}

/**
 * The `id → subtypes[]` map (E-02, FR-005, D-03). Only entries that declare a
 * `subtypes` list appear; pass the result as the `subtypesBySection` argument of
 * `expectedDocType`, ahead of the built-in sub-path table (E-06).
 *
 * @param {SectionRegistry} registry
 * @returns {Record<string, SectionSubtypeRule[]>}
 */
export function sectionSubtypes(registry) {
  /** @type {Record<string, SectionSubtypeRule[]>} */
  const subtypes = {};
  for (const entry of registry) {
    if (Array.isArray(entry.subtypes)) subtypes[entry.id] = entry.subtypes;
  }
  return subtypes;
}
