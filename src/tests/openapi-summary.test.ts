/**
 * The OpenAPI summary Markdown (mission openapi-second-slice-01M6WXJ4, WP02;
 * FR-002/FR-004 via contracts/synthetic-entry.md; FR-028).
 *
 * `openApiSummaryMarkdown` is the ONE function behind both the agent page's
 * `markdown` field and the OKF file body (WP03/WP12 read it), so they cannot
 * drift. `flattenText` and `escapeMdLink` are the shared escaping helpers every
 * DocKitty-owned output of spec-derived text uses (WP04/WP07 included).
 *
 * Every case here is titled `[WP02]`: red until this work package lands.
 */
import { describe, expect, it } from 'vitest';
import { escapeMdLink, flattenText, openApiSummaryMarkdown } from '../lib/openapi/summary.mjs';
import type { OpenApiPublicationVersion } from '../lib/openapi/publication.js';
import { openApiLlmsLines } from '../lib/openapi/llms.js';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/** A publication version as WP02 materialises it, with the contract's shape. */
function version(over: Partial<OpenApiPublicationVersion> = {}): OpenApiPublicationVersion {
  return {
    label: 'v1',
    released: true,
    ext: 'yaml',
    sha256: 'a'.repeat(64),
    title: 'Parcels API',
    apiVersion: '1.0.0',
    operations: [
      { method: 'GET', path: '/parcels', summary: 'List parcels', slug: 'operations/listparcels' },
      { method: 'POST', path: '/parcels', operationId: 'createParcel', slug: 'operations/createparcel' },
      { method: 'DELETE', path: '/parcels/{parcelId}', slug: 'operations/deleteparcel' },
    ],
    rawRoute: '/reference/api/v1/openapi.yaml',
    ...over,
  };
}

