/**
 * `markua-attributes.internal` — the pure, Astro-free `{…}` attribute-list
 * grammar parse for the attribute-list plugin (ADR-0030, contract
 * `attribute-list-plugin.md`; FR-005/FR-006/FR-007/FR-012). Mirrors the repo's
 * `diagram-meta` / `deck-split` internal-split so the grammar is vitest-covered
 * without importing Astro (`markua-attributes.ts` is the mdast-facing half).
 *
 * The grammar (both quoted from the Markua manual):
 *   - `{key: value}` pairs, comma-separated: `{alt: "a beach", width: "75%"}`;
 *   - quoted (`"…"`) OR bare values — quotes are optional and stripped, and a
 *     percentage keeps its `%` (`75%` and `"75%"` both parse to `75%`);
 *   - the `{#id}` shorthand ≡ `{id: id}`;
 *   - whitespace around keys, `:`, and commas is tolerated.
 *
 * A `{…}` string that does NOT parse as an attribute list returns `null` — the
 * caller then leaves it as literal paragraph text, never an error (FR-012,
 * NFR-002). This function never throws.
 */

/** The parsed shape: the raw key→value entries plus the resolved id (if any). */
export interface AttrList {
  /** All recognised `key: value` pairs; a `{#id}` also lands here as `id`. */
  entries: Record<string, string>;
  /** The resolved id — from `{#id}` shorthand OR an explicit `{id: …}`. */
  id?: string;
}

/** A bare identifier a `{#id}` / `{id: …}` value must match (HTML-id friendly). */
const ID_RE = /^[A-Za-z][\w-]*$/;
/** A recognised attribute key: word chars and hyphens (e.g. `align`, `column-widths`). */
const KEY_RE = /^[\w-]+$/;

/**
 * Split an attribute-list body on TOP-LEVEL commas — a comma inside a
 * double-quoted value does not split (so `{alt: "a, b", width: "75%"}` yields two
 * segments, not three).
 */
function splitTopLevel(body: string): string[] {
  const out: string[] = [];
  let current = '';
  // The closing quote we are waiting for while inside a value; `undefined` when
  // at top level. We protect commas inside a straight `"…"` (authored) OR a curly
  // `“…”` pair — the latter is what SmartyPants produces from a `{alt: "A cat,
  // sitting"}` value before this parser runs (#81), so without it the internal
  // comma would split the list and drop it to literal text. We deliberately do
  // NOT treat single quotes as openers here: a straight `'` or curly `‘/’` would
  // misfire on a bare apostrophe (`it's`, `it’s`) and swallow a real separator.
  let closer: string | undefined;
  for (const ch of body) {
    if (closer === undefined) {
      if (ch === '"') {
        closer = '"';
        current += ch;
        continue;
      }
      if (ch === '“') {
        closer = '”';
        current += ch;
        continue;
      }
      if (ch === ',') {
        out.push(current);
        current = '';
        continue;
      }
    } else if (ch === closer) {
      closer = undefined;
      current += ch;
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out;
}

/**
 * The delimiter-quote pairs `stripQuotes` recognises. Straight `"`/`'` are the
 * authored forms; the typographic pairs (`“…”`, `‘…’`) are what Astro's
 * SmartyPants produces when it runs over the raw `{alt: "…"}` text BEFORE this
 * parser sees it — without them a `{alt: "…"}` value would keep its curly
 * delimiter quotes inside the `<img alt>` accessible name (#81).
 */
const QUOTE_PAIRS: ReadonlyArray<readonly [open: string, close: string]> = [
  ['"', '"'],
  ['“', '”'], // “ … ”
  ["'", "'"],
  ['‘', '’'], // ‘ … ’
];

/**
 * Strip a single layer of surrounding quotes from a value; a bare value is
 * returned verbatim (so `%` survives on both `75%` and `"75%"`). Recognises both
 * straight and typographic quote pairs (#81) so a SmartyPants-curled delimiter is
 * still treated as a delimiter, not part of the value.
 */
function stripQuotes(value: string): string {
  if (value.length >= 2) {
    for (const [open, close] of QUOTE_PAIRS) {
      if (value.startsWith(open) && value.endsWith(close)) {
        return value.slice(open.length, value.length - close.length);
      }
    }
  }
  return value;
}

/**
 * Parse a `{…}` attribute-list string. Returns the entries + resolved id, or
 * `null` when the content is not a well-formed attribute list (the caller keeps
 * it as literal text). Total: any input either parses or returns `null`.
 */
export function parseAttrList(raw: string): AttrList | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  const body = trimmed.slice(1, -1).trim();
  if (body.length === 0) return null; // `{}` carries nothing → literal text.

  const entries: Record<string, string> = {};
  let id: string | undefined;

  for (const segmentRaw of splitTopLevel(body)) {
    const segment = segmentRaw.trim();
    if (segment.length === 0) continue; // tolerate a trailing/extra comma.

    // `{#id}` shorthand (may appear alongside pairs) ≡ `{id: id}`.
    if (segment.startsWith('#')) {
      const value = segment.slice(1).trim();
      if (!ID_RE.test(value)) return null;
      entries.id = value;
      id = value;
      continue;
    }

    const colon = segment.indexOf(':');
    if (colon === -1) return null; // not a pair and not `#id` → not an attr list.
    const key = segment.slice(0, colon).trim();
    if (!KEY_RE.test(key)) return null;
    const value = stripQuotes(segment.slice(colon + 1).trim());
    entries[key] = value;
    if (key === 'id') id = value;
  }

  // Body had content but produced no usable entry (e.g. `{ , }`) → literal text.
  if (Object.keys(entries).length === 0) return null;
  return { entries, id };
}
