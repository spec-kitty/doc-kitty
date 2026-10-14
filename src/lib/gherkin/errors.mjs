/**
 * The process-wide ERROR SINK that makes in-page Gherkin errors build-fatal
 * (ADR-0051 decision 5; 02 §Making errors fatal; rendering contract 03 §5).
 *
 * WHY A SINK. Astro does not fail a build when a content entry fails to render:
 * the content-layer `glob()` loader renders each entry inside a `try`, logs
 * `Error rendering <entry>: <message>` and stores the entry with no rendered
 * HTML (`astro/dist/content/loaders/glob.js`, Astro 5.18). A remark stage that
 * only throws therefore builds an EMPTY page and the build exits 0. So the fence
 * stage (`../remark/gherkin-fence.ts`) does two things on a broken page:
 *
 *  1. {@link recordFatal} — records every fatal message of the page here;
 *  2. throws, so the page never renders half-transformed.
 *
 * The `doc-kitty:gherkin-fence` integration (`../config.ts`) then reads the sink
 * in `astro:build:done` and throws {@link formatFatal}'s aggregate, which is what
 * makes `astro build` exit non-zero. It calls {@link resetFatal} in
 * `astro:config:setup`, so a long-lived dev process (where nothing exits; the page
 * shows Astro's render error) does not carry errors across config reloads.
 *
 * WHY `globalThis`. The content-layer sync and `astro:build:done` run in the SAME
 * process, but not necessarily through the same module INSTANCE: Astro loads the
 * config (and with it this module, via the integration) through Vite's SSR module
 * loader, and the remark plugin is handed over by reference through
 * `markdown.remarkPlugins`. If this module were ever instantiated twice, a
 * module-level `Map` would split into two sinks, the stage would write one and
 * `astro:build:done` would read the other, empty one — a SILENT pass, the exact
 * failure this module exists to prevent. A `Symbol.for` key on `globalThis` is one
 * sink per process whatever the module graph does.
 *
 * ORDER. Pages render concurrently, so the order they reach the sink is not
 * stable. {@link listFatal} returns pages sorted by path (code unit), and each
 * page's messages in the order the stage recorded them, which is source order.
 * The aggregate is therefore deterministic.
 *
 * PURITY CONTRACT: imports only the import-free `./text.mjs` and the fs-free
 * `../vocabulary-core.mjs` (THE code-unit comparator). No fs, path or
 * `astro`/`@astrojs/*` (enforced by the import-scan table in
 * `gherkin-feature-core.test.ts`). The only state is the sink itself.
 *
 * TYPING: JSDoc only — the repo forbids `.d.ts` sidecars.
 *
 * @module gherkin/errors
 */

import { compareCodeUnit } from '../vocabulary-core.mjs';
import { GHERKIN_LOG_PREFIX } from './text.mjs';

/** The `globalThis` key of the one sink per process (see the module header). */
const SINK_KEY = Symbol.for('doc-kitty.gherkin.fatal');

/**
 * One page's fatal errors.
 *
 * @typedef {object} PageErrors
 * @property {string} page The page path as the stage displays it (cwd-relative, POSIX).
 * @property {string[]} messages Formatted `[dk-gherkin] <page>:<line>:<col> …`
 *   lines, in source order.
 */

/**
 * The sink: page path → its messages. Created on first use.
 *
 * @returns {Map<string, string[]>}
 */
function sink() {
  const g = /** @type {Record<symbol, Map<string, string[]> | undefined>} */ (
    /** @type {unknown} */ (globalThis)
  );
  let map = g[SINK_KEY];
  if (!map) {
    map = new Map();
    g[SINK_KEY] = map;
  }
  return map;
}

/**
 * Record a page's fatal errors, REPLACING anything recorded for that page
 * before: a page is rendered again in dev after an edit, and only its latest
 * render counts. An empty list clears the page (it now renders cleanly).
 *
 * @param {string} page
 * @param {readonly string[]} messages In source order.
 */
export function recordFatal(page, messages) {
  if (messages.length === 0) sink().delete(page);
  else sink().set(page, [...messages]);
}

/**
 * Every recorded page, sorted by path, each with its messages in source order.
 * A copy: mutating it does not touch the sink.
 *
 * @returns {PageErrors[]}
 */
export function listFatal() {
  return [...sink().entries()]
    .sort(([a], [b]) => compareCodeUnit(a, b))
    .map(([page, messages]) => ({ page, messages: [...messages] }));
}

/**
 * {@link listFatal}, then empty the sink.
 *
 * @returns {PageErrors[]}
 */
export function drainFatal() {
  const list = listFatal();
  resetFatal();
  return list;
}

/** Empty the sink (`astro:config:setup`, and between tests). */
export function resetFatal() {
  sink().clear();
}

/**
 * The one aggregated error text `astro:build:done` throws: a summary line, then
 * every message, pages in path order and messages in source order. Each message
 * already names its page and line, so no other grouping is printed.
 *
 * @param {readonly PageErrors[]} pages From {@link listFatal} / {@link drainFatal}.
 * @returns {string} `''` when there is nothing to report.
 */
export function formatFatal(pages) {
  const messages = pages.flatMap((p) => p.messages);
  if (messages.length === 0) return '';
  const n = pages.length;
  return [
    `${GHERKIN_LOG_PREFIX} ${messages.length} Gherkin error(s) on ${n} page${n === 1 ? '' : 's'}; ` +
      `${n === 1 ? 'it' : 'they'} rendered empty, so the build fails:`,
    ...messages,
  ].join('\n');
}
