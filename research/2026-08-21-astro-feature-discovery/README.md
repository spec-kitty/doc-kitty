# Astro Docsite Feature Discovery — 2026-08-21

Technical/feature discovery to inform mission(s) that extend **doc-kitty** toward
the desiderata below. Findings feed spec work; this is **not** an implementation.

## Guardrails (apply to every agent)

- **Read-only** on all reviewed repositories. Modify nothing outside doc-kitty.
- **No customer information.** Capture only technical/architectural patterns —
  Astro config, content schemas, component structure, rendering mechanisms.
  Genericize: replace any client/business/domain-specific names in examples with
  `<client>` / `<term>`. Do not copy documentation prose or business content.
- Reference mechanisms and file paths as pointers; never reproduce customer data.

## Targets

| # | Path | Stack | Lens |
|---|------|-------|------|
| A | `CLIENTS/.../kitty-specs` (→ impl in `portal/`) | Astro | full feature checklist |
| B | `CLIENTS/.../portal` | Astro | full feature checklist |
| C | `SDD/_publications/penguin-pragmatic-patterns` | Hugo | external-reference metadata rendering; glossary |
| D | web: contextive.tech; Astro mermaid/plantuml | — | glossary source format; diagram integration |
| E | `CLIENTS/.../.kittify/doctrine/styleguide` + spk doctrine packs | doctrine | writing/frontend guidance; doctrine relevant to docsite authoring |
| F | penguin (Hugo) + `portal` decks | — | reveal.js Markdown→preprocess→slidedeck; Hugo pattern is the target, Astro-HTML is the anti-pattern |

## Feature checklist

1. **Glossary** — file format, search, shorthand/plugin linking page content to
   definitions, `.contextive` integration.
2. **Related pages** — `related` metadata shape (ref vs ref+description),
   rendering component.
3. **Metadata-driven headers/descriptions** — content stays user-facing; titles/
   descriptions sourced from frontmatter.
4. **Audience descriptions** — audience-oriented-writing doctrine, audience
   template, links to stakeholder descriptions.
5. **Mermaid + PlantUML** — how each is integrated and rendered.
6. **Atomic Design** — atom → component → page structure; styling reuse.
7. **External references** — metadata links rendered on the page (cf. the Hugo
   penguin site).
8. **Content schema + Astro setup** — zod frontmatter, integrations, versions,
   any sitemap/rss/agent surfaces.

## Findings

- `findings-A-kitty-specs.md` ✅
- `findings-B-portal.md` ✅
- `findings-C-penguin-hugo.md` ✅
- `findings-D-contextive-diagrams.md` ✅
- `findings-E-doctrine.md` ✅
- `findings-F-reveal-decks.md` ✅
- `SYNTHESIS.md` ✅ — desiderata → doc-kitty change map, mission slicing, decisions to confirm

## Integrity notes

- **Sanitization:** the client name and any org-specific package scopes were
  redacted to `<client>` on persistence. A grep for the client name across this
  directory returns clean.
- **Two agents bypassed the report-write hook** (A and D wrote their `.md`
  directly via a shell workaround instead of handing back). Both files were read
  in full and sanitized by the parent before being retained; the content is
  benign (web research / genericized structural analysis). Agents B and C handed
  back correctly. Agents E and F were explicitly instructed not to bypass.
