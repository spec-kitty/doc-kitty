/**
 * The docs:// resource surface (T017/T018; FR-011; contracts/mcp-surface.md
 * "Resources"): corpus pages and sections as MCP resources.
 *
 *   docs://<site-slug>/pages/<pageId>       the per-page artifact content
 *   docs://<site-slug>/sections/<sectionId> the section metadata document
 *
 * Registration shape (invoked once by optional.ts, T017):
 *
 *   - the resources capability is declared together with all three handlers
 *     (resources/list, resources/templates/list, resources/read) as ONE unit -
 *     the contract's degrade-loud rule: a capability without its handlers
 *     would silently drop calls;
 *   - resources/list emits every page (registry order) then every section
 *     (registry order) ONLY when pages.length <= config.resourceListingThreshold
 *     (default 1000, research R5). Above the threshold the list is EMPTY and
 *     read-by-URI keeps working - tool record outputs carry each page's `uri`
 *     for exactly that case (R4);
 *   - resources/templates/list advertises exactly the contract-pinned
 *     template `docs://<site-slug>/pages/{id}` in BOTH modes, so read-by-URI
 *     stays discoverable above the threshold;
 *   - resources/read resolves any minted docs:// URI string-exactly (prefix
 *     match against uris.ts mintings, so listed, templated and read forms can
 *     never drift apart). Unknown identities are PAGE_NOT_FOUND; a
 *     pages-family read on a pages-gated snapshot is PAGES_LINKS_GATED
 *     (get_page parity: the gate answer precedes identity resolution).
 *
 * Why low-level `server.server` handlers instead of McpServer.registerResource:
 * the SDK routes template reads by RFC 6570 expansion, and its `{id}` variable
 * does not cross '/' - corpus page ids NEST (`guides/getting-started`), so
 * SDK template routing provably fails read-by-URI for nested pages. The
 * low-level seam (setRequestHandler/registerCapabilities, already used by
 * server.ts for onclose) is the SDK's public escape hatch and keeps exact
 * control of the gated-empty list and the single pinned template string.
 *
 * Byte-projection (the FR-010 carve-out in contracts/mcp-surface.md):
 *
 *   - page bodies are the snapshot's raw artifact text VERBATIM. HTTPS mode:
 *     the adapter fetches without rewriting, so the body byte-equals the
 *     published artifact. fs mode: FsCorpusSource already applied the FR-007
 *     re-origining at load time - content fields byte-equal the disk
 *     artifact, exactly the link fields (links, source, url, _links) carry
 *     the documented rewrite. This module rewrites nothing;
 *   - section bodies are the section metadata document: the registry fields
 *     { id, label, order, purpose? } serialized as two-space JSON with the
 *     key order pinned by sectionDocument(); `purpose` is omitted when the
 *     registry omits it (never synthesized).
 *
 * Slug handling mirrors the tools (uris.ts): derived lazily and memoized, and
 * NEVER from a local directory path. A pageless filesystem corpus (fully
 * pages-gated, no refs to name an origin from) cannot mint any docs://
 * identity; that state degrades to empty listings and named read errors - the
 * announcement runs through get_site_info's capabilities, as pinned for
 * gated surfaces.
 *
 * Named errors over the wire: handlers throw plain Errors whose message
 * begins with the stable code ("PAGE_NOT_FOUND: ...") - the SDK forwards
 * error.message verbatim as a JSON-RPC error, mirroring runTool's
 * code-in-text convention for tool results.
 */
import type {
  ListResourcesResult,
  ListResourceTemplatesResult,
  McpServer,
  ReadResourceResult,
} from '@modelcontextprotocol/server';
import type { LaunchConfiguration } from '../cli.js';
import type { CorpusSnapshot, Section, SnapshotPage } from '../corpus/snapshot.js';
import { PageNotFoundError, PagesLinksGatedError } from '../errors.js';
import { corpusSiteSlug, pageUri, sectionUri } from './uris.js';

/** Page artifacts and section metadata documents are both JSON text. */
export const RESOURCE_MIME_TYPE = 'application/json';

/** The advertised template's stable name in resources/templates/list. */
export const PAGE_TEMPLATE_NAME = 'page';

/**
 * Register the resources capability and its three handlers. Called exactly
 * once per server, from registerOptionalSurfaces.
 */
