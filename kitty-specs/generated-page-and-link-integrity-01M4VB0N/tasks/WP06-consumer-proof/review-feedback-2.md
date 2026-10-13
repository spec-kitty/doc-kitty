# WP06 review feedback (cycle 2) — one change requested

Reviewed rework commit `2ffdadb` by running the script against scratch copies of the pre-package fixture build and hand-edited variants. Assertions A (link bound to anchor text), B (mandatory fragment) and D (definitions vs built folders) are sound: each fails on the broken build it targets and passes on a simulated correct build. No way found for any of them to fail on a correct build ("index file" and "who translated the Rhetoric" contain no glossary surface, no quotes, and sit on one source line; body anchors are emitted bare as `<a href="…">text</a>`). Do not change A, B or D.

**Issue 1 (MAJOR, the only one) — assertion C, "the hub page content links to each context", is still vacuous.** `tests/consumption/scripts/assert-consumer-surfaces.mjs:306-310`. The slice `hubHtml.slice(mainAt)` runs from `<main` to the end of the document, and Starlight renders its page footer INSIDE `<main>`: the previous/next pagination. On `glossary/index.html` the next page in sidebar order is the context page, so the slice always contains

```html
<footer class="sl-flex …"> … <a href="/consumer-fixture/glossary/rhetoric/" rel="next" class="…">
```

Demonstrated: on a build where the hub's body link (`<a href="./rhetoric/">`) and the card link (`<a class="dk-hub__card" href="/consumer-fixture/glossary/rhetoric/">`) were both removed and the sidebar left alone, the check on `:314-318` PASSED. It failed only after the `rel="next"` anchor was removed as well. (The cycle-1 feedback suggested the `<main`-onward slice; that suggestion was incomplete, the footer was not accounted for.)

Fix: end the slice at Starlight's page footer, the first `<footer` after `<main`. In the built hub everything that is page content (the `sl-markdown-content` body and the `dk-hub` card section) precedes it; the pagination and the site footer follow it. Replace `:308-310` with:

```js
const footerAt = mainAt === -1 ? -1 : hubHtml.indexOf('<footer', mainAt);
check(footerAt !== -1, 'glossary: the hub page has a <footer> after its content', `no "<footer" after "<main" in ${hubPage}`);
const hubContent = mainAt === -1 || footerAt === -1 ? '' : hubHtml.slice(mainAt, footerAt);
const hubHrefs = [...hubContent.matchAll(/<a\s[^>]*href="([^"]*)"/g)].map(
  (m) => new URL(m[1], `https://x${BASE}/glossary/`).pathname,
);
```

and update the comment on `:302-305` to say the slice stops before the page footer because the previous/next links there carry the context route. Verified with exactly this patch on scratch copies: the simulated correct build passes; the build with body and card links removed now fails with "resolved <main> links under /consumer-fixture/glossary/: none"; every other variant behaves as before. Reword the failure detail from "inside <main>" to "in the page content (between <main and the page footer)".

Nothing else needs to change. Only this script should be touched.