describe('openApiSummaryMarkdown (contracts/synthetic-entry.md)', () => {
  it('[WP02] renders the contract markdown: title and label, the four meta lines, the operations header, one line per operation', () => {
    expect(openApiSummaryMarkdown(version(), '/reference/api/v1/openapi.yaml')).toBe(
      [
        '# Parcels API v1',
        '',
        '- Released: yes',
        '- API version: 1.0.0',
        '- Raw document: /reference/api/v1/openapi.yaml',
        `- sha256: ${'a'.repeat(64)}`,
        '',
        '## Operations',
        '',
        '- GET /parcels: List parcels',
        '- POST /parcels: createParcel',
        '- DELETE /parcels/{parcelId}',
      ].join('\n') + '\n',
    );
  });

  it('[WP02] marks an unreleased version', () => {
    const markdown = openApiSummaryMarkdown(version({ released: false }), '/x');
    expect(markdown).toContain('- Released: no');
  });

  it('[WP02] keeps the operations header with zero operations, and no operation lines', () => {
    const markdown = openApiSummaryMarkdown(version({ operations: [] }), '/x');
    expect(markdown).toContain('## Operations');
    expect(markdown).not.toMatch(/^- [A-Z]+ \//m);
    expect(markdown.endsWith('## Operations\n')).toBe(true);
  });
});

describe('flattenText and escapeMdLink (FR-028)', () => {
  it('[WP02] flattenText collapses every whitespace run to one space and trims', () => {
    expect(flattenText('a\n\nb \t c\r\nd')).toBe('a b c d');
    expect(flattenText('  ')).toBe('');
  });

  it('[WP02] escapeMdLink backslash-escapes the Markdown link syntax characters', () => {
    expect(escapeMdLink('a](b)c[')).toBe('a\\]\\(b\\)c\\[');
    expect(escapeMdLink('plain')).toBe('plain');
  });
});

describe('hostile spec strings (FR-028, the hostile fixture contract)', () => {
  it('[WP02] flattens and escapes the title, paths and summaries; label, sha256 and raw URL stay raw', () => {
    const hostile = version({
      title: 'Hostile <script>alert(1)</script> API',
      operations: [
        {
          method: 'GET',
          path: '/parcels',
          summary: 'List <script>alert(1)</script>\nparcels',
          slug: 'operations/listparcels',
        },
        {
          method: 'POST',
          path: '/parcels',
          summary: 'Create a ](javascript:alert(2)) parcel',
          slug: 'operations/createparcel',
        },
      ],
    });
    const markdown = openApiSummaryMarkdown(hostile, '/reference/api/v1/openapi.yaml');
    // Flattened to one line, never a raw newline inside a field.
    expect(markdown).toContain('# Hostile \\<script\\>alert\\(1\\)\\</script\\> API v1\n');
    expect(markdown).toContain('- GET /parcels: List \\<script\\>alert\\(1\\)\\</script\\> parcels\n');
    // Link syntax escaped with a backslash, so no Markdown link can be injected.
    expect(markdown).toContain('- POST /parcels: Create a \\]\\(javascript:alert\\(2\\)\\) parcel\n');
    expect(markdown).not.toMatch(/[^\\]\]\(/);
    // Not escaped: these three are toolkit-produced, not spec-derived.
    expect(markdown).toContain(`- sha256: ${'a'.repeat(64)}`);
    expect(markdown).toContain('- Raw document: /reference/api/v1/openapi.yaml');
    expect(markdown).toContain(' API v1\n');
  });
});

interface MdNode {
  type: string;
  children?: MdNode[];
  position?: { start: { offset?: number } };
}

/**
 * The node types of a parsed Markdown document. A `link` counts only when it was
 * written with link syntax (`[..](..)` or `<..>`): a GFM bare-URL autolink of
 * plain text is allowed to stay.
 */
function nodeTypes(markdown: string): Set<string> {
  const types = new Set<string>();
  const visit = (node: MdNode): void => {
    const first = markdown[node.position?.start.offset ?? -1];
    if (node.type !== 'link' || first === '[' || first === '<') types.add(node.type);
    for (const child of node.children ?? []) visit(child);
  };
  visit(unified().use(remarkParse).use(remarkGfm).parse(markdown) as MdNode);
  return types;
}

describe('escaping survives a Markdown parse (FR-028)', () => {
  const hostile = [
    '\\[x\\]\\(https://e\\)',
    '<https://e/a>',
    '<a href="x">y</a>',
    '[x](https://e)',
    '`code`',
    '\\',
  ];
  const expectInert = (markdown: string, text: string): void => {
    const types = nodeTypes(markdown);
    expect(types.has('link'), text).toBe(false);
    expect(types.has('html'), text).toBe(false);
    expect(types.has('inlineCode'), text).toBe(false);
  };

  it('[escape] spec-derived titles, paths, summaries and versions never become a link or html node', () => {
    for (const text of hostile) {
      const markdown = openApiSummaryMarkdown(
        version({
          title: text,
          apiVersion: text,
          operations: [{ method: 'GET', path: text, summary: text, slug: 'operations/x' }],
        }),
        '/reference/api/v1/openapi.yaml',
      );
      // The raw-document line is toolkit-produced (a bare route), not spec text.
      expectInert(
        markdown
          .split('\n')
          .filter((line) => !line.startsWith('- Raw document'))
          .join('\n'),
        text,
      );
    }
  });

  it('[escape] escapeMdLink escapes the backslash first, then angle brackets and backticks', () => {
    expect(escapeMdLink('\\[')).toBe('\\\\\\[');
    expect(escapeMdLink('<a>`')).toBe('\\<a\\>\\`');
  });

  it('[escape] the llms.txt operation lines apply the same escaping', () => {
    for (const text of hostile) {
      const lines = openApiLlmsLines(
        {
          section: 'reference/api',
          llmsOperations: true,
          versions: [version({ operations: [{ method: 'GET', path: text, summary: text, slug: 'operations/x' }] })],
        },
        () => 'https://d.example/openapi.yaml',
      );
      // Line 0 is the toolkit's own `[label](url)` link; the rest is spec text.
      expectInert(lines.slice(1).join('\n'), text);
    }
  });
});
