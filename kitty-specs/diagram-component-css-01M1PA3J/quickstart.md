# Quickstart — verifying the diagram + component-CSS fixes

All commands from the repo root. The example is a **branded** site (`theme: specKittyTheme`), so it exercises the #68 path.

## Build
```bash
pnpm build          # builds example/ → example/dist
```

## FR-001 / #59 — no diagram is boxed in a stray <pre>
```bash
# Expect: NO matches (0). Today: 6 matches across 3 pages.
grep -rEo '<pre[^>]*>\s*<figure[^>]*dk-diagram' example/dist --include='*.html'
```
Pages to eyeball: `/doc-kitty/architecture/overview/`, `/doc-kitty/architecture/diagram-demonstrator/`, and the deck fixture — caption should be normal wrapping prose, not a monospace code-card.

## FR-002 / FR-003 / #60 / #68 — component CSS reaches branded surfaces
```bash
# A branded docs page that renders a callout/diagram must ship the rules.
# For each linked _astro/*.css on the page, at least one must contain these:
grep -l '\.dk-callout' example/dist/_astro/*.css
grep -l '\.dk-diagram__caption' example/dist/_astro/*.css
# Then confirm the markua-showcase (callout) + a diagram page actually LINK such a sheet.
```

## FR-005 — gates (mutation-true)
```bash
pnpm assert:artifacts          # no-<pre>-wraps-figure + CSS-delivery asserts (RED before fix)
pnpm -C src test               # pipeline-level unit exercising the real remark→hast→rehype chain
pnpm test:a11y                 # caption computed-style (non-monospace, white-space normal) on docs + deck
```

## Mutation checks (prove the gates bite)
- Re-add the outer `<pre>` (revert the retype) → `assert:artifacts` + the pipeline unit go RED.
- Remove the component sheet from `customCss` → the CSS-delivery assert goes RED.
- Revert caption to monospace/`white-space:pre` → the Playwright computed-style check goes RED on the deck.

## Serve locally
```bash
pnpm preview        # http://localhost:4321/doc-kitty/
```
