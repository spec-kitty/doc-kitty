/**
 * Issue #16 — the ONE shared re-derive processor (`createPageProcessor`).
 *
 * The render-time re-derive (`OnThisPage.linksForBody`, `definitions-payload
 * .stripMarkdown`) must parse a page's markdown the SAME way the build substrate
 * does (`config.ts` runs remark-gfm + remark-smartypants BEFORE the pinned
 * directive/glossary passes). A bare `remarkParse` diverged and produced phantoms:
 * a gfm autolink literal like `cargo@x.com` stayed a TEXT node, so the auto-linker
 * linked the `cargo` inside the email address — a used-list entry the real build
 * never emits (the build already made it a guarded `link` node).
 *
 * These tests pin that the shared processor closes the divergence, comparing it
 * against a bare-parse control to document exactly what was wrong.
 */
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { createPageProcessor } from '../lib/glossary/page-processor.js';
import glossaryTerm from '../lib/remark/glossary-term.js';
import {
  computePageLinks,
  type MdNode,
  type MdRoot,
} from '../lib/remark/glossary-autolink.internal.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

// Tiny index: the single surface `cargo` → term `Cargo` in context `shipping`
// (mirrors the autolink test's inline index; anchor/contextSlug are the stored,
// authoritative values the linker READS — issue #17).
const index: SharedTermIndex = {
  bySurface: new Map([
    ['cargo', [{ context: 'shipping', contextSlug: 'shipping', anchor: 'cargo', termName: 'Cargo' }]],
  ]),
  contexts: new Map(),
};

/** Run the SHARED re-derive path over `body` (mirrors `linksForBody`, autolink on):
 *  shared parse → runSync (transformers, incl. smartypants — issue #20) →
 *  glossary-term (no-op here, no `:term`) → computePageLinks. */
function sharedUsedList(body: string) {
  const p = createPageProcessor({ directive: true });
  const tree = p.runSync(p.parse(body)) as unknown as MdRoot;
  const silent = { message() {} };
  (glossaryTerm({ index }) as (t: MdRoot, f: typeof silent) => void)(tree, silent);
  return computePageLinks(tree, undefined, index, new Set()).linksUsed;
}

/** The pre-#16 BARE-parse control (no gfm/smartypants) — documents the divergence. */
function bareUsedList(body: string) {
  const tree = unified().use(remarkParse).parse(body) as unknown as MdRoot;
  return computePageLinks(tree, undefined, index, new Set()).linksUsed;
}

describe('createPageProcessor — gfm autolink literal (phantom closed)', () => {
  const body = 'Contact cargo@x.com about Cargo.';

  it('shared path links only the prose "Cargo" — the email is a guarded link node', () => {
    const used = sharedUsedList(body);
    expect(used).toHaveLength(1);
    // The single link is the PROSE occurrence; `cargo@x.com` is a gfm mailto link
    // the auto-linker's ancestor guard skips — no phantom.
    expect(used[0].surface).toBe('Cargo');
    expect(used[0].termName).toBe('Cargo');
  });

  it('bare-parse control links the EMAIL substring — the phantom the fix removes', () => {
    const used = bareUsedList(body);
    expect(used).toHaveLength(1);
    // Under a bare parse `cargo@x.com` is plain text, so the auto-linker links the
    // `cargo` inside the email first and skips the prose — the wrong, phantom link.
    expect(used[0].surface).toBe('cargo');
  });
});

/** Collect every text node's value from a parsed tree, in document order. */
function collectText(node: MdNode): string[] {
  const out: string[] = [];
  const walk = (n: MdNode): void => {
    if (n.type === 'text' && typeof n.value === 'string') out.push(n.value);
    if (Array.isArray(n.children)) for (const c of n.children) walk(c);
  };
  walk(node);
  return out;
}

describe('createPageProcessor — gfm + smartypants sanity (no literal leakage)', () => {
  it('parses gfm strikethrough so `~~` never leaks as literal text', () => {
    const tree = createPageProcessor().parse('A ~~struck~~ word.') as unknown as MdNode;
    const texts = collectText(tree);
    // The tildes are consumed by the gfm `delete` node — no text node holds `~~`.
    expect(texts.some((t) => t.includes('~~'))).toBe(false);
    expect(texts.join('')).toBe('A struck word.');
  });

  it('smartypants is wired: running the processor curls straight quotes', () => {
    const proc = createPageProcessor();
    // smartypants is a transformer (runs at `.run()`), so exercise the full run to
    // prove the pin is effective — straight quotes become typographic quotes.
    const tree = proc.runSync(proc.parse('He said "hi".')) as unknown as MdNode;
    const joined = collectText(tree).join('');
    expect(joined).not.toContain('"');
    expect(joined).toContain('“'); // “
    expect(joined).toContain('”'); // ”
  });
});

// Issue #20 — the residual "curl phantom" #16 left open. A surface key with
// typographic punctuation (a straight apostrophe) is stored raw (`term.name
// .toLowerCase()`), but the build curls the PROSE (smartypants runs before the
// auto-linker), so the straight-quote surface no longer matches → the build does
// NOT link it. The pre-#20 `.parse()`-only re-derive skipped smartypants, kept the
// prose straight, still matched → a PHANTOM used-list entry the build never emits.
// Running the transformers (`runSync`) in the re-derive closes the class.
const curlIndex: SharedTermIndex = {
  bySurface: new Map([
    // Surface stored with a straight apostrophe (the raw lower-cased term name).
    ["don't", [{ context: 'jargon', contextSlug: 'jargon', anchor: 'dont', termName: "Don't" }]],
  ]),
  contexts: new Map(),
};

/** NEW shared re-derive (issue #20): parse → runSync (smartypants) → glossary passes. */
function sharedUsedListCurl(body: string) {
  const p = createPageProcessor({ directive: true });
  const tree = p.runSync(p.parse(body)) as unknown as MdRoot;
  const silent = { message() {} };
  (glossaryTerm({ index: curlIndex }) as (t: MdRoot, f: typeof silent) => void)(tree, silent);
  return computePageLinks(tree, undefined, curlIndex, new Set()).linksUsed;
}

/** The pre-#20 `.parse()`-ONLY control: smartypants is configured but NEVER run,
 *  so the prose stays straight and the phantom re-appears — documents the fix. */
function parseOnlyUsedListCurl(body: string) {
  const tree = createPageProcessor({ directive: true }).parse(body) as unknown as MdRoot;
  const silent = { message() {} };
  (glossaryTerm({ index: curlIndex }) as (t: MdRoot, f: typeof silent) => void)(tree, silent);
  return computePageLinks(tree, undefined, curlIndex, new Set()).linksUsed;
}

describe('createPageProcessor — smartypants transformer parity (issue #20 curl phantom)', () => {
  // Prose mention with a STRAIGHT apostrophe; the build curls it to `don’t` before
  // the auto-linker runs, so the straight-quote surface `don't` never matches.
  const body = "You really don't say.";

  it('shared runSync path matches the build: curled prose no longer matches the straight surface → no phantom', () => {
    const used = sharedUsedListCurl(body);
    expect(used).toHaveLength(0);
  });

  it('`.parse()`-only control diverges: smartypants never ran, so the straight surface still matches → phantom link', () => {
    const used = parseOnlyUsedListCurl(body);
    expect(used).toHaveLength(1);
    expect(used[0].termName).toBe("Don't");
  });
});
