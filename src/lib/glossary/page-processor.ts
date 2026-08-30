/**
 * `page-processor` — the ONE shared parse configuration the render-time re-derive
 * (issue #16) uses so its mdast tree matches the real build substrate.
 *
 * Two render-time re-derive sites parse a page's raw markdown outside the Astro
 * build: `OnThisPage.astro`'s `linksForBody` (the glossary "links used" re-derive)
 * and `definitions-payload.ts`'s `stripMarkdown` (the hover-preview plain-text
 * strip). Both previously built a BARE `remarkParse`, which diverges from the real
 * pipeline (see the glossary-integration docstring in `config.ts`) — Astro/Starlight
 * run remark-gfm + remark-smartypants BEFORE the pinned `remarkDirective →
 * glossaryTerm → glossaryAutolink`.
 *
 * SCOPE OF THE PARITY THIS DELIVERS. The factory attaches remark-gfm (a syntax
 * extension) and remark-smartypants (a transformer); the callers run BOTH phases —
 * `p.runSync(p.parse(md))` — so the tree handed to the downstream glossary passes
 * has gfm parsed AND smartypants applied, exactly the substrate the build pipeline
 * produces (issue #20):
 *   - remark-gfm is a syntax extension → it takes effect at `.parse()`: a gfm
 *     autolink literal like `cargo@x.com` is a `link` node (the autolinker guards
 *     it) instead of a TEXT node it would linkify into a phantom used-list entry;
 *     strikethrough / GFM tables parse as the build parses them.
 *   - remark-smartypants is a TRANSFORMER (mdast→mdast) → it runs at
 *     `.run()`/`.runSync()`. Because the callers `runSync` the parsed tree, it IS
 *     applied now: a surface key containing typographic punctuation (`'`, `--`,
 *     `...`) is curled by the build before autolinking AND by the re-derive, so the
 *     two agree. This closes the residual "curl phantom" issue #16 left open (a
 *     surface like `don't` / `Rock 'n' Roll` no longer produces a phantom used-list
 *     entry, and a straight-quote definition previews curled — preview↔render parity).
 *   - remark-directive contributes ONLY parse-phase extensions (micromark +
 *     fromMarkdown), no transformer, so `:term[...]{...}` is already a real
 *     `textDirective` node after `.parse()` and `runSync` leaves it intact for the
 *     `glossary-term` pass; smartypants curls the text inside the directive too,
 *     matching the build.
 *
 * This factory closes the gfm + smartypants gaps the same way the module closes the
 * "one shared matcher / one shared slug" gaps: a single construction site.
 *
 * gfm + smartypants are pinned to the versions Astro/Starlight resolve today
 * (remark-gfm 4.0.1 / remark-smartypants 3.0.3); treat an Astro major bump as a
 * checkpoint to re-pin them here (a version-drift guard is a tracked follow-up).
 * remark-mdx is DEFERRED (issue #16 reduced scope): the corpus has no `.mdx` pages,
 * so the MDX-expression phantom stays dormant — the reserved `mdx` option below
 * marks where it would slot in.
 *
 * PARITY IS ENFORCED, not by convention. Which build remark stages this factory
 * mirrors (and which are consciously NOT mirrored — the Markua passes, the diagram
 * passes, the glossary term/autolink passes, deck-split) is a STRUCTURAL guard:
 * `src/tests/glossary-substrate-parity.test.ts` enumerates the build's remark stack
 * and fails if any stage is neither mirrored here nor a keyed, justified conscious
 * exclusion, and a behavioural golden-tree catches a WRONG exclusion (issue #35,
 * contract C35). The durable single source that guard derives its `MIRRORED` set
 * from is {@link REDERIVE_REMARK_PLUGINS} below — this factory consumes the SAME
 * array, so the two cannot silently disagree.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkSmartypants from 'remark-smartypants';
import remarkDirective from 'remark-directive';

/** When a mirrored plugin is attached: always, or only under `opts.directive`. */
type RemarkPluginWhen = 'always' | 'directive';

/**
 * REDERIVE_REMARK_PLUGINS — the single, ordered source of truth for the build
 * remark stages the re-derive substrate replays, over the base `remarkParse`.
 *
 * `createPageProcessor` CONSUMES this array (it is not a doc comment), and the
 * parity guard (`glossary-substrate-parity.test.ts`) DERIVES its `MIRRORED` set
 * from the same array — never a hand-list — so what the substrate actually replays
 * and what the guard believes it replays cannot drift apart (issue #35 / D-1, C35,
 * S-04). Adding a mirror here automatically classifies the matching build stage as
 * `MIRRORED`; removing one demands a conscious exclusion or reds the guard.
 *
 * `always` plugins ride every processor; `directive` plugins are attached only when
 * the caller passes `{ directive: true }` (the "links used" re-derive needs
 * `:term[...]{...}` as a real `textDirective`; the definitions strip does not).
 */
export const REDERIVE_REMARK_PLUGINS: ReadonlyArray<{
  plugin: import('unified').Plugin;
  when: RemarkPluginWhen;
}> = [
  { plugin: remarkGfm, when: 'always' },
  { plugin: remarkSmartypants, when: 'always' },
  { plugin: remarkDirective, when: 'directive' },
];

/** Which optional passes the caller needs beyond the always-on gfm + smartypants. */
export interface PageProcessorOptions {
  /** Add `remarkDirective` so `:term[...]{...}` becomes a real `textDirective`
   * node (the "links used" re-derive needs it; the definitions strip does not). */
  directive?: boolean;
  /* mdx?: boolean — reserved; deferred with remark-mdx (issue #16 reduced scope). */
}

/**
 * Build the shared re-derive processor: `remarkParse` + `remarkGfm` +
 * `remarkSmartypants`, plus `remarkDirective` when `opts.directive` is set. Callers
 * run BOTH phases — `const tree = p.runSync(p.parse(markdown))` — to get the build
 * substrate's mdast with gfm parsed AND smartypants applied, then run the downstream
 * glossary transforms over that tree. Running `runSync` (not `.parse()` alone) is
 * what delivers smartypants parity — see the module note (issue #20).
 */
export function createPageProcessor(opts: PageProcessorOptions = {}) {
  // Consume the single REDERIVE_REMARK_PLUGINS source (never an inline list), so
  // this factory and the parity guard share one authority (issue #35 / D-1).
  // Applied as one PluggableList after the base parser — same runtime pipeline as
  // the former `.use(gfm).use(smartypants)[.use(directive)]` chain.
  const plugins = REDERIVE_REMARK_PLUGINS.filter(
    ({ when }) => when === 'always' || (when === 'directive' && opts.directive),
  ).map(({ plugin }) => plugin);
  return unified().use(remarkParse).use(plugins);
}
