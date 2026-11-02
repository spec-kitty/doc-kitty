/**
 * The five always-on discovery tools (contracts/mcp-surface.md "Tools"):
 *
 *   get_site_info    site identity + capability flags
 *   list_pages       page summary records, registry order, optional section filter
 *   get_page         one page, byte-projected from its per-page artifact
 *   search_pages     case-insensitive substring over title/description/keywords ONLY
 *   list_scenarios   the scenarios surface, passed through with nesting intact
 *
 * Invariants held here (WP03 squad pins):
 *
 *   - C-001 pass-through: no ranking, no scores, no derived content. Records
 *     are projected from the snapshot, never recomputed.
 *   - Registry order: the snapshot holds pages in index order; listing and
 *     search preserve it; search caps at 25 WITHOUT scoring (the cap is a
 *     prefix cut, not a relevance cut).
 *   - Degrade loudly: page-level calls against a pages-gated snapshot fail
 *     with the PAGES_LINKS_GATED named error, never with synthesized content.
 *   - Named taxonomy at the boundary: a thrown DocKittyMcpError is rendered
 *     as an MCP tool-error result whose text begins with the stable error
 *     code (the SDK forwards only `error.message` into the result, so the
 *     code travels inside the text). Unexpected exceptions rethrow to the
 *     SDK's own error envelope.
 *   - Result channels: object payloads travel as BOTH `structuredContent`
 *     and the JSON text block (identity shapes on every protocol era); array
 *     payloads travel as the JSON text block ONLY - the 2025-era wire wraps
 *     non-object structuredContent in a `{result: ...}` envelope, which would
 *     contradict the contract's bare-array shape, so arrays are emitted
 *     exactly once, as text.
 */
import { fromJsonSchema } from '@modelcontextprotocol/server';
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import type { LaunchConfiguration } from '../cli.js';
import type { CorpusSnapshot, SnapshotPage } from '../corpus/snapshot.js';
import { isDocKittyMcpError, PageNotFoundError, PagesLinksGatedError } from '../errors.js';
import { assertNonEmptyString } from './guards.js';
import { corpusSiteSlug, pageUri } from './uris.js';

/** search_pages emits at most this many records (C-001 prefix cut, no ranking). */
export const SEARCH_MATCH_CAP = 25;

/** get_site_info capabilities: which surfaces are live (all three surface flags are unconditional). */
interface SiteCapabilities {
  pages: boolean;
  scenarios: boolean;
  resources: boolean;
}

/** The list_pages / search_pages record shape (contract + the unconditional `uri`). */
interface PageSummary {
  id: string;
  section: string;
  title: string;
  description: string;
  keywords: string[];
  uri: string;
}

/** The five tool names, registration order = tools/list order, pinned by tests. */
export const TOOL_NAMES = ['get_site_info', 'list_pages', 'get_page', 'search_pages', 'list_scenarios'] as const;

/**
 * Register the five tools on the server. The corpus site slug is derived
 * lazily and memoized: a fully pages-gated fs corpus cannot mint docs://
 * URIs (no refs to derive the declared origin from) and must still serve
 * index-level tools, so slug derivation only ever runs on a path that has a
 * page to mint for.
 */
