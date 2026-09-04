# Contracts — diagram-component-css

This mission changes DOM structure and CSS-delivery, not an API surface, so the
"contracts" are the DOM + delivery invariants asserted by the gates. See
[`../data-model.md`](../data-model.md) for the authoritative shapes:

- **Diagram figure DOM**: `<figure class="dk-diagram">` is a block child of its
  section with **no `<pre>` ancestor** (asserted by `assert:artifacts` across all
  3 diagram pages + the `diagram-pipeline` unit).
- **Component CSS delivery**: a branded docs page and an out-of-frame deck both
  ship `.dk-callout` and `.dk-diagram__caption` rules (asserted bundled AND
  linked; computed-style verified on both shells).
