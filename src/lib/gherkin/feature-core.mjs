/**
 * PURE tag → frontmatter metadata core for generated Gherkin feature pages
 * (ADR-0046; mapping contract §2 "Metadata tags", §3 "Frontmatter", §6 "Hub
 * pages"). Feature-level tags in the reserved `@dk:<key>=<value>` namespace are
 * the only metadata channel a `.feature` file has; this module turns them, the
 * Feature name and the Feature description into the ordered frontmatter block of
 * the generated page.
 *
 * Everything here is deterministic: no clock, no locale, no filesystem. The
 * caller (the generator) supplies the content hash, the ADR directory listing and
 * the section registry, so the same inputs always serialise to the same bytes.
 * Problems are RETURNED as `[dk-gherkin] …` warning strings — nothing here throws
 * on author input (malformed metadata is a content-quality issue, contract §7).
 *
 * PURITY CONTRACT: imports ONLY `../vocabulary-core.mjs` and `./text.mjs` (no
 * fs, no path, no Astro, no parser), so it loads in the Astro build and in the
 * bare-Node `generate-feature-pages.mjs --check` gate alike. Asserted by the
 * import-scan test in `tests/gherkin-feature-core.test.ts`.
 *
 * TYPING: JSDoc-typed `.mjs`, no `.d.ts` sidecar (see `vocabulary-core.mjs`).
 *
 * @module gherkin/feature-core
 */

import { compareCodeUnit } from '../vocabulary-core.mjs';
import { DK_TAG_PREFIX as DK_PREFIX, GHERKIN_LOG_PREFIX as PREFIX, featureTitle, splitNarrative } from './text.mjs';

/** The `generated.by` stamp of every page this generator owns. */
export const GENERATED_BY = 'doc-kitty/gherkin';

/** Maximum `description` length (contract §3 rule 4). */
const DESCRIPTION_MAX = 180;

/**
 * A well-formed `doc_status` value: a lower-case slug (`active`, `in-review`).
 * Wide enough for charter-extensible statuses (contract §2: a non-canonical
 * value passes through and the gate warns), narrow enough that the value is
 * always a plain YAML string scalar when emitted bare — never a tag (`!x`), an
 * alias (`*a`), a flow collection (`[x]`), a mapping (`foo:`), or a non-string
 * scalar (`null`, `true`, `1e3`). Such a value would make the page unreadable as
 * an OWNED page on the next run and lock the section (review #1).
 */
const STATUS_VALUE = /^[a-z][a-z0-9-]*$/;

/**
 * Slug-shaped words a YAML parser resolves to a NON-string scalar: `null` /
 * `true` / `false` (YAML 1.2 core, js-yaml/gray-matter) plus the YAML 1.1
 * booleans other parsers still honour. Never a valid status.
 */
const YAML_KEYWORDS = new Set(['null', 'true', 'false', 'yes', 'no', 'on', 'off', 'y', 'n']);

/**
 * Is `value` a well-formed `doc_status` that is safe to emit as a bare YAML scalar?
 *
 * @param {string} value
 * @returns {boolean}
 */
function isStatusSlug(value) {
  return STATUS_VALUE.test(value) && !YAML_KEYWORDS.has(value);
}

/** `audience.guidance_text` when the Feature has no narrative (contract §2). */
export const DEFAULT_GUIDANCE_TEXT = "This behaviour is specified from this persona's point of view.";

/** Every known `@dk:` key, in contract §2 table order (also the did-you-mean pool). */
const METADATA_KEYS = /** @type {const} */ ([
  'context',
  'status',
  'persona',
  'mission',
  'adr',
  'related',
  'updated',
  'autolink',
  'priority',
]);

/** Keys that may appear at most once; a repeat warns and the first wins. */
const SINGLE_VALUED = new Set(['context', 'status', 'updated', 'autolink', 'priority']);

/**
 * One AST `Tag` as `@cucumber/gherkin` produces it (the subset consumed here).
 *
 * @typedef {object} GherkinTag
 * @property {string} name The tag including its leading `@`, e.g. `@dk:context=shipping`.
 * @property {{ line: number, column?: number }} [location] 1-based source location.
 */

