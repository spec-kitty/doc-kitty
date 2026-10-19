/**
 * Renders the repository's CHANGELOG.md as the site's release-history page
 * (#192), so the changelog has ONE source and no hand-maintained copy.
 *
 * `example/docs/changelog/releases.md` is a real page (its frontmatter passes
 * every file-based gate) whose body carries `CHANGELOG_MARKER`. This wrapper
 * around the docs loader swaps that page's body for CHANGELOG.md at load time:
 *  - the leading `# Changelog` heading goes (the page has its own title);
 *  - repo-relative links (`docs/…`, `./…`) become GitHub URLs, because they
 *    name files of the repository, not pages of this site.
 * The page digest also covers CHANGELOG.md, so an incremental build
 * re-renders the page when only CHANGELOG.md changes; in `astro dev` the loader
 * watches CHANGELOG.md and re-renders the page on every edit.
 *
 * `pnpm assert:changelog` (src/scripts/assert-changelog-page.mjs) fails the
 * build gate when a `## [x.y.z]` release of CHANGELOG.md is missing from it.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Loader, LoaderContext } from 'astro/loaders';

export const CHANGELOG_MARKER = '<!-- dk:repo-changelog -->';

export interface RepoChangelogOptions {
  /** Absolute path of CHANGELOG.md. */
  changelogPath: string;
  /** Collection id of the page that shows it. */
  entryId: string;
  /** Prefix for repo-relative links, e.g. `https://github.com/o/r/blob/main/`. */
  repoBlobBase: string;
  /** Prefix for repo-relative images, e.g. `https://raw.githubusercontent.com/o/r/main/`; derived from `repoBlobBase` when omitted. */
  repoRawBase?: string;
}

// A code span (kept as is), or the `](target "title")` tail of an inline link
// or image whose target is repo-relative (rewritten).
const SPAN_OR_LINK_RE =
  /(`+)[^`][\s\S]*?\1|\]\(\s*(?!https?:|mailto:|#|\/)(?:\.\/)?([^)\s]+)((?:\s+(?:"[^"]*"|'[^']*'))?)\s*\)/g;
// A reference-style definition: `[label]: target "title"`.
const REF_DEF_RE = /^( {0,3}\[[^\]]+\]:\s*)(?!https?:|mailto:|#|\/)(?:\.\/)?(\S+)/;
const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE_RE = /^ {0,3}(`{3,}|~{3,})\s*$/;

export interface LinkBases {
  /** Prefix for links to repository files, e.g. `https://github.com/o/r/blob/main/`. */
  blob: string;
  /** Prefix for images, which must load as raw bytes, e.g. `https://raw.githubusercontent.com/o/r/main/`. */
  raw: string;
}

/** Whether the `]` at `closeAt` ends an image (`![alt]`) rather than a link text. */
function closesImage(line: string, closeAt: number): boolean {
  let depth = 0;
  for (let i = closeAt; i >= 0; i -= 1) {
    if (line[i] === ']') depth += 1;
    else if (line[i] === '[') {
      depth -= 1;
      if (depth === 0) return line[i - 1] === '!';
    }
  }
  return false;
}

/** Rewrites repo-relative links in one prose line, never inside a code span. */
function rewriteProse(line: string, bases: LinkBases): string {
  const def = REF_DEF_RE.exec(line);
  if (def) return `${def[1]}${bases.blob}${def[2]}${line.slice(def[0].length)}`;
  return line.replace(
    SPAN_OR_LINK_RE,
    (match, ticks: string | undefined, target: string | undefined, title: string | undefined, offset: number) => {
      if (ticks) return match;
      const base = closesImage(line, offset) ? bases.raw : bases.blob;
      return `](${base}${target}${title ?? ''})`;
    },
  );
}

/** `https://github.com/o/r/blob/ref/` -> `https://raw.githubusercontent.com/o/r/ref/`; anything else is kept. */
export function rawBaseFor(repoBlobBase: string): string {
  const m = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/([^/]+)\/?$/.exec(repoBlobBase);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/` : repoBlobBase;
}

const withSlash = (u: string): string => (u.endsWith('/') ? u : `${u}/`);

/**
 * CHANGELOG.md as the page body: no H1, repo-relative links made absolute
 * (images to raw URLs, everything else to blob URLs). Fenced code blocks and
 * inline code spans are left exactly as written.
 */
export function changelogBody(raw: string, repoBlobBase: string, repoRawBase?: string): string {
  const bases: LinkBases = {
    blob: withSlash(repoBlobBase),
    raw: withSlash(repoRawBase ?? rawBaseFor(repoBlobBase)),
  };
  let fence: string | null = null;
  return raw
    .replace(/^# [^\n]*\n+/, '')
    .split('\n')
    .map((line) => {
      if (fence) {
        const close = FENCE_CLOSE_RE.exec(line);
        if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
        return line;
      }
      const open = FENCE_OPEN_RE.exec(line);
      if (open) {
        fence = open[1];
        return line;
      }
      return rewriteProse(line, bases);
    })
    .join('\n');
}

export function withRepoChangelog(loader: Loader, options: RepoChangelogOptions): Loader {
  return {
    ...loader,
    load: async (context: LoaderContext): Promise<void> => {
      const { store, generateDigest, renderMarkdown, watcher } = context;
      const resolvedPath = path.resolve(options.changelogPath);
      // The page is rendered BEFORE the wrapped loader runs, so `set` (which is
      // synchronous) can store the finished entry at any time: during the load,
      // and later from a file watcher in `astro dev`, long after load() returned.
      let current = await renderChangelog(options, renderMarkdown);
      await loader.load({
        ...context,
        generateDigest: (data) =>
          generateDigest(typeof data === 'string' && data.includes(CHANGELOG_MARKER) ? `${data}\n${current.raw}` : data),
        store: {
          ...store,
          set: (entry) => {
            if (entry.id !== options.entryId) return store.set(entry);
            if (!entry.body?.includes(CHANGELOG_MARKER)) {
              throw new Error(
                `[changelog] ${options.entryId} must carry ${CHANGELOG_MARKER}; it is replaced by CHANGELOG.md.`,
              );
            }
            store.delete(entry.id);
            return store.set({ ...entry, body: current.body, rendered: current.rendered });
          },
        },
      });
      // CHANGELOG.md is outside the docs glob, so watch it ourselves: an edit
      // re-renders the page in `astro dev` without restarting the server.
      watcher?.add(resolvedPath);
      watcher?.on('change', async (changed: string) => {
        if (path.resolve(changed) !== resolvedPath) return;
        current = await renderChangelog(options, renderMarkdown);
        const existing = store.get(options.entryId);
        if (!existing) return;
        store.delete(options.entryId);
        store.set({
          ...existing,
          body: current.body,
          rendered: current.rendered,
          digest: generateDigest(`${CHANGELOG_MARKER}\n${current.raw}`),
        });
      });
    },
  };
}

async function renderChangelog(
  options: RepoChangelogOptions,
  renderMarkdown: LoaderContext['renderMarkdown'],
): Promise<{ raw: string; body: string; rendered: Awaited<ReturnType<LoaderContext['renderMarkdown']>> }> {
  const raw = readFileSync(options.changelogPath, 'utf8');
  const body = changelogBody(raw, options.repoBlobBase, options.repoRawBase);
  return { raw, body, rendered: await renderMarkdown(body) };
}
