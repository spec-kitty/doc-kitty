# Quickstart — Glossary + Contextive (M4)

Two audiences: an **author** maintaining vocabulary, and a **consumer** wiring the toolkit.

## Author: add a term, get pages + auto-links

1. Create `.contextive/definitions.yaml` (Contextive Community format):

   ```yaml
   contexts:
     - name: shipping
       domainVisionStatement: The cargo booking and routing domain.
       terms:
         - name: cargo
           definition: A **shipment** booked for carriage between two locations.
           aliases: [consignment]
           examples: ["A container of coffee from Santos to Rotterdam."]
         - name: policy
           definition: A routing rule constraining how cargo may travel.
     - name: hr
       terms:
         - name: policy
           definition: An HR rule governing employee conduct.
   ```

2. Build. You get `/glossary/` (hub) and `/glossary/shipping/`, `/glossary/hr/`, each term at
   `#<slug>` — and every generated page appears in the sidebar, sitemap, agent API, and
   `llms.txt` (they are real files under `docs/glossary/`).

3. On any page, the first eligible mention of "cargo" (or "Cargo", or the alias
   "consignment") per H2 section auto-links to its definition; hovering shows the definition;
   clicking opens it in a new tab.

4. **Scope a page** so collisions resolve. `policy` is defined twice, so on a page about HR:

   ```yaml
   ---
   title: Leave policy
   glossary_context: hr
   ---
   ```

   Now "policy" links to `hr`. Without `glossary_context`, "policy" stays plain text and the
   build logs `[glossary] unresolved collision "policy" in hr, shipping — left unlinked`
   (build still succeeds).

5. **Escape hatches**:
   - Force a link: `:term[policy]{context=hr}` (works in plain `.md`).
   - Suppress one: `:term[policy]{link=false}`.
   - Opt a whole page out: `glossary_autolink: false`.
   - Silence a noisy common word globally: add it to the ignore-list.

6. The **"On this page" block** appears below the content, listing the page's external
   references, related pages, and the glossary links it used (each present with JS off).

## Consumer: wire the toolkit

`.contextive/definitions.yaml` presence is the only switch — no config flag. The glossary
seam is wired by the single integration owner; a site with no definitions file is
byte-identical to before M4. To relocate the glossary out of the default **Reference** nav
group, edit `docs/_meta/sections.yaml` — no content or theme change.

## Verify (the acceptance surface)

- `pnpm test` (vitest): loader/validation, resolver collision/alias/anchor, section-walk,
  `:term`, scheme-check.
- `pnpm --filter example build`: browser-free; generates `docs/glossary/**`; a malformed
  fixture build fails naming the offending field.
- `pnpm test:a11y` (Playwright, pinned container for baselines): the glossary demonstrator
  passes axe in both colour modes; the hover preview satisfies 1.4.13 (hoverable, Esc,
  persistent); the non-vacuity gate asserts ≥1 auto-link + ≥1 `:term`-resolved collision
  before the scan; the footprint twin proves a glossary page requests the preview chunk and a
  control route does not.