/**
 * Metadata resolved from the Feature-level `@dk:` tags (contract §2).
 *
 * @typedef {object} FeatureMeta
 * @property {string} [context] `@dk:context` (first wins).
 * @property {string} status Resolved `doc_status`: `@dk:status` > `@wip` (draft)
 *   > `@deprecated` (deprecated) > `active`.
 * @property {string[]} personas `@dk:persona` slugs, de-duplicated, source order.
 * @property {string[]} missions `@dk:mission` slugs, source order.
 * @property {string[]} adrs `@dk:adr` values as written, source order.
 * @property {string[]} related `@dk:related` refs, source order.
 * @property {string} [updated] `@dk:updated` (a valid `YYYY-MM-DD`).
 * @property {false} [autolink] Present (as `false`) only for `@dk:autolink=false`.
 * @property {number} [priority] `@dk:priority`, a number in `0..1`.
 */

/**
 * The ordered frontmatter of a generated feature page. Keys absent here are
 * omitted from the output; {@link serializeFrontmatter} owns the order.
 *
 * @typedef {object} FeatureFrontmatter
 * @property {string} title
 * @property {string} description
 * @property {'Specification'} kind
 * @property {string} doc_status
 * @property {string} [updated]
 * @property {string} [glossary_context]
 * @property {false} [glossary_autolink]
 * @property {string[]} tags Runner tags without `@` (omitted when empty).
 * @property {Array<{ profile: string, guidance_text: string }>} audience (omitted when empty)
 * @property {string[]} related (omitted when empty)
 * @property {Array<{ resource: string, title: string }>} sources (omitted when empty)
 * @property {{ by: string, at: string }} generated `at` is `sha256:<12 hex>`.
 * @property {{ priority: number }} [agent]
 */

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * `file:line:col` (or just `file` / `file:line`) for a warning.
 *
 * @param {string | undefined} file
 * @param {{ line?: number, column?: number } | undefined} [location]
 * @returns {string}
 */
function where(file, location) {
  let out = file ?? '<unknown>';
  if (location && typeof location.line === 'number') {
    out += `:${location.line}`;
    if (typeof location.column === 'number') out += `:${location.column}`;
  }
  return out;
}

/**
 * De-duplicate and sort with the one code-unit comparator.
 *
 * @param {Iterable<string>} values
 * @returns {string[]}
 */
function uniqueSorted(values) {
  return [...new Set(values)].sort(compareCodeUnit);
}

/**
 * Plain Levenshtein distance (tiny inputs: tag keys).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function editDistance(a, b) {
  /** @type {number[]} */
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * The closest known `@dk:` key within edit distance 2 (ties: table order).
 *
 * @param {string} key
 * @returns {string | undefined}
 */
