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
 * The page digest also covers CHANGELOG.md, so an incremental build or
 * `astro dev` re-renders the page when only CHANGELOG.md changes.
 *
 * `pnpm assert:changelog` (src/scripts/assert-changelog-page.mjs) fails the
 * build gate when a `## [x.y.z]` release of CHANGELOG.md is missing from it.
 */
import { readFileSync } from 'node:fs';
import type { Loader, LoaderContext } from 'astro/loaders';

export const CHANGELOG_MARKER = '<!-- dk:repo-changelog -->';

export interface RepoChangelogOptions {
  /** Absolute path of CHANGELOG.md. */
  changelogPath: string;
  /** Collection id of the page that shows it. */
  entryId: string;
  /** Prefix for repo-relative links, e.g. `https://github.com/o/r/blob/main/`. */
  repoBlobBase: string;
}

/** CHANGELOG.md as the page body: no H1, repo-relative links made absolute. */
export function changelogBody(raw: string, repoBlobBase: string): string {
  const base = repoBlobBase.endsWith('/') ? repoBlobBase : `${repoBlobBase}/`;
  return raw
    .replace(/^# [^\n]*\n+/, '')
    .replace(/\]\((?!https?:|mailto:|#|\/)(?:\.\/)?([^)\s]+)\)/g, (_m, target: string) => `](${base}${target})`);
}

export function withRepoChangelog(loader: Loader, options: RepoChangelogOptions): Loader {
  return {
    ...loader,
    load: async (context: LoaderContext): Promise<void> => {
      const raw = readFileSync(options.changelogPath, 'utf8');
      const body = changelogBody(raw, options.repoBlobBase);
      const { store, generateDigest } = context;
      const pending: Parameters<typeof store.set>[0][] = [];
      await loader.load({
        ...context,
        generateDigest: (data) =>
          generateDigest(typeof data === 'string' && data.includes(CHANGELOG_MARKER) ? `${data}\n${raw}` : data),
        store: {
          ...store,
          set: (entry) => {
            if (entry.id !== options.entryId) return store.set(entry);
            if (!entry.body?.includes(CHANGELOG_MARKER)) {
              throw new Error(
                `[changelog] ${options.entryId} must carry ${CHANGELOG_MARKER}; it is replaced by CHANGELOG.md.`,
              );
            }
            // `set` is synchronous; the page is rendered and stored after the load.
            pending.push({ ...entry, body });
            return true;
          },
        },
      });
      for (const entry of pending.splice(0)) {
        const rendered = await context.renderMarkdown(body);
        store.delete(entry.id);
        store.set({ ...entry, rendered });
      }
    },
  };
}
