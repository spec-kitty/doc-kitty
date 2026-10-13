---
affected_files: []
cycle_number: 1
mission_slug: generated-page-and-link-integrity-01M4VB0N
reproduction_command:
reviewed_at: '2026-10-13T20:53:58Z'
reviewer_agent: claude
wp_id: WP06
---

# WP06 review feedback (cycle 1) — changes requested

Reviewed commit `98e88b0` by reading and dry computation (the proof cannot run here). The fixture change itself is sound: routes are unchanged (14 before with `['README','index']`, 14 after with the default, same set), both links resolve (`/guides/` and `/rhetoric/introduction/#translators`), the strict source check exits 0 with drafts on and off, the two renames are 100% similarity, nothing outside `tests/consumption/` changed. Nothing found that would make the Consumption test fail on a correct toolkit.

The rejection is about three of the new assertions in `tests/consumption/scripts/assert-consumer-surfaces.mjs`: they collect hrefs from the WHOLE page, and the sidebar (present on every framed page) already carries the href they look for. They pass on a build that proves nothing.

Evidence: I ran the WP06 script against a fixture build made BEFORE this package (main checkout `tests/consumption/consumer-fixture/dist`, built 14:43 today, source without either relative link). Of the section-5 checks only the reference-style one failed. The inline-link check passed on a page whose source did not contain the link.

**Issue 1 (BLOCKER) — the inline-link assertion is vacuous.** `assert-consumer-surfaces.mjs:316-321`, entry `REWRITTEN_LINKS[0]` (`:64-69`). `hrefs.includes('/consumer-fixture/guides/')` is already true on `guides/getting-started/index.html` twice over: the sidebar entry (`<a href="/consumer-fixture/guides/" aria-current="false" ...>`) and the existing root-absolute `[Guides hub](/guides/)` in the same paragraph. It passes if the rewrite is off, or if it rewrites `./README.md` to a wrong page that exists. SC-003's inline form is then asserted by nothing in this script.
Fix: bind the assertion to the authored link by its text. Add a `text` field to each `REWRITTEN_LINKS` entry (`'index file'`, `'who translated the Rhetoric'`) and compare the href of that anchor:

```js
const m = new RegExp(`<a\\s[^>]*href="([^"]*)"[^>]*>${text}</a>`).exec(html);
check(m?.[1] === expected, `links: ${rel} — ${what} (authored "${authored}") is built as href="${expected}"`,
  m ? `found href="${m[1]}"` : `no <a> with text "${text}" in ${rel}`);
```

Authored body links are emitted as `<a href="…">text</a>` (seen in the earlier build: `<a href="/consumer-fixture/guides/">Guides hub</a>`). Do not fall back to "any href on the page" or "any href in <main>": the page's prev/next links can carry the same route.

**Issue 2 (MAJOR) — "a built page links a term" is satisfied by the sidebar.** `:299-305`. The regex makes the fragment optional (`(#[^"]*)?`), so the sidebar's `<a href="/consumer-fixture/glossary/rhetoric/">`, on every page outside `glossary/`, counts as a term link. `termLinks.length > 0` holds with the autolinker emitting nothing. Real term links always carry a fragment (`glossaryTermUrl` returns `${base}/glossary/${slug}/#${anchor}`; the earlier build has e.g. `href="/consumer-fixture/glossary/rhetoric/#dialectic"` in `rhetoric/book-one/chapter-01/`).
Fix: make the fragment mandatory, `(#[^"]+)`, and keep the rest. Optionally name the expected page in the message (`rhetoric/book-one/chapter-01`).

**Issue 3 (MAJOR) — "the hub links to each context" is satisfied by the sidebar.** `:287-295`. `hubHrefs` is taken from the whole of `glossary/index.html`; the sidebar lists `/consumer-fixture/glossary/rhetoric/` whenever the context page exists, so this check cannot fail independently of the existence check on `:290`. For the record, the hub's own links: the generator writes `- [rhetoric](./rhetoric/)` (`src/lib/glossary/generate.ts:158`), neither the rewrite (not a `.md` link) nor the base pass (not root-absolute) touches it, so the body href is the RELATIVE `./rhetoric/`; the Hub layout also renders a card `<a class="dk-hub__card" href="/consumer-fixture/glossary/rhetoric/">`. Both sit inside `<main`.
Fix: take the hub hrefs from the page content only and resolve them as a browser would, so either form is accepted and the sidebar is not:

```js
const mainAt = hubHtml.indexOf('<main');
const hubHrefs = [...(mainAt === -1 ? '' : hubHtml.slice(mainAt)).matchAll(/<a\s[^>]*href="([^"]*)"/g)]
  .map((m) => new URL(m[1], `https://x${BASE}/glossary/`).pathname);
```

and keep `hubHrefs.includes(route)`. Add a check that `mainAt !== -1`.

**Issue 4 (MINOR, fix while there).** `:282` reads context names with `/^ {2}- name:\s*(\S+)\s*$/` and uses the NAME as the folder. The folder is `slug(name)` (`src/lib/glossary/load.internal.ts:198`), and a name with a space does not match `\S+` and is dropped silently. Correct for today's single `rhetoric` context. Either assert the count against the context folders actually built under `dist/glossary/`, or say in the comment that names must be lower-case single words.

Not required: section 5 reads only the drafts-on build; the drafts-off build is covered by the built-link gate, and both linking pages are `doc_status: active`. The built-link gate does not check fragments, so the `#translators` assertion (which is sound) is the only fragment proof; keep it.
