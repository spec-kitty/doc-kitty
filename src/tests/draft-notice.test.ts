/**
 * Draft notice (gherkin-authoring-aids mission, WP05: FR-016, NFR-005, SC-003).
 *
 * A fast guard that needs no browser and no build. It reads the sources as text:
 *   - `.dk-draft-notice` rules in dk-components.css use tokens only (NFR-005);
 *   - DraftNotice.astro renders the contract markup verbatim
 *     (contracts/specification-layout.md, "Draft notice markup");
 *   - PageTitle.astro mounts it outside the `dk:metadata-band` slot and outside
 *     the Persona gate, so a theme band override cannot drop it and a Persona
 *     draft still shows it.
 * The built pages themselves (one notice per draft, none on active pages, the
 * drafts-off dist) are checked by assert-chrome-artifacts.mjs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isDraftEntry } from '../lib/metadata.js';
import { fileURLToPath } from 'node:url';

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const stripCssComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const stripAstroComments = (src: string): string =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const COMPONENTS = stripCssComments(read('../styles/dk-components.css'));
const NOTICE = read('../components/slots/DraftNotice.astro');
const PAGE_TITLE = read('../components/PageTitle.astro');

const CONTRACT_MARKUP =
  '<p class="dk-draft-notice"><span class="sr-only">Document status: </span>Draft. This page is a work in progress and may change.</p>';

/** Bodies of every top-level rule whose selector list names `.dk-draft-notice`. */
function draftNoticeBodies(css: string): string[] {
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    if (/\.dk-draft-notice\b/.test(m[1])) bodies.push(m[2]);
  }
  return bodies;
}

// Named colours a declaration could use instead of a token. Not exhaustive; it
// covers the ones a hand-written rule plausibly reaches for.
const NAMED_COLOUR =
  /\b(black|white|red|green|blue|yellow|orange|gray|grey|silver|maroon|purple|navy|teal|olive|gold|brown|pink)\b/i;

describe('.dk-draft-notice CSS uses tokens only (NFR-005)', () => {
  const bodies = draftNoticeBodies(COMPONENTS);
  // Values with every var(...) reference removed: what is left is literal.
  const literals = bodies
    .join(';')
    .split(';')
    .map((decl) => decl.slice(decl.indexOf(':') + 1))
    .map((value) => value.replace(/var\([^()]*(\([^()]*\)[^()]*)*\)/g, ''));

  it('has rules, and they reference --dk-* tokens (positive control)', () => {
    expect(bodies.length, 'no .dk-draft-notice rule in dk-components.css').toBeGreaterThan(0);
    expect(bodies.join(';')).toMatch(/var\(--dk-/);
  });

  it('carries no hex, rgb(), hsl(), named colour or bare length outside var()', () => {
    for (const value of literals) {
      expect(value, 'hex colour').not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(value, 'rgb()/hsl()').not.toMatch(/\b(rgba?|hsla?)\(/i);
      expect(value, 'named colour').not.toMatch(NAMED_COLOUR);
      expect(value, 'bare length').not.toMatch(/\b\d*\.?\d+(px|rem|em)\b/);
    }
  });

  it('never reaches for Starlight variables', () => {
    expect(bodies.join(';')).not.toMatch(/--sl-/);
  });
});

describe('DraftNotice.astro markup (contract)', () => {
  it('renders the contract markup verbatim', () => {
    expect(NOTICE).toContain(CONTRACT_MARKUP);
  });

  it('declares no landmark or live-region role', () => {
    expect(NOTICE).not.toMatch(/\brole=/);
    expect(NOTICE).not.toMatch(/aria-live/);
  });
});

describe('PageTitle.astro placement', () => {
  const template = stripAstroComments(PAGE_TITLE.slice(PAGE_TITLE.indexOf('---', 3) + 3));
  const frontmatter = PAGE_TITLE.slice(0, PAGE_TITLE.indexOf('---', 3));

  it('renders <DraftNotice /> exactly once, gated on the draft predicate', () => {
    expect(template.match(/<DraftNotice\b/g)).toHaveLength(1);
    expect(template).toMatch(/\{\s*isDraft\s*&&\s*<DraftNotice\s*\/>\s*\}/);
    // The shared draft predicate (`isDraftEntry`, the one the loader and the Head
    // carrier's noindex use), so the site root is never shown as a draft. A
    // missing `doc_status` only reaches here on Starlight's unparsed 404 fallback
    // (the schema defaults every collection entry), which must not show it.
    expect(frontmatter).toMatch(/import \{[^}]*\bisDraftEntry\b[^}]*\} from '\.\.\/lib\/metadata\.js';/);
    expect(frontmatter).toMatch(/const isDraft = data\.doc_status !== undefined && isDraftEntry\(/);
    // Why the extra guard: the shared predicate calls a page with NO doc_status a draft
    // (right for Head's noindex), so without the guard the 404 fallback would show it.
    expect(isDraftEntry({ id: '404', data: {} })).toBe(true);
    expect(isDraftEntry({ id: '404', data: { doc_status: 'active' } })).toBe(false);
  });

  it('sits after the band host and outside the dk:metadata-band slot', () => {
    const notice = template.indexOf('<DraftNotice');
    const bandHost = template.indexOf('data-dk-slot="dk:metadata-band"');
    expect(bandHost).toBeGreaterThan(-1);
    expect(notice).toBeGreaterThan(bandHost);
    // Every element the band section opened is closed before the notice.
    const between = template.slice(bandHost, notice);
    expect(between).toContain('</slot>');
    expect(between).toContain('</div>');
  });

  it('is not inside any Persona gate, so a Persona draft shows it', () => {
    // The notice expression stands on its own at the template's top level: the
    // last top-level `{` before it opens the notice expression itself.
    const notice = template.indexOf('<DraftNotice');
    const before = template.slice(0, notice);
    let depth = 0;
    let open = -1;
    for (let i = 0; i < before.length; i += 1) {
      if (before[i] === '{') {
        if (depth === 0) open = i;
        depth += 1;
      } else if (before[i] === '}') depth -= 1;
    }
    expect(depth, 'notice is nested inside another expression').toBe(1);
    expect(before.slice(open)).not.toMatch(/isPersona/);
  });
});
