/**
 * The opt-in Markua integration (ADR-0030). Moved out of `config.ts` verbatim
 * (#115); imports only leaf modules, never `../config`.
 */
import type { AstroIntegration } from 'astro';
import markuaNormalise from '../remark/markua-normalise.js';
import markuaFootnotes from '../remark/markua-footnotes.js';
import markuaAttributes from '../remark/markua-attributes.js';
import markuaCallouts from '../remark/markua-callouts.js';
import markuaFigure from '../rehype/markua-figure.js';
import markuaTocDemote from '../rehype/markua-toc-demote.js';
import { guardDeck } from '../markua/deck-guard.js';

/**
 * The opt-in Markua seam, registered ONLY when `defineDocKittyIntegrations({
 * markua: true })` (FR-011, ADR-0030). It wires the full Markua pipeline the
 * approved WP02/03/04/06/07 plugins compose:
 *   - **remark** (AFTER the shared `remarkDirective` owner, PINNED order):
 *     `markuaNormalise` (compiles `A>`/`W>`… line-prefix runs and `{aside}`/
 *     `{blurb}` wrappers into `containerDirective` nodes) → `markuaAttributes`
 *     (attaches `{…}` attribute lists to their target) → `markuaCallouts` (routes
 *     each container to its native-aside or theme-callout emission). This runs
 *     BEFORE Starlight's own `remarkAsides` — see the prepend note below.
 *   - **rehype** (USER stage, BEFORE Astro's built-in `rehypeImages` /
 *     `rehypeHeadingIds`): `markuaFigure` (wraps each image in an accessible
 *     `<figure>` reading the `hProperties` `markuaAttributes` wrote) and
 *     `markuaTocDemote` (keeps a figure/aside heading out of the on-page ToC).
 *     Running before `rehypeHeadingIds` lets an explicit `{#id}` win — that pass
 *     only slugs a heading with NO id already set (C-005, proven in WP09).
 *
 * FORWARD RULE: any surface that re-derives from the RAW `entry.body` string
 * (raw `A>`/`{blurb}`/`{…}` lines read as literal text there) must replay this
 * Markua normalisation before deriving. This is no longer enforced by prose:
 * the re-derive-parity guard (`glossary-substrate-parity.test.ts`, S-04) is the
 * authority — it reds if a build remark stage is not mirrored or consciously
 * excluded, so prose and gate cannot drift.
 */
export function markuaIntegration(): AstroIntegration {
  return {
    name: 'doc-kitty:markua',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          markdown: {
            // Remark (after `remarkDirective`): normalise → attributes → callouts.
            // Registered BARE (#47, FR-003/FR-006): each of the four content
            // passes is now intentionally deck-capable — `markuaNormalise`
            // terminates a wrapper at a slide boundary instead of swallowing it
            // (D3/C-COMPOSE-03), `markuaAttributes` is boundary-safe by
            // construction (D2), and `markuaCallouts` forces the self-contained
            // `dk-callout` theme path on a deck (D5/C-COMPOSE-04) — their
            // deck-safety is proven by their own unit tests, not by a
            // registration-site guard. `deckSplit`/`remarkDirective` are NEVER
            // wrapped — both are out of scope for this guard by design.
            // `markuaFootnotes` sits AFTER `markuaNormalise`, BEFORE
            // `markuaAttributes` (ADR-0041, contract `footnote-feature.md`): it
            // normalises the double-caret footnote nodes `remark-gfm` already
            // parsed (`[^^N_M]` → clean id `N_M`, stripping the `^` that would
            // URL-encode into anchors as `%5E`). It is `guardDeck`-wrapped —
            // footnotes are deck-agnostic in v1, so it no-ops on a deck (mirrors
            // `markuaTocDemote`, the only other deck-agnostic Markua pass). Gated
            // by `markuaActive` like the rest: preset-off it is never registered,
            // so output stays byte-identical (NFR-001).
            remarkPlugins: [
              markuaNormalise,
              guardDeck(markuaFootnotes),
              markuaAttributes,
              markuaCallouts,
            ],
            // Rehype (user stage, before `rehypeImages`/`rehypeHeadingIds`).
            // `markuaFigure` is also registered BARE (D4/C-COMPOSE-05): it wraps
            // every slide body image as a `dk-figure` and skips only the
            // `data-deck-hero`-tagged synthesized title-slide hero via its own
            // structural discriminator. `markuaTocDemote` stays `guardDeck`-wrapped
            // (D6/C-COMPOSE-06): a deck has no on-page ToC, so the pass has
            // nothing to do there — this is the retained predicate/wrapper proof
            // (FR-006) for the one pass that stays deck-agnostic.
            rehypePlugins: [markuaFigure, guardDeck(markuaTocDemote)],
          },
        });
      },
    },
  };
}
