/**
 * `guardDeck` — the registration-site wrapper that makes a unified plugin a
 * no-op on Presentation (deck) pages (S-02, C36a/C36c/C36f).
 *
 * Applied at the Markua registration ARRAYS (`config.ts` remark `:604` / rehype
 * `:606`) via `[...].map(guardDeck)`, so deck-agnosticism is a property of array
 * membership, not of any individual transformer body. This closes the N-1 guard
 * hole permanently: a 6th pass added to either array is auto-guarded (and C36f
 * reds if it is added OUTSIDE `.map(guardDeck)`).
 *
 * NEVER wrap `deckSplit`/`deckSplitIntegration` (the deck processor) or the
 * unwrapped `remarkDirective` — both are out of scope by design.
 *
 * Transparency to the #35 parity enumerator (C36c/C-006): the wrapper preserves
 * the inner plugin's `name`/`displayName` and exposes `wrapped.__inner === plugin`,
 * so the S-03/S-04 classifier looks THROUGH the wrap and classifies the real
 * stage.
 */
import { isPresentationFile } from '../deck/is-presentation.js';

/** A unified transformer: `(tree, file)` — sync or promise (never callback). */
type UnifiedTransformer = (
  this: unknown,
  tree: unknown,
  file: unknown,
  ...rest: unknown[]
) => unknown;

/** A unified plugin attacher: called by unified to produce a transformer. */
type UnifiedPlugin = (this: unknown, ...options: unknown[]) => UnifiedTransformer | void;

/**
 * Wrap `plugin` so its transformer no-ops on a deck and delegates otherwise.
 *
 * The returned attacher, when unified calls it, builds the inner transformer and
 * returns a guarded transformer whose declared arity is 2 (`tree`, `file`), so
 * the pipeline runner treats it as sync/promise — matching all five Markua
 * passes, which are synchronous `(tree)`/`(tree, file)` transformers. On a deck
 * the guarded transformer returns the tree untouched; otherwise it forwards
 * every argument to the inner transformer unchanged.
 */
export function guardDeck<P>(plugin: P): P {
  const attacher = plugin as unknown as UnifiedPlugin;
  const guarded = function (this: unknown, ...options: unknown[]): UnifiedTransformer | void {
    const inner = attacher.apply(this, options);
    if (typeof inner !== 'function') return inner;
    return function transformer(
      this: unknown,
      tree: unknown,
      file: unknown,
      ...rest: unknown[]
    ): unknown {
      if (isPresentationFile(file as Parameters<typeof isPresentationFile>[0])) return;
      return inner.call(this, tree, file, ...rest);
    };
  };
  // Preserve identity so the parity enumerator (S-03/S-04) sees the real stage.
  Object.defineProperty(guarded, 'name', {
    value: (attacher as { name?: string }).name ?? '',
    configurable: true,
  });
  const displayName = (attacher as { displayName?: string }).displayName;
  if (displayName !== undefined) {
    (guarded as { displayName?: string }).displayName = displayName;
  }
  (guarded as unknown as { __inner: P }).__inner = plugin;
  return guarded as unknown as P;
}
