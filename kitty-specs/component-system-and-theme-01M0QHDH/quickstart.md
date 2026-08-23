# Quickstart: select and override a theme

For a consumer adopting doc-kitty who wants their own brand — no fork.

## 1. Select a shipped theme

```js
// astro.config.mjs
import { defineDocKittyIntegrations } from '@commondocs-kitty/toolkit';
import { specKittyTheme } from '@commondocs-kitty/toolkit/themes/spec-kitty';

export default defineConfig({
  integrations: defineDocKittyIntegrations({
    title: 'My Docs',
    theme: specKittyTheme,   // brand layer; merged over the shipped Default
  }),
});
```

No theme? Omit `theme` — the site renders the neutral Default, exactly as in M1.

## 2. Nudge it per-site (the consumer layer, the last word)

```js
theme: {
  extends: specKittyTheme,
  tokens: { '--dk-color-accent': '#0aa' },      // one accent override
  assets: { logo: './src/assets/my-logo.svg' }, // swap the logo only
}
```

Only the keys you name change; everything else inherits the brand, which inherits the
Default.

## 3. What a theme may set

- `tokens` — `--dk-*` values only (colour, type, radius, focus…). Never `--sl-*`.
- `assets` — logo / favicon / socialImage / fonts.
- `customCss` — extra sheets, layered after the tokens.
- `slots` — a `dk:` slot's `.astro` component.
- `layouts` — a `kind`'s layout `.astro` component (e.g. a bespoke `Persona`).

## 4. Verify locally

```bash
pnpm install --frozen-lockfile
pnpm build            # builds the (branded) example
pnpm assert:artifacts example/dist   # M1 + themed chrome gates
pnpm test:a11y        # Playwright + axe, both modes
```

Green across `code-quality`, `doc-sanity`, `build-example`, and the accessibility lane
means `ci-ok` is green.
