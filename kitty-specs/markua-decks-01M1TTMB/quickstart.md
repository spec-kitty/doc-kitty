# Quickstart: authoring & verifying a Markua deck

## Author

In any `kind: Presentation` page under `example/docs/presentations/`, write Markua directly in slide content:

```markdown
---
title: My deck
kind: Presentation
hero_image: ./resources/cover.png
---

## First slide

W> Heads-up: this renders as a styled callout on the slide.

### A stacked slide

{aside}
A boxed aside, fully inside this slide.
{/aside}

Some text.
{.dk-note}

![A labelled diagram](./resources/diagram.png){width: 640}
```

- `W>` / mapped line-prefixes and `{aside}`/`{blurb}` render as **`dk-callout`** asides on the slide.
- `{…}` lines attach attributes to the neighbouring element.
- `![alt](img){…}` becomes an accessible `<figure>`; the title-slide `hero_image` is **never** wrapped and keeps its `alt`.
- **Do not** open an `{aside}`/`{blurb}` that closes after a `##`/`###`/`---`: it will be closed at the boundary and a build warning is emitted (the slide boundary is preserved).

## Verify locally

```bash
# Unit (serial):
pnpm test

# Build the example + rebuild dist before artifact/link asserts:
pnpm build
pnpm --filter ./example build   # or the repo's example build script

# Deck a11y/behaviour gate (Playwright + chromium), both schemes:
pnpm test:a11y        # includes tests/a11y/deck-markua.spec.ts

# Doc + example + artifact/link gates:
pnpm validate:docs && pnpm validate:example
pnpm assert:artifacts && pnpm assert:no-broken-links
```

Preview the deck route at `http://localhost:4321/doc-kitty/presentations/markua-deck/`.

## Notes / known env hazards (this repo)

- `test-results/` is root-owned — pass `--output=<scratchpad>` to Playwright.
- `astro check` OOMs locally — CI is the typecheck verifier.
- The 2 `visual-brand-home` baselines fail locally (font rendering) but pass in CI — don't chase them.
- If `node_modules` is root-owned/half-materialized, local pnpm gates break with no sudo — CI is the verifier.
