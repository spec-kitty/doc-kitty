/**
 * Build state shared between DocKitty's integrations.
 *
 * Two kinds of state, with two owners:
 *
 *  1. **Per config: {@link createBuildState}.** `defineDocKittyIntegrations`
 *     creates ONE {@link BuildState} per call and hands it to the integrations
 *     that need it. The draft-publication integration writes the withheld drafts
 *     in its `astro:config:setup` hook; the route-shaping integration reads them
 *     when Vite loads `virtual:doc-kitty/route-shaping`. Nothing else holds them,
 *     and a second config gets its own object, so it cannot see the first one's.
 *
 *  2. **Per process: {@link shapingWarningSink}.** The route middleware runs in
 *     Astro's bundled prerender module and the integration's `astro:build:done`
 *     hook in the config module: two module instances in one process, so module
 *     state cannot carry the warnings between them. The sink is therefore the
 *     one `Symbol.for` channel on `globalThis`, and the only one in the shaping
 *     code. It belongs to the process, not to a config; the route-shaping
 *     integration clears it at the start of each build (`astro:config:setup`),
 *     so a second config in the same process starts empty.
 *
 * The module imports nothing, so the middleware bundle can load it.
 */

/** What the draft-publication integration resolved, for route shaping to read. */
export interface BuildState {
  /**
   * Directories (route slugs, no slashes) whose index page exists on disk but is
   * not published in this build.
   */
  unpublishedDirs: readonly string[];
  /** Docs-relative paths of the draft FILES withheld from this build. */
  unpublishedPaths: readonly string[];
}

/** A fresh, empty build state; one per `defineDocKittyIntegrations` call. */
export function createBuildState(): BuildState {
  return { unpublishedDirs: [], unpublishedPaths: [] };
}

/**
 * Key under which shaping warnings are collected on `globalThis` during a build.
 * A `Set` de-duplicates: every page shapes the same tree and would otherwise
 * repeat each warning once per page.
 */
const WARNING_SINK = Symbol.for('doc-kitty.route-shaping.warnings');

/** The per-process set of shaping warnings (created on first use). */
export function shapingWarningSink(): Set<string> {
  const store = globalThis as unknown as Record<symbol, Set<string> | undefined>;
  return (store[WARNING_SINK] ??= new Set<string>());
}
