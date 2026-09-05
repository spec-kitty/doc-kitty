import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/*
 * C-DECK-THEME-2 (contract `deck-theme.md`) / D-02: the deck sheet
 * (`dk-reveal-theme.css`) is route-isolated and therefore cannot share a
 * selector with `theme.css` (D-01), so its `@media (prefers-color-scheme:
 * dark)` block DUPLICATES the dark `--dk-*` palette instead of referencing
 * it — BOTH the `--dk-color-*` chrome tokens AND the `--dk-diagram-*` tokens
 * a deck diagram's Mermaid render reads (ADR-0024). DIRECTIVE_001 (one source
 * of truth) tolerates that duplication only if it is guarded: this test
 * parses BOTH sheets with a single `--dk-*` matcher (not narrowed to
 * `--dk-color-*`) and fails the moment EITHER family in the deck's copy
 * drifts from `theme.css`'s `:root[data-theme='dark']` block, which stays the
 * single authored source. A narrower `--dk-color-*`-only parser previously
 * left the duplicated `--dk-diagram-*` dark values unguarded — a deck-only
 * diagram-palette drift would have passed this suite silently (pre-PR
 * adversarial squad finding, deck-layout-polish).
 *
 * This suite also carries a durable guard for #65 (raw hex on the showcase
 * deck's demo slide): the WP that rewrote `data-background-color` to a token
 * had only a one-time grep, not a committed assertion, so a future edit could
 * silently reintroduce a raw hex literal there without any test catching it.
 */

const themePath = fileURLToPath(new URL('../styles/theme.css', import.meta.url));
const deckPath = fileURLToPath(new URL('../styles/dk-reveal-theme.css', import.meta.url));
const showcaseDeckPath = fileURLToPath(
  new URL('../../example/docs/presentations/showcase-deck.md', import.meta.url),
);

/**
 * Slice the body of the first `{ … }` block that opens after `marker` first
 * matches in `source`. Brace-depth aware (not just "next `}`"), so it stays
 * correct even if a future edit nests a rule inside the block — but the
 * blocks parsed here (`:root[data-theme='dark']` and the deck's `@media …
 * { :root { … } }`) contain no nested braces today.
 */
function extractBlock(source: string, marker: RegExp): string {
  const markerMatch = marker.exec(source);
  if (!markerMatch) {
    throw new Error(`deck-theme-parity: could not find block for marker ${marker}`);
  }
  const braceStart = source.indexOf('{', markerMatch.index + markerMatch[0].length);
  if (braceStart === -1) {
    throw new Error(`deck-theme-parity: no opening brace after marker ${marker}`);
  }
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(braceStart + 1, i);
      }
    }
  }
  throw new Error(`deck-theme-parity: unbalanced braces for marker ${marker}`);
}

/** Parse every `--dk-<name>: <value>;` declaration in a block body. Matches the
 * WHOLE `--dk-*` family (chrome `--dk-color-*` AND `--dk-diagram-*` alike), not
 * just `--dk-color-*` — a family-narrowed parser would silently skip a
 * duplicated-but-drifted `--dk-diagram-*` value. */
function parseDkTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  const declRe = /(--dk-[\w-]+)\s*:\s*([^;]+);/g;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = declRe.exec(block)) !== null) {
    tokens[match[1].trim()] = match[2].trim();
  }
  return tokens;
}

/** Restrict a token map to keys carrying `family` (e.g. `--dk-diagram-`). */
function filterFamily(tokens: Record<string, string>, family: string): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens).filter(([key]) => key.startsWith(family)));
}

describe('deck dark palette parity (C-DECK-THEME-2)', () => {
  const themeCss = readFileSync(themePath, 'utf8');
  const deckCss = readFileSync(deckPath, 'utf8');

  const chromeDarkBlock = extractBlock(themeCss, /:root\[data-theme=['"]dark['"]\]\s*/);
  const deckMediaBlock = extractBlock(deckCss, /@media\s*\(prefers-color-scheme:\s*dark\)\s*/);
  const deckRootBlock = extractBlock(deckMediaBlock, /:root\s*/);

  const chromeTokens = parseDkTokens(chromeDarkBlock);
  const deckTokens = parseDkTokens(deckRootBlock);

  it('theme.css actually declares --dk-* tokens under :root[data-theme="dark"] (sanity — a broken parser must not pass vacuously)', () => {
    expect(Object.keys(chromeTokens).length).toBeGreaterThan(0);
  });

  it('the deck sheet redeclares the SAME --dk-* keys as theme.css dark, with no extras and none missing', () => {
    expect(Object.keys(deckTokens).sort()).toEqual(Object.keys(chromeTokens).sort());
  });

  it('every --dk-* value in the deck dark block is byte-identical to theme.css dark', () => {
    expect(deckTokens).toEqual(chromeTokens);
  });

  // --dk-diagram-* is asserted a second time, NARROWED to just that family, so a
  // regression there cannot hide behind an aggregate pass over the whole --dk-*
  // set (e.g. a compensating unrelated key drifting the other way in a future
  // refactor of this test). This is the durable form of the squad's finding.
  it('the --dk-diagram-* dark tokens are present and byte-identical to theme.css dark (ADR-0024)', () => {
    const chromeDiagramTokens = filterFamily(chromeTokens, '--dk-diagram-');
    const deckDiagramTokens = filterFamily(deckTokens, '--dk-diagram-');

    expect(Object.keys(chromeDiagramTokens).length).toBeGreaterThan(0);
    expect(Object.keys(deckDiagramTokens).sort()).toEqual(Object.keys(chromeDiagramTokens).sort());
    expect(deckDiagramTokens).toEqual(chromeDiagramTokens);
  });
});

describe('showcase deck has no raw hex background colours (#65)', () => {
  it('example/docs/presentations/showcase-deck.md contains no data-background-color="#..." literal', () => {
    const showcaseDeckMd = readFileSync(showcaseDeckPath, 'utf8');
    expect(showcaseDeckMd).not.toMatch(/data-background-color="#/);
  });
});
