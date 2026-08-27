# Contract — Auto-link plugin + `:term` directive

**Owners**: IC-04 `src/lib/remark/glossary-autolink.ts`, IC-05 `src/lib/remark/
glossary-term.ts`. ADR-0027 (AS-1/AS-2). Plugin order owned by IC-08 (config.ts).

## Pinned plugin order (config.ts, `updateConfig` append)

```
remark-gfm (Astro built-in) → remarkDirective → glossary-term → glossary-autolink
```

## Auto-link plugin (IC-04)

The emitted **link node** (shared with `:term`):
```
link → /glossary/<context>/#<anchor>
  properties: target="_blank", rel="noopener",
              data-glossary-term=<termName>, data-glossary-context=<context>
```

Rules (unit-tested):
1. **Section model** (FR-005): an H2 starts a section; body before the first H2 is one
   implicit section; H3+ belong to their parent H2. Link the **first eligible** occurrence
   of each distinct surface **per section**.
2. **Eligibility guard** (FR-006): whole-word (word-boundary), case-insensitive; never
   rewrite when any ancestor is `code`/`inlineCode`/`heading`/`link` (frontmatter already
   stripped before remark). Substring-in-word never matches.
3. **Resolution** via the shared resolver (`resolver.md`): `link` → rewrite; `unresolved` →
   leave plain + one `file.message` per distinct surface per page, stable greppable form
   `[glossary] unresolved collision "<name>" in <ctxA>, <ctxB> — left unlinked`, exit 0
   (NFR-007); `none` → leave.
4. **Opt-outs before rewrite**: ignore-list; `glossary_autolink: false` → whole-page no-op
   (FR-008).
5. **Expose links-used via the pure `computePageLinks` (post-squad A-1)**: the frontmatter
   channel is **retired** — do NOT write `file.data.astro.frontmatter.glossary_links_used`
   (the schema strips undeclared keys; `entry.data` freezes at load). Instead the pure
   `computePageLinks(tree, pageContext, index, ignoreList) → { tree, linksUsed }` returns the
   deduped, ordered `GlossaryLinkUsed[]` (collected by scanning every `data-glossary-term`
   node — auto + `:term`); WP07 re-derives at render by calling the same function over
   `entry.body`.
6. **Deck no-op** (AS-1/AS-4): early-return on `kind: Presentation`.
7. **Presence-gated**: no shared index → early return; corpus byte-identical (NFR-002).

## `:term` directive (IC-05)

`:term[text]{context=<ctx>}` and suppress `:term[text]{link=false}` (FR-011).
1. Parsed by `remark-directive` as a text-directive **before** the auto-linker.
2. Emits the **same link node** shape, resolving via the resolver against the **explicit**
   `context` (overrides collision ambiguity and false positives).
3. `link=false` → render `text` as plain text.
4. A `:term` occurrence **counts as used** (published to links-used) and **counts as the
   section's first eligible**, so the auto-linker does not double it.
5. Unknown/missing `context` → build **warning** (not fatal), consistent with skip-and-warn.

## Cross-cutting

- The auto-linker is thin: all resolution is the shared resolver; the plugin only walks the
  tree, tracks sections, applies guards, rewrites, and publishes links-used.
- A regression test asserts an auto-link and a `:term` both resolve on the example page
  (order-sensitive — guards the append-order risk).
