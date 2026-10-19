/**
 * The Specification layout's header card model (gherkin-authoring-aids mission,
 * WP06: FR-014, FR-017; research R-08; contracts/specification-layout.md).
 *
 * Pure: decides what the card shows from the page frontmatter, so both source
 * forms and the degradation are unit-tested without a build
 * (src/tests/spec-card.test.ts).
 *
 * - **Tags**: the frontmatter `tags`, trimmed, blanks dropped. `@dk:*` / `dk:*`
 *   tags are filtered defensively (the generator already keeps them out).
 * - **Source**: `sources[0].resource`. The generator writes it as
 *   `sourceUrlPrefix + relative path` (the scenario index inverts exactly that,
 *   `routes/scenario-index.ts` `resolveSourcePath`). So an absolute `http:` or
 *   `https:` URL becomes a link whose text is the repository path; anything else
 *   — a relative path, or any other scheme such as `javascript:` — is plain text
 *   and never an href (security guard: only http/https are linked).
 *
 * With neither part there is no card (`null`), and the layout renders only its
 * slot, exactly like `Default`.
 */

/** The frontmatter slice the card reads. */
export interface SpecCardInput {
  tags?: readonly string[];
  sources?: ReadonlyArray<{ resource: string; title?: string }>;
}

/** The card's source: a link (`href` set, http/https only) or plain text. */
export type SpecCardSource = { text: string } | { href: string; text: string };

export interface SpecCard {
  /** Display tags; may be empty when only a source is shown. */
  tags: string[];
  /** Absent when the page cites no source. */
  source?: SpecCardSource;
}

const DK_TAG = /^@?dk:/i;

/** Hosting path forms that put the repository path after `/<verb>/<ref>/`. */
const REPO_PATH = /^\/(?:.+?\/)?(?:-\/)?(?:blob|raw|tree|src)\/[^/]+\/(.+)$/;

/** Readable text for a linked source: the repository path, else the URL path. */
function linkText(url: URL): string {
  let pathname = url.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep the encoded form when it is not valid percent-encoding.
  }
  const repo = REPO_PATH.exec(pathname);
  if (repo) return repo[1];
  const trimmed = pathname.replace(/^\/+/, '');
  return trimmed || url.host;
}

/** Resolve a resource to a link (http/https only) or plain text. */
function sourceOf(resource: string): SpecCardSource {
  const text = resource.trim();
  // Only an absolute URL with an explicit http(s) scheme qualifies; `URL`
  // normalises the scheme, so check the parsed protocol, not the raw string.
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return { href: url.href, text: linkText(url) };
      }
    } catch {
      // Unparseable: fall through to plain text.
    }
  }
  return { text };
}

/** The card for a Specification page, or `null` when it has nothing to show. */
export function specCard(data: SpecCardInput): SpecCard | null {
  const tags = (data.tags ?? []).map((t) => t.trim()).filter((t) => t !== '' && !DK_TAG.test(t));
  const resource = data.sources?.[0]?.resource?.trim();
  const source = resource ? sourceOf(resource) : undefined;
  if (tags.length === 0 && !source) return null;
  return source ? { tags, source } : { tags };
}
