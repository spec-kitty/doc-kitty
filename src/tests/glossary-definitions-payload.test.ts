/**
 * WP08 T-DEF — the hover-preview definitions payload (the WP06 island contract).
 *
 * The island reads term definitions from a per-page
 * `<script type="application/json" id="dk-glossary-definitions">` whose body is
 * `{ "<context>": { "<termName>": "<plain-text definition>" } }`, inserted via
 * `textContent` — so the payload must be PLAIN text (markdown stripped) and keyed by
 * the same context/term the anchors carry. These tests pin: markdown stripping, the
 * global payload shape, byte-stable serialization, and the rehype `<script>` emit.
 */
import { describe, it, expect } from 'vitest';
import {
  stripMarkdown,
  buildDefinitionsPayload,
  serializeDefinitionsPayload,
  glossaryDefinitions,
} from '../lib/glossary/definitions-payload.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

const index: SharedTermIndex = {
  bySurface: new Map(),
  contexts: new Map([
    [
      'Zebra',
      {
        slug: 'zebra',
        terms: [{ name: 'Stripe', definition: 'A **bold** band, see [docs](https://x).' }],
        anchors: new Map([['Stripe', 'stripe']]),
      },
    ],
    [
      'Alpha',
      {
        slug: 'alpha',
        terms: [
          { name: 'Beta', definition: 'Uses `code` and _emphasis_.' },
          { name: 'Gamma', definition: 'Line one.\nLine two.' },
        ],
        anchors: new Map([
          ['Beta', 'beta'],
          ['Gamma', 'gamma'],
        ]),
      },
    ],
  ]),
};

describe('stripMarkdown', () => {
  it('drops emphasis/strong markers, keeping the text', () => {
    expect(stripMarkdown('A **bold** and _italic_ word.')).toBe('A bold and italic word.');
  });

  it('keeps link text but drops the URL', () => {
    expect(stripMarkdown('See [the docs](https://example.com).')).toBe('See the docs.');
  });

  it('keeps inline code and fenced code as plain text', () => {
    expect(stripMarkdown('Run `npm i` now.')).toBe('Run npm i now.');
  });

  it('collapses newlines/whitespace to single spaces', () => {
    expect(stripMarkdown('Line one.\n\nLine two.')).toBe('Line one. Line two.');
  });

  // Issue #16: the strip now parses through the SHARED gfm processor, so a
  // definition previews EXACTLY as it renders — gfm constructs no longer leak.
  it('drops gfm strikethrough markers, keeping the struck text', () => {
    expect(stripMarkdown('A ~~struck~~ word.')).toBe('A struck word.');
  });

  it('flattens a gfm table to clean text (no literal `|` runs)', () => {
    const table = '| A | B |\n| - | - |\n| 1 | 2 |';
    const out = stripMarkdown(table);
    // tableRow/tableCell are block boundaries, so cells separate with spaces and
    // the pipe delimiters never survive as literal text.
    expect(out).not.toContain('|');
    expect(out).toBe('A B 1 2');
  });
});

describe('buildDefinitionsPayload', () => {
  it('produces a global context → term → plain-text map (markdown stripped)', () => {
    const payload = buildDefinitionsPayload(index);
    expect(payload).toEqual({
      Alpha: { Beta: 'Uses code and emphasis.', Gamma: 'Line one. Line two.' },
      Zebra: { Stripe: 'A bold band, see docs.' },
    });
  });

  it('keys by the ORIGINAL-CASE context and CANONICAL term name (anchor parity)', () => {
    const payload = buildDefinitionsPayload(index);
    // The anchors carry data-glossary-context="Alpha" / data-glossary-term="Beta".
    expect(payload.Alpha?.Beta).toBeDefined();
  });
});

describe('serializeDefinitionsPayload', () => {
  it('is deterministic (byte-identical run-to-run) — dev-watcher idempotency', () => {
    expect(serializeDefinitionsPayload(index)).toBe(serializeDefinitionsPayload(index));
  });

  it('emits contexts in a stable name-sorted order', () => {
    const json = serializeDefinitionsPayload(index);
    // Alpha sorts before Zebra regardless of Map insertion order.
    expect(json.indexOf('"Alpha"')).toBeLessThan(json.indexOf('"Zebra"'));
  });
});

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

describe('glossaryDefinitions rehype plugin', () => {
  it('appends the payload <script> element to the page root', () => {
    const json = serializeDefinitionsPayload(index);
    const tree: HastNode = { type: 'root', children: [{ type: 'element', tagName: 'p' }] };
    glossaryDefinitions({ json })(tree);

    const script = tree.children?.[tree.children.length - 1];
    expect(script?.tagName).toBe('script');
    expect(script?.properties).toEqual({
      type: 'application/json',
      id: 'dk-glossary-definitions',
    });
    // JSON lands as a TEXT child (inert data, never executable), matching the
    // island's `textContent` read.
    expect(script?.children?.[0].type).toBe('text');
    expect(script?.children?.[0].value).toBe(json);
  });

  it('does not drop pre-existing content', () => {
    const tree: HastNode = { type: 'root', children: [{ type: 'element', tagName: 'p' }] };
    glossaryDefinitions({ json: '{}' })(tree);
    expect(tree.children).toHaveLength(2);
    expect(tree.children?.[0].tagName).toBe('p');
  });
});