export function registerTools(server: McpServer, snapshot: CorpusSnapshot, config: LaunchConfiguration): void {
  let memoSlug: string | undefined;
  const slug = (): string => {
    memoSlug ??= corpusSiteSlug(snapshot, config);
    return memoSlug;
  };
  const summaryOf = (page: SnapshotPage): PageSummary => ({
    id: page.id,
    section: page.section,
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    uri: pageUri(slug(), page.id),
  });

  server.registerTool(
    'get_site_info',
    {
      title: 'Get site info',
      description:
        'Identity and capability flags of the loaded doc-kitty corpus: siteTitle, baseUrl, contractVersion, ' +
        'buildId (omitted on pre-FR-008 corpora), pageCount, and capabilities naming the live surfaces ' +
        '(pages, scenarios, resources). Gated surfaces are announced here (PAGES_LINKS_GATED), never hidden.',
    },
    () =>
      runTool(() => {
        const info = {
          siteTitle: snapshot.siteTitle,
          baseUrl: snapshot.baseUrl,
          contractVersion: snapshot.contractVersion,
          ...(snapshot.buildId === undefined ? {} : { buildId: snapshot.buildId }),
          pageCount: snapshot.pages.length,
          capabilities: siteCapabilities(snapshot),
        };
        return objectResult(info);
      }),
  );

  server.registerTool(
    'list_pages',
    {
      title: 'List pages',
      description:
        'Page summary records ({ id, section, title, description, keywords, uri }) in published registry ' +
        'order. Pass a section id to keep only that section. The site-root section carries the well-known ' +
        'empty id.',
      inputSchema: fromJsonSchema<{ section?: string }>({
        type: 'object',
        properties: {
          section: { type: 'string', description: 'Section id to filter by (the root section id is the empty string)' },
        },
        additionalProperties: false,
      }),
    },
    (args) =>
      runTool(() => {
        const pages = args.section === undefined ? snapshot.pages : snapshot.pages.filter((p) => p.section === args.section);
        return arrayResult(pages.map(summaryOf));
      }),
  );

  server.registerTool(
    'get_page',
    {
      title: 'Get one page',
      description:
        'One page record ({ id, title, description, links, uri, markdown }) byte-projected from the published ' +
        'per-page artifact. Unknown ids are PAGE_NOT_FOUND; when the corpus gates per-page artifacts off the ' +
        'call is PAGES_LINKS_GATED, never synthesized content.',
      inputSchema: fromJsonSchema<{ id: string }>({
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Page id as listed by list_pages (nested ids keep slashes; the home page is "home")' },
        },
        required: ['id'],
        additionalProperties: false,
      }),
    },
    (args) =>
      runTool(() => {
        assertNonEmptyString(args.id, 'get_page', 'arguments.id');
        const page = snapshot.pages.find((p) => p.id === args.id);
        if (page === undefined) {
          if (snapshot.pagesGated) {
            throw new PagesLinksGatedError(
              `arguments.id '${args.id}': the corpus gates per-page artifacts off (no _links.self) - page-level calls are unavailable in this mode`,
            );
          }
          throw new PageNotFoundError(
            `arguments.id '${args.id}': not present in the loaded snapshot (${snapshot.pages.length} pages)`,
          );
        }
        return objectResult({
          id: page.id,
          title: page.title,
          description: page.description,
          links: page.links,
          uri: pageUri(slug(), page.id),
          markdown: page.markdown,
        });
      }),
  );

  server.registerTool(
    'search_pages',
    {
      title: 'Search pages',
      description:
        'Case-insensitive substring match over the index title and description plus the per-page artifact ' +
        'keywords - never the markdown body. Matching records ({ id, section, title, description, keywords, ' +
        'uri }) come back in published registry order, at most 25, with no scores and no ranking.',
      inputSchema: fromJsonSchema<{ query: string }>({
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Case-insensitive substring matched against title, description and keywords' },
        },
        required: ['query'],
        additionalProperties: false,
      }),
    },
    (args) =>
      runTool(() => {
        assertNonEmptyString(args.query, 'search_pages', 'arguments.query');
        const needle = args.query.toLowerCase();
        const matches = snapshot.pages.filter((page) => matchesQuery(page, needle));
        return arrayResult(matches.slice(0, SEARCH_MATCH_CAP).map(summaryOf));
      }),
  );

  server.registerTool(
    'list_scenarios',
    {
      title: 'List behaviour scenarios',
      description:
        'The published Gherkin scenario index: { version, generated_from, count, results?, features[] } with ' +
        'each feature carrying its scenarios[] untouched (anchor, examples?, line, name, outline, result?, ' +
        'rule?, steps, tags). A site without the scenarios surface answers { available: false } - an ' +
        'unavailability statement, not an error.',
    },
    () =>
      runTool(() => {
        if (snapshot.scenarios === undefined) {
          return objectResult({ available: false });
        }
        const artifact = snapshot.scenarios.artifact;
        return objectResult({
          version: artifact.version,
          generated_from: artifact.generated_by,
          count: artifact.count,
          ...(artifact.results === undefined ? {} : { results: artifact.results }),
          features: artifact.features,
        });
      }),
  );
}

/** get_site_info's capability flags, announced the same way in every mode (degrade loudly). */
function siteCapabilities(snapshot: CorpusSnapshot): SiteCapabilities {
  return {
    pages: !snapshot.pagesGated,
    scenarios: snapshot.scenarios !== undefined,
    resources: true, // the resources surface registers in every mode; a gated/pageless corpus degrades to empty listings and named read errors (a live-but-degraded surface)
  };
}

/**
 * The search predicate (FR-004, C-001): case-insensitive substring over the
 * index title, the index description and the per-page artifact keywords -
 * NEVER the markdown body, and no scoring or ranking on the way out.
 */
function matchesQuery(page: SnapshotPage, lowercasedNeedle: string): boolean {
  return (
    page.title.toLowerCase().includes(lowercasedNeedle) ||
    page.description.toLowerCase().includes(lowercasedNeedle) ||
    page.keywords.some((keyword) => keyword.toLowerCase().includes(lowercasedNeedle))
  );
}

/**
 * Render one tool handler's named-error taxonomy as MCP tool-error results.
 * The SDK forwards only `error.message` into the wire result, so the stable
 * code leads the text ("PAGE_NOT_FOUND: ..."); unexpected exceptions rethrow.
 */
function runTool(run: () => CallToolResult): CallToolResult {
  try {
    return run();
  } catch (error) {
    if (isDocKittyMcpError(error)) {
      return { isError: true, content: [{ type: 'text', text: `${error.code}: ${error.message}` }] };
    }
    throw error;
  }
}

/** Object payloads: structured content AND the JSON text block carry the same object. */
function objectResult(payload: Record<string, unknown>): CallToolResult {
  return {
    structuredContent: payload,
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

/**
 * Array payloads: the JSON text block ONLY. See the module header - the
 * 2025-era wire would wrap non-object structuredContent in a `{result: ...}`
 * envelope, contradicting the contract's bare-array shape.
 */
function arrayResult(payload: readonly unknown[]): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}
