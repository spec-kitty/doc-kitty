---
title: "ADR-0023: Client-side diagram rendering, one render owner, and the %%-metadata → accessible-figure seam"
description: doc-kitty owns a single shared Mermaid render module; metadata is parsed by a remark plugin and wrapped at rehype; the deck imports the same module.
doc_status: active
updated: 2026-08-25
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - plans/features/diagrams
  - adr/0024-diagram-token-promotion-and-brand-wiring
  - adr/0022-reveal-integration-and-token-theme
  - architecture/research/astro-markdown-extensions
---

# ADR-0023: Client-side diagram rendering, one render owner, and the `%%`-metadata → accessible-figure seam

## Status

Accepted. Establishes the M5 (Diagrams) rendering + accessibility seam; paired with
[ADR-0024](./0024-diagram-token-promotion-and-brand-wiring.md) (token promotion + brand
wiring). Client-side rendering only; the build-time static-SVG render is deferred
(issue #13). Grounded in
[findings-D](../../research/2026-08-21-astro-feature-discovery/findings-D-contextive-diagrams.md)
topic 4.

## Context

Diagrams are authored as `` ```mermaid `` fences and rendered **client-side** in v1 (no
build-time headless browser). Four seams the spec draft left implicit are load-bearing and
must be decided here, or they are decided silently in code:

1. **Render ownership.** `astro-mermaid` ships its own injected client script that renders
   every `pre.mermaid` **and** re-themes on a `data-theme` change. doc-kitty also needs to
   read `--dk-diagram-*` into Mermaid's `themeVariables` and re-render on toggle. Two
   uncoordinated render loops over the same SVG produce a flash of the wrong theme and
   double work.
2. **Plugin ordering.** A metadata step must see the fence and wrap it, and it must run
   *after* the fence becomes `<pre class="mermaid">` — but rehype-after-rehype append order
   (entangled with Starlight/Expressive-Code registration) is not deterministic.
3. **Deck reachability.** The M6 deck route is a standalone out-of-frame document that
   bypasses Starlight; whether `astro-mermaid`'s `injectScript('page')` reaches it is
   unproven, and its injected module is not a public export to re-import.
4. **Accessibility.** A client-rendered SVG is an unlabeled graphic; axe's `svg-img-alt`
   may not even fire on Mermaid's role, and axe does not evaluate SVG contrast.

## Decision

1. **doc-kitty owns a single, exported client render module** (`src/lib/diagram/
   diagram-render.client.ts`) — the **render owner**. Exactly one render loop touches any
   `pre.mermaid`: it reads `--dk-diagram-*` off `:root` into a Mermaid `theme: 'base'`
   `themeVariables` object, renders each `.mermaid` node, and re-renders on a `[data-theme]`
   change via a `MutationObserver`. `astro-mermaid` is used for its **build-time fence
   transform only** (`` ```mermaid `` → `<pre class="mermaid">`), configured
   `autoTheme: false` with its **own client render disabled**. A foundation spike confirms
   `astro-mermaid@2.1.0` can be render-suppressed; the named fallback is a minimal
   doc-kitty remark fence transform that drops `astro-mermaid` entirely. Either way there is
   one render owner.
2. **Metadata is a remark plugin; the figure wraps at rehype** — deterministic by pipeline
   stage, not by fragile plugin append-order. A **remark** plugin parses the leading
   `%% key: value` block, strips the matched lines, injects the `accTitle`/`accDescr`
   accessibility statements into the code node, and stashes the caption fields on
   `file.data`; a **rehype** plugin reads `file.data` and wraps the `<pre class="mermaid">`
   in the `<figure>` + `<figcaption>`. remark always precedes rehype, so ordering is free.
3. **Accessibility statements name the SVG.** `accTitle` (→ accessible **name**,
   `aria-labelledby`) is derived from `title`, **falling back to `description`** when
   `title` is absent; `accDescr` (→ **description**, `aria-describedby`) from `description`.
   Injection targets the actual **diagram-type declaration line** (skipping a leading
   `%%{ init }%%` directive or YAML frontmatter). The a11y-guaranteed diagram types are
   **flowchart / sequence / class**. The gate asserts the accessible name **directly** (not
   via axe) and diagram-internal contrast **via a vitest** on the `--dk-diagram-*` pairs
   (axe evaluates neither); axe covers the surrounding HTML `<figure>`/`<figcaption>`.
4. **The deck imports the shared render module.** `DeckLayout` loads
   `diagram-render.client` from its own browser-only client `<script>` (mirroring
   `reveal-init.client`), so the out-of-frame deck renders diagrams through the same one
   owner. The `--dk-diagram-*` tokens already ride DeckLayout's existing base-token link
   (ADR-0024), so **no new deck token wiring** is needed. The deck demonstrator diagram
   lives on the **active first slide** (reveal `display:none`s later slides, which mermaid
   cannot size and axe skips).
5. **Self-contained + CSP note.** `mermaid` is bundled (no CDN), `securityLevel: 'strict'`.
   Mermaid injects inline `<style>` into the SVG, so a consumer CSP must allow
   `style-src 'unsafe-inline'`; doc-kitty ships no CSP today, so nothing conflicts — recorded
   here so any future doc-kitty CSP includes it.

## Consequences

### Positive

- One render owner ⇒ no double-render / wrong-theme flash, live `--dk-diagram-*` theming,
  and a module the deck can import — three problems solved by one seam.
- remark-then-rehype ordering is deterministic; no reliance on plugin append-order.
- The accessible name comes from author metadata with zero runtime a11y code of ours, and
  the gate proves it with mechanisms that actually apply (direct name + vitest contrast).

### Negative

- doc-kitty owns a client render module rather than delegating fully to `astro-mermaid`;
  a `mermaid` upgrade re-verifies the render + the SVG/aria assertion surface.

### Risks

- `astro-mermaid` render-suppression is a spike assumption; the fallback (own fence
  transform) is the guard.
- Injection placement across diagram types is fragile; bounded to the guaranteed set +
  vitest cases (init-first, frontmatter-first).

## Alternatives considered

### astro-mermaid owns the render (static `themeVariables` via its config)

Rejected as the owner. Its `themeVariables` would be a build-time snapshot, not the live
`--dk-diagram-*`; its client render may not reach the out-of-frame deck; and it re-themes
on its own loop, re-introducing the double-render.

### Metadata as a rehype plugin ordered after astro-mermaid

Rejected as the primary. rehype-after-rehype order is entangled and non-deterministic; the
remark-parse + rehype-wrap split (Decision 2) is order-free by stage.

### Wrapper `role="img"` + `aria-label` instead of `accTitle`/`accDescr`

Rejected. It flattens the rich SVG semantics and can't be set at build on a not-yet-rendered
SVG; the mermaid-native accessibility statements are the designed path.

## References

- [ADR-0024](./0024-diagram-token-promotion-and-brand-wiring.md),
  [ADR-0022](./0022-reveal-integration-and-token-theme.md) (the deck client-script pattern).
- [findings-D](../../research/2026-08-21-astro-feature-discovery/findings-D-contextive-diagrams.md)
  topic 4; [astro-markdown-extensions](../architecture/research/astro-markdown-extensions.md).
- Mermaid accessibility (`accTitle`/`accDescr`) and theming (`themeVariables`) docs.
