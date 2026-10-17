/**
 * Helpers shared by the integrations and by `defineDocKittyIntegrations`.
 *
 * A module that imports no integration module and nothing from `config.ts`, so
 * the integration modules and `config.ts` can both use it without a cycle.
 */
import path from 'node:path';
import process from 'node:process';
import type { IndexBasenameOption } from '../metadata.js';
import { draftRoutesOf } from '../draft-publication.mjs';

/**
 * The draft page routes of the site's docs tree (leading and trailing slash, no
 * base). `docsDir` is resolved against the working directory, like every other
 * docs-root read in this file; the walk and the draft rule are
 * {@link draftRoutesOf}'s, shared with the gate scripts. INV-1: a draft's URL
 * must not appear in the sitemap.
 */
export function siteDraftRoutes(docsDir: string, indexBasename?: IndexBasenameOption): Set<string> {
  return draftRoutesOf(path.resolve(process.cwd(), docsDir), indexBasename);
}

/**
 * Normalize an Astro `base` to a leading-slash, no-trailing-slash prefix.
 * `'/'` (or empty) → `''` (nothing to strip); `'/doc-kitty'`, `'doc-kitty'` and
 * `'/doc-kitty/'` all → `'/doc-kitty'`.
 */
export function normalizeBasePrefix(base: string): string {
  return ('/' + base + '/').replace(/\/{2,}/g, '/').replace(/\/$/, '');
}

/**
 * The shape of `DocKittyOptions['gherkin']` (see its documentation there). It
 * lives here, a leaf both `config.ts` and the gherkin integration can import,
 * so {@link resolveGherkinOptions} is typed precisely without importing `config.ts`.
 */
export type DocKittyGherkinOption =
  | true
| {
    /**
     * Render ```` ```gherkin ```` fences and `::gherkin{…}` includes on docs
     * pages (ADR-0051). Default `true`. `false` leaves fences as code blocks
     * and includes as literal text, so a generated-pages-only site
     * (`{ sources, fences: false }`) renders its authored pages unchanged.
     */
    fences?: boolean;
    /**
     * Directories an `::gherkin{src=…}` include may read from, relative to the
     * project root (`process.cwd()`). An include whose real path (symlinks
     * resolved) is outside every root is build-fatal. Default: `sources` when
     * set, else `[]` (every include is refused).
     */
    includeRoots?: string[];
    /**
     * Source directories, relative to the site root (`process.cwd()`), walked
     * for `*.feature`. Present ⇒ generated feature pages (ADR-0046); absent ⇒
     * none, and no `behaviour` sidebar section.
     */
    sources?: string[];
    /**
     * Section id (folder under `docsDir`) the pages are generated into.
     * Default `behaviour`. Only valid together with `sources`.
     */
    section?: string;
    /**
     * Optional repo browse-URL prefix (e.g. `https://github.com/o/r/blob/main/`),
     * prepended verbatim to the `sourceRoot`-relative source path to form each
     * generated page's `sources[0].resource` link and an include's source
     * link. Omitted → the bare relative path.
     */
    sourceUrlPrefix?: string;
    /**
     * Directory the reported source paths (`sources:` frontmatter, the agent
     * API, include source lines) are relative to, itself relative to the site
     * root. Default: the site root (`process.cwd()`). Set `'..'` when the site
     * lives in a sub-package and `sourceUrlPrefix` points at the repo root.
     */
    sourceRoot?: string;
    /**
     * Remove the generated pages when NONE of the `sources` yields a feature.
     * Default `false`: the build stops instead, because an uninitialised git
     * submodule looks exactly like "all features deleted". Set `true` to delete
     * the pages on purpose. Must be a boolean, and only valid together with
     * `sources` (build-fatal otherwise).
     */
    allowEmpty?: boolean;
    /**
     * Hub titles by source directory (#125): a key is a directory relative to
     * a source, as written on disk (`hr`, `shipping/edi`), and its value
     * replaces the humanised directory name as the hub's title, so the sidebar
     * group reads it too (`{ hr: 'HR' }` instead of "Hr"). A key that names no
     * directory holding a feature warns. Only valid together with `sources`.
     */
    titles?: Record<string, string>;
    /**
     * The Cucumber report whose results are shown next to every scenario the
     * site renders from a `.feature` file (ADR-0055): on generated feature
     * pages and in `::gherkin` includes, never on a ```` ```gherkin ```` fence.
     * Cucumber Messages (`--format message`, NDJSON) or Cucumber JSON
     * (`--format json`), read at build time; nothing is fetched or run.
     *
     * A path relative to the project root, or `{ report, root }` where `root`
     * is the directory Cucumber ran in (default the project root): the
     * report's relative `uri`s resolve against it, so a site that checks
     * another repository out into `vendor/x` sets `root: 'vendor/x'`.
     *
     * A missing report is a build warning locally (a local build has no CI
     * report) and build-fatal when the `CI` environment variable is set (not
     * empty, `false` or `0`), so a CI pipeline that forgot to produce the
     * report cannot publish a site without results. Set `required: false` to
     * keep it a warning in CI. One that cannot be read is build-fatal. Only statuses, counts, the run
     * date and the commit id reach a page.
     */
    results?: string | { report: string; root?: string; required?: boolean };
  };