export function registerResources(server: McpServer, snapshot: CorpusSnapshot, config: LaunchConfiguration): void {
  // Identity mintability (uris.ts, launch-mode aware): a pageless fs corpus
  // cannot mint docs:// identities; every listing/read path degrades instead
  // of falling back to the local directory. corpusSiteSlug is only consulted
  // when mintable, so its MALFORMED_CORPUS refusal cannot trip here.
  const mintable = config.source.kind === 'https' || snapshot.pages.length > 0;
  let memoSlug: string | undefined;
  const slug = (): string | undefined => {
    if (!mintable) return undefined;
    memoSlug ??= corpusSiteSlug(snapshot, config);
    return memoSlug;
  };

  const low = server.server;
  // Static snapshot: the listing can never change at runtime, and the server
  // sends no notifications/resources/list_changed.
  low.registerCapabilities({ resources: { listChanged: false } });

  low.setRequestHandler('resources/list', (): ListResourcesResult => {
    const current = slug();
    if (current === undefined || snapshot.pages.length > config.resourceListingThreshold) {
      return { resources: [] };
    }
    return {
      resources: [
        ...snapshot.pages.map((page) => pageResource(current, page)),
        ...snapshot.sections.map((section) => sectionResource(current, section)),
      ],
    };
  });

  low.setRequestHandler('resources/templates/list', (): ListResourceTemplatesResult => {
    const current = slug();
    return { resourceTemplates: current === undefined ? [] : [pageTemplate(current)] };
  });

  low.setRequestHandler('resources/read', (request) => readResource(snapshot, slug(), request.params.uri));
}

/**
 * One read, resolved string-exactly against the canonical mintings. The
 * family answer for a pages-gated snapshot precedes any identity work (tools
 * parity); every other failure is the PAGE_NOT_FOUND family, naming the URI
 * and (when mintable) the server's own slug.
 */
function readResource(snapshot: CorpusSnapshot, slug: string | undefined, uri: string): ReadResourceResult {
  if (isPagesFamilyUri(uri) && snapshot.pagesGated) {
    throwNamed(
      new PagesLinksGatedError(
        `${uri}: the corpus gates per-page artifacts off (no _links.self) - page resources are unavailable in this mode`,
      ),
    );
  }
  if (slug !== undefined) {
    const pagesPrefix = pageUri(slug, '');
    if (uri.startsWith(pagesPrefix)) {
      const id = uri.slice(pagesPrefix.length);
      const page = id.length === 0 ? undefined : snapshot.pages.find((p) => p.id === id);
      if (page !== undefined) {
        return { contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: page.raw }] };
      }
    }
    const sectionsPrefix = sectionUri(slug, '');
    if (uri.startsWith(sectionsPrefix)) {
      const id = uri.slice(sectionsPrefix.length); // the root section id is the well-known empty string
      const section = snapshot.sections.find((s) => s.id === id);
      if (section !== undefined) {
        return { contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: sectionDocument(section) }] };
      }
    }
  }
  throwNamed(
    new PageNotFoundError(
      slug === undefined
        ? `${uri}: this corpus cannot mint docs:// identities (${snapshot.pages.length} pages, ${snapshot.sections.length} sections)`
        : `${uri}: not a resource of this server (site ${slug}; ${snapshot.pages.length} pages, ${snapshot.sections.length} sections)`,
    ),
  );
}

/** docs://<anything>/pages[...] - the family parse that gates ahead of identity. */
function isPagesFamilyUri(uri: string): boolean {
  return /^docs:\/\/[^/]+\/pages(\/|$)/.test(uri);
}

/** resources/list entry for one page: name/description from the published record. */
function pageResource(slug: string, page: SnapshotPage): { uri: string; name: string; description: string; mimeType: string } {
  return {
    uri: pageUri(slug, page.id),
    name: page.title,
    description: page.description,
    mimeType: RESOURCE_MIME_TYPE,
  };
}

/** resources/list entry for one section; `description` only when the registry carries a purpose. */
function sectionResource(slug: string, section: Section): { uri: string; name: string; description?: string; mimeType: string } {
  return {
    uri: sectionUri(slug, section.id),
    name: section.label,
    ...(section.purpose === undefined ? {} : { description: section.purpose }),
    mimeType: RESOURCE_MIME_TYPE,
  };
}

/** The one contract-pinned template, advertised in both listing modes. */
function pageTemplate(slug: string): ListResourceTemplatesResult['resourceTemplates'][number] {
  return {
    name: PAGE_TEMPLATE_NAME,
    uriTemplate: pageUri(slug, '{id}'),
    title: 'DocKitty page',
    description:
      'One corpus page by id: docs://<site-slug>/pages/<pageId> - the byte-projected published page artifact. ' +
      'Resource listing may be size-gated off; this template keeps read-by-URI discoverable.',
    mimeType: RESOURCE_MIME_TYPE,
  };
}

/** The section metadata document: registry fields, pinned key order, two-space JSON. */
function sectionDocument(section: Section): string {
  return JSON.stringify(
    {
      id: section.id,
      label: section.label,
      order: section.order,
      ...(section.purpose === undefined ? {} : { purpose: section.purpose }),
    },
    null,
    2,
  );
}

/** Degrade loudly with the named taxonomy: the stable code leads the wire message. */
function throwNamed(error: PageNotFoundError | PagesLinksGatedError): never {
  throw new Error(`${error.code}: ${error.message}`);
}