function suggestKey(key) {
  let best;
  let bestDistance = 3;
  for (const known of METADATA_KEYS) {
    const d = editDistance(key.toLowerCase(), known);
    if (d < bestDistance) {
      best = known;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * True for a real calendar date written `YYYY-MM-DD`.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isIsoDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * The `sha256:<first 12 hex>` stamp for `generated.at`. Accepts a bare hex
 * digest or one already prefixed with `sha256:`.
 *
 * @param {string} hash
 * @returns {string}
 */
function shortHash(hash) {
  return `sha256:${String(hash).replace(/^sha256:/, '').slice(0, 12)}`;
}

// ---------------------------------------------------------------------------
// §2 — Metadata tags
// ---------------------------------------------------------------------------

/**
 * Parse the Feature-level tags into page metadata, passthrough runner tags and
 * warnings (contract §2). Never throws.
 *
 * - `@dk:<key>=<value>` splits on the FIRST `=` (values may hold `:`, `/`, `-`, `=`).
 * - `@wip` / `@deprecated` set the status shorthand and are consumed (not page tags).
 * - Any other tag passes through to `tags` without its `@`, de-duplicated and
 *   code-unit sorted.
 * - Unknown keys, a missing `=value`, repeats of single-valued keys (first wins),
 *   an invalid `status`/`updated`/`priority`/`autolink` value → a warning, value
 *   ignored. A `status` must be a lower-case slug (`/^[a-z][a-z0-9-]*$/`, and
 *   not a YAML keyword such as `null`/`true`); an ignored one falls back to the
 *   `@wip`/`@deprecated` shorthand or `active`.
 *
 * @param {ReadonlyArray<GherkinTag> | undefined} tags The Feature's AST tags.
 * @param {{ file?: string }} [options] `file` names the source in warnings.
 * @returns {{ meta: FeatureMeta, tags: string[], warnings: string[] }}
 */
export function parseMetadataTags(tags, { file } = {}) {
  /** @type {string[]} */
  const warnings = [];
  /** @type {string[]} */
  const passthrough = [];
  /** @type {Map<string, string>} first value of each single-valued key */
  const single = new Map();
  /** @type {string[]} */
  const personas = [];
  /** @type {string[]} */
  const missions = [];
  /** @type {string[]} */
  const adrs = [];
  /** @type {string[]} */
  const related = [];
  let wip = false;
  let deprecated = false;
  // A `@dk:status` that cannot be honoured (malformed, valueless, mis-cased key,
  // or two tags that disagree) fails CLOSED: the page is a draft, never live.
  let statusFailedClosed = false;
  const DRAFT_NOTE = 'the page is treated as a draft';

  for (const tag of tags ?? []) {
    const raw = typeof tag?.name === 'string' ? tag.name : '';
    const loc = where(file, tag?.location);
    const name = raw.startsWith('@') ? raw : `@${raw}`;
    if (name === '@') continue;

    if (!name.startsWith(DK_PREFIX)) {
      if (name === '@wip') wip = true;
      else if (name === '@deprecated') deprecated = true;
      else passthrough.push(name.slice(1));
      continue;
    }

    const body = name.slice(DK_PREFIX.length);
    const eq = body.indexOf('=');
    const key = eq === -1 ? body : body.slice(0, eq);
    const value = eq === -1 ? undefined : body.slice(eq + 1);

    if (key !== 'status' && key.toLowerCase() === 'status') {
      statusFailedClosed = true;
      warnings.push(`${PREFIX} ${loc} unknown metadata tag ${name} (did you mean @dk:status?); ${DRAFT_NOTE}`);
      continue;
    }
    if (!(/** @type {readonly string[]} */ (METADATA_KEYS).includes(key))) {
      const hint = suggestKey(key);
      warnings.push(
        `${PREFIX} ${loc} unknown metadata tag ${name}` + (hint ? ` (did you mean ${hint}?)` : ''),
      );
      continue;
    }
    if (value === undefined || value === '') {
      if (key === 'status') statusFailedClosed = true;
      warnings.push(
        `${PREFIX} ${loc} metadata tag ${name} has no value (expected @dk:${key}=<value>); ignored` +
          (key === 'status' ? `; ${DRAFT_NOTE}` : ''),
      );
      continue;
    }

    if (SINGLE_VALUED.has(key)) {
      if (single.has(key)) {
        if (key === 'status' && single.get(key) !== value) {
          statusFailedClosed = true;
          warnings.push(
            `${PREFIX} ${loc} conflicting @dk:status tags (${single.get(key)} and ${value}); ${DRAFT_NOTE}`,
          );
          continue;
        }
        warnings.push(
          `${PREFIX} ${loc} multiple @dk:${key} tags; keeping the first (${single.get(key)}), ignoring ${value}`,
        );
        continue;
      }
      if (key === 'status' && !isStatusSlug(value)) {
        // Rejected ONLY for its case (`Draft`): name the value that would pass.
        const lower = value.toLowerCase();
        const hint = isStatusSlug(lower) ? `; did you mean @dk:status=${lower}?` : '';
        statusFailedClosed = true;
        warnings.push(
          `${PREFIX} ${loc} invalid @dk:status=${value} (expected a lower-case slug such as ` +
            `active, draft or in-review); ignored${hint}; ${DRAFT_NOTE}`,
        );
        continue;
      }
      if (key === 'updated' && !isIsoDate(value)) {
        warnings.push(`${PREFIX} ${loc} invalid @dk:updated=${value} (expected a YYYY-MM-DD date); ignored`);
        continue;
      }
      if (key === 'priority') {
        const n = Number(value);
        if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !(n >= 0 && n <= 1)) {
          warnings.push(`${PREFIX} ${loc} invalid @dk:priority=${value} (expected a number in 0..1); ignored`);
          continue;
        }
      }
      if (key === 'autolink' && value !== 'true' && value !== 'false') {
        warnings.push(`${PREFIX} ${loc} invalid @dk:autolink=${value} (expected true or false); ignored`);
        continue;
      }
      single.set(key, value);
      continue;
    }

    if (key === 'persona') {
      if (!personas.includes(value)) personas.push(value);
    } else if (key === 'mission') missions.push(value);
    else if (key === 'adr') adrs.push(value);
    else if (key === 'related') related.push(value);
  }

  const status = statusFailedClosed
    ? 'draft'
    : (single.get('status') ?? (wip ? 'draft' : deprecated ? 'deprecated' : 'active'));

  /** @type {FeatureMeta} */
  const meta = { status, personas, missions, adrs, related };
  const context = single.get('context');
  if (context !== undefined) meta.context = context;
  const updated = single.get('updated');
  if (updated !== undefined) meta.updated = updated;
  if (single.get('autolink') === 'false') meta.autolink = false;
  const priority = single.get('priority');
  if (priority !== undefined) meta.priority = Number(priority);

  return { meta, tags: uniqueSorted(passthrough), warnings };
}

// ---------------------------------------------------------------------------
// §3 — Narrative and description
// ---------------------------------------------------------------------------

/**
 * Join a Feature description's leading narrative block (`As a …` / `I want …` /
 * `So that …` / `In order to …`, detected by `splitNarrative` in `./text.mjs`)
 * into one sentence for `audience.guidance_text`:
 *
 * - lines are joined with `", "`;
 * - every line after the first has its first letter lower-cased, EXCEPT when it
 *   opens with the pronoun `I` (`I want …` stays `I want …`);
 * - trailing `,`/`;`/`:` on each line are dropped before joining;
 * - the result ends with `.` unless it already ends with `.`, `!` or `?`.
 *
 * @param {string | undefined} description The (raw or dedented) Feature description.
 * @returns {string | undefined} The joined narrative, or `undefined` when there is none.
 */
export function extractNarrative(description) {
  const { narrative } = splitNarrative(description);
  if (narrative.length === 0) return undefined;
  const parts = narrative.map((line, i) => {
    const text = line.replace(/\s+/g, ' ').replace(/[\s,;:]+$/, '');
    if (i === 0 || /^I(?=[\s'’]|$)/.test(text)) return text;
    return text.charAt(0).toLowerCase() + text.slice(1);
  });
  const joined = parts.join(', ');
  return /[.!?]$/.test(joined) ? joined : `${joined}.`;
}

/**
 * The first sentence of `text`: everything up to and including the first `.`,
 * `!` or `?` that is followed by whitespace or the end of the text (across line
 * breaks), with whitespace collapsed. No terminator ⇒ the whole (collapsed) text.
 *
 * @param {string} text
 * @returns {string}
 */
function firstSentence(text) {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  const m = /[.!?](?=\s|$)/.exec(collapsed);
  return m ? collapsed.slice(0, m.index + 1) : collapsed;
}

/**
 * Enforce the {@link DESCRIPTION_MAX}-char cap (contract §3 rule 4): a longer
 * string is cut at the last word boundary at or before index 179 and gets `…`
 * appended (result ≤ 180 chars). A single over-long word with no boundary is
 * hard-cut at 179 (never splitting a surrogate pair) plus `…`.
 *
 * @param {string} text Already whitespace-collapsed.
 * @returns {{ text: string, truncated: boolean }}
 */
export function truncateDescription(text) {
  if (text.length <= DESCRIPTION_MAX) return { text, truncated: false };
  const limit = DESCRIPTION_MAX - 1;
  let cut;
  if (text[limit] === ' ') {
    cut = text.slice(0, limit);
  } else {
    const head = text.slice(0, limit);
    const space = head.lastIndexOf(' ');
    if (space > 0) {
      cut = head.slice(0, space);
    } else {
      const code = text.charCodeAt(limit - 1);
      cut = text.slice(0, code >= 0xd800 && code <= 0xdbff ? limit - 1 : limit);
    }
  }
  return { text: `${cut.trimEnd()}…`, truncated: true };
}

/**
 * Derive the page `description` (contract §3 rules 1–6):
 *
 * 1–3. dedent, drop a leading narrative block, take the first sentence of the rest;
 * 4.   collapse whitespace; over 180 chars → word-boundary cut + `…` and a warning;
 * 5.   nothing left after the narrative → the joined narrative ({@link extractNarrative});
 * 6.   empty description → `"Behaviour specification for <Feature name>."` and a warning.
 *
 * @param {string} featureName
 * @param {string | undefined} description The Feature description as the parser returns it.
 * @param {{ file?: string, location?: { line?: number, column?: number } }} [options]
 *   `file` (and optionally the Feature's `location`) names the source in warnings.
 * @returns {{ description: string, warnings: string[], usedNameFallback?: true }}
 *   `usedNameFallback` is set (only then) when step 6 ran: the text is built from
 *   the Feature NAME, which is literal text, not authored Markdown.
 */
export function deriveDescription(featureName, description, { file, location } = {}) {
  /** @type {string[]} */
  const warnings = [];
  const loc = where(file, location);
  const { rest } = splitNarrative(description);
  let usedNameFallback = false;

  let candidate;
  if (rest.trim() !== '') {
    candidate = firstSentence(rest);
  } else {
    candidate = extractNarrative(description);
  }
  if (candidate === undefined || candidate === '') {
    candidate = `Behaviour specification for ${String(featureName ?? '').replace(/\s+/g, ' ').trim()}.`;
    warnings.push(`${PREFIX} ${loc} Feature has no description; using "${candidate}"`);
    usedNameFallback = true;
  }

  const { text, truncated } = truncateDescription(candidate);
  if (truncated) {
    warnings.push(
      `${PREFIX} ${loc} description is ${candidate.length} chars; truncated to ${text.length} (max ${DESCRIPTION_MAX})`,
    );
  }
  return { description: text, warnings, ...(usedNameFallback ? { usedNameFallback: true } : {}) };
}

// ---------------------------------------------------------------------------
// §2 — Reference building
// ---------------------------------------------------------------------------

/**
 * Resolve an `@dk:adr=<n>` value to a `related` ref by matching
 * `<NNNN>-*.md` (4-digit zero-pad) in the ADR directory listing the caller
 * supplies. Several matches → the code-unit-first file (deterministic).
 *
 * - match:        `resolveAdrRef('1', ['0001-use-astro-starlight.md'])` → `adr/0001-use-astro-starlight`
 * - no match:     `adr/<NNNN>` (the dangling-ref gate then fails with its standard message)
 * - non-numeric:  `adr/<input>` unchanged
 *
 * @param {string | number} number
 * @param {ReadonlyArray<string> | undefined} adrFileNames Basenames (paths are reduced to basenames).
 * @returns {string}
 */
export function resolveAdrRef(number, adrFileNames) {
  const input = String(number).trim();
  if (!/^\d+$/.test(input)) return `adr/${input}`;
  const padded = input.padStart(4, '0');
  const matches = (adrFileNames ?? [])
    .map((f) => String(f).split(/[\\/]/).pop() ?? '')
    .filter((f) => f.startsWith(`${padded}-`) && f.endsWith('.md') && f.length > padded.length + 4)
    .sort(compareCodeUnit);
  return matches.length > 0 ? `adr/${matches[0].slice(0, -'.md'.length)}` : `adr/${padded}`;
}

/**
 * The subset of a `sections.yaml` registry entry {@link missionPrefix} reads
 * (structurally a `vocabulary-loader.mjs` `SectionRegistryEntry`).
 *
 * @typedef {object} RegistrySection
 * @property {string} id
 * @property {string} [type]
 * @property {ReadonlyArray<{ match: string, type: string }>} [subtypes]
 */

/**
 * The `related` prefix for `@dk:mission=<slug>` refs, from the section registry:
 * the first section (in registry order) with a `subtypes` rule whose `type` is
 * `Mission` yields `<section id>/<match>` (the example registry: `plans/missions`).
 * Failing that, a section whose own `type` is `Mission` yields `<section id>`.
 * No such entry (or no registry) → `plans` plus a warning; the caller decides
 * whether to surface it (only meaningful when a feature actually uses `@dk:mission`).
 *
 * @param {ReadonlyArray<RegistrySection> | { sections?: ReadonlyArray<RegistrySection> } | null | undefined} registry
 *   The `loadSectionRegistry` result (or a `{ sections }` wrapper).
 * @returns {{ prefix: string, warning?: string }}
 */
export function missionPrefix(registry) {
  /** @type {ReadonlyArray<RegistrySection>} */
  let sections = [];
  if (Array.isArray(registry)) sections = registry;
  else if (registry && typeof registry === 'object' && 'sections' in registry && Array.isArray(registry.sections)) {
    sections = registry.sections;
  }
  /** @param {string} s */
  const trimSlashes = (s) => s.replace(/^\/+|\/+$/g, '');
  for (const section of sections) {
    if (!section || typeof section.id !== 'string' || !Array.isArray(section.subtypes)) continue;
    for (const rule of section.subtypes) {
      if (rule && rule.type === 'Mission' && typeof rule.match === 'string' && trimSlashes(rule.match) !== '') {
        return { prefix: `${trimSlashes(section.id)}/${trimSlashes(rule.match)}` };
      }
    }
  }
  for (const section of sections) {
    if (section && typeof section.id === 'string' && section.id !== '' && section.type === 'Mission') {
      return { prefix: trimSlashes(section.id) };
    }
  }
  return {
    prefix: 'plans',
    warning:
      `${PREFIX} the section registry declares no Mission subtype; ` +
      '@dk:mission refs fall back to plans/<slug>',
  };
}

// ---------------------------------------------------------------------------
// §3 — Frontmatter assembly and serialisation
// ---------------------------------------------------------------------------

/**
 * Assemble the frontmatter of one generated feature page (contract §2–3).
 *
 * An unnamed Feature (`Feature:` with nothing after it) takes the ONE fallback
 * title `featureTitle` (`./text.mjs`) gives the body H1 too — its trimmed keyword
 * — for `title` and the description fallback, with a warning.
 *
 * @param {object} input
 * @param {string} input.featureName The Feature name (→ `title`).
 * @param {string} [input.featureKeyword] The Feature keyword as written (the
 *   unnamed-Feature fallback). Omitted ⇒ `Feature`.
 * @param {string | undefined} input.description The Feature description (raw, as parsed).
 * @param {ReadonlyArray<GherkinTag> | undefined} input.tags The Feature-level AST tags.
 * @param {string} [input.file] Source path for warnings.
 * @param {string} [input.sourceResource] `sources[0].resource` (omitted when absent).
 * @param {string} input.hash Full hex sha256 of the source bytes (`sha256:<12>` is emitted).
 * @param {string | { prefix: string, warning?: string }} [input.missionPrefix] The
 *   {@link missionPrefix} result (or its `prefix`). Omitted ⇒ `missionPrefix(null)`.
 *   Its warning is reported only when the feature has an `@dk:mission` tag.
 * @param {ReadonlyArray<string>} [input.adrFileNames] Basenames under `<docsRoot>/adr/`.
 * @param {{ line?: number, column?: number }} [input.location] The Feature's location (warnings).
 * @returns {{ fields: FeatureFrontmatter, warnings: string[], descriptionIsName?: true }}
 *   `descriptionIsName` (only when set): `fields.description` is built from the
 *   Feature name, so a Markdown context must escape it.
 */
export function buildFrontmatter({
  featureName,
  featureKeyword,
  description,
  tags,
  file,
  sourceResource,
  hash,
  missionPrefix: missionPrefixInput,
  adrFileNames,
  location,
}) {
  const parsed = parseMetadataTags(tags, { file });
  const title = featureTitle(featureName, featureKeyword);
  /** @type {string[]} */
  const nameWarnings = [];
  if (String(featureName ?? '').trim() === '') {
    nameWarnings.push(
      `${PREFIX} ${where(file, location && { line: location.line })} Feature has no name; using "${title}"`,
    );
  }
  const derived = deriveDescription(title, description, { file, location });
  const warnings = [...nameWarnings, ...parsed.warnings, ...derived.warnings];
  const { meta } = parsed;

  const mission =
    typeof missionPrefixInput === 'string'
      ? { prefix: missionPrefixInput }
      : (missionPrefixInput ?? missionPrefix(null));
  if (meta.missions.length > 0 && mission.warning) warnings.push(mission.warning);

  const guidance = extractNarrative(description) ?? DEFAULT_GUIDANCE_TEXT;
  const related = uniqueSorted([
    ...meta.missions.map((m) => `${mission.prefix}/${m}`),
    ...meta.adrs.map((n) => resolveAdrRef(n, adrFileNames)),
    ...meta.related,
  ]);

  /** @type {FeatureFrontmatter} */
  const fields = {
    title,
    description: derived.description,
    kind: 'Specification',
    doc_status: meta.status,
    tags: parsed.tags,
    audience: meta.personas.map((profile) => ({ profile, guidance_text: guidance })),
    related,
    sources: sourceResource ? [{ resource: sourceResource, title: 'Gherkin source' }] : [],
    generated: { by: GENERATED_BY, at: shortHash(hash) },
  };
  if (meta.updated !== undefined) fields.updated = meta.updated;
  if (meta.context !== undefined) fields.glossary_context = meta.context;
  if (meta.autolink === false) fields.glossary_autolink = false;
  if (meta.priority !== undefined) fields.agent = { priority: meta.priority };

  return { fields, warnings, ...(derived.usedNameFallback ? { descriptionIsName: true } : {}) };
}

/** YAML-safe double-quoted scalar — the glossary generator's `yamlString`. */
const q = (/** @type {string} */ value) => JSON.stringify(value);

/**
 * Serialise {@link FeatureFrontmatter} as the `---`-fenced block, in the fixed
 * contract §3 key order. String scalars are `JSON.stringify`-quoted; `kind`
 * and `updated` are bare, and so is `doc_status` when it is a lower-case slug —
 * any other value is quoted (defence in depth behind {@link parseMetadataTags}'s
 * validation: the block must always read back as an OWNED page). `tags` is an
 * inline JSON array; the list
 * and map keys are block YAML. Empty/absent optional keys are omitted. `tags` and
 * `related` are (re-)de-duplicated and code-unit sorted. No trailing newline.
 *
 * @param {FeatureFrontmatter} fields
 * @returns {string}
 */
export function serializeFrontmatter(fields) {
  const lines = ['---'];
  lines.push(`title: ${q(fields.title)}`);
  lines.push(`description: ${q(fields.description)}`);
  lines.push(`kind: ${fields.kind ?? 'Specification'}`);
  const status = String(fields.doc_status);
  lines.push(`doc_status: ${isStatusSlug(status) ? status : q(status)}`);
  if (fields.updated !== undefined) lines.push(`updated: ${fields.updated}`);
  if (fields.glossary_context !== undefined) lines.push(`glossary_context: ${q(fields.glossary_context)}`);
  if (fields.glossary_autolink === false) lines.push('glossary_autolink: false');
  const tags = uniqueSorted(fields.tags ?? []);
  if (tags.length > 0) lines.push(`tags: [${tags.map(q).join(', ')}]`);
  if (fields.audience && fields.audience.length > 0) {
    lines.push('audience:');
    for (const { profile, guidance_text } of fields.audience) {
      lines.push(`  - profile: ${q(profile)}`, `    guidance_text: ${q(guidance_text)}`);
    }
  }
  const related = uniqueSorted(fields.related ?? []);
  if (related.length > 0) {
    lines.push('related:', ...related.map((r) => `  - ${q(r)}`));
  }
  if (fields.sources && fields.sources.length > 0) {
    lines.push('sources:');
    for (const { resource, title } of fields.sources) {
      lines.push(`  - resource: ${q(resource)}`, `    title: ${q(title)}`);
    }
  }
  lines.push('generated:', `  by: ${q(fields.generated.by)}`, `  at: ${q(fields.generated.at)}`);
  if (fields.agent !== undefined) lines.push('agent:', `  priority: ${String(fields.agent.priority)}`);
  lines.push('---');
  return lines.join('\n');
}

/**
 * Serialise a generated hub page's frontmatter (contract §6), same style as
 * {@link serializeFrontmatter}: `kind: Hub`, `doc_status: active`, and a
 * `generated` block whose `at` is `sha256:<first 12>` of `hash` (the caller hashes
 * the sorted child list). No trailing newline.
 *
 * @param {{ title: string, description: string, hash: string }} input
 * @returns {string}
 */
export function serializeHubFrontmatter({ title, description, hash }) {
  return [
    '---',
    `title: ${q(title)}`,
    `description: ${q(description)}`,
    'kind: Hub',
    'doc_status: active',
    'generated:',
    `  by: ${q(GENERATED_BY)}`,
    `  at: ${q(shortHash(hash))}`,
    '---',
  ].join('\n');
}
