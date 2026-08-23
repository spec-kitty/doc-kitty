# Contract: the theme surface

The stable public surface a consumer programs against (NFR-006). A breaking change to
it requires an ADR.

## Entry point

```ts
// Backward-compatible: the M1 (options) call keeps working with no theme.
defineDocKittyIntegrations(options: DocKittyOptions & { theme?: DocKittyTheme })
  : AstroIntegration[]
```

- No `theme` → the M1 behaviour, byte-for-byte: `customCss = ['@commondocs-kitty/toolkit/styles/theme.css']`, the Default `--dk-*` catalog, and static Hub+Default layout resolution.
- With `theme` → resolve default → brand → consumer, emit the merged token sheet, forward assets, and expose `slots`/`layouts` through the manifest.

## DocKittyTheme

```ts
interface DocKittyTheme {
  name?: string;
  extends?: DocKittyTheme;                       // brand extends default; consumer extends brand
  tokens?: Record<string, string> | string;      // --dk-* values or a css path — NEVER --sl-*
  customCss?: string[];                          // layered AFTER the token sheet
  assets?: { logo?: string; favicon?: string; socialImage?: string; fonts?: string[] };
  slots?: Partial<Record<DkSlotName, string>>;   // dk: slot name -> .astro path
  layouts?: Partial<Record<Kind, string>>;       // kind -> layout .astro path
}
```

## Merge semantics (normative)

1. Resolve the `extends` chain to an ordered layer list `[default, …, this]`.
2. `tokens`: shallow-merge across layers (later `--dk-*` keys win; un-named inherit).
3. `customCss`: concatenate in layer order (token sheet is always first).
4. `assets`, `slots`, `layouts`: per-key last-wins.
5. Emit one generated stylesheet: the merged `--dk-*` block **then** the
   `--dk-*→--sl-*` bridge; brand/consumer `customCss` follow it in the array.

## Invariants the gates enforce

| Invariant | Assertion (non-fakeable) |
|---|---|
| Token catalog complete | every `--dk-*` name declared in the emitted sheet (`assert-chrome-artifacts.mjs`) |
| Bridge complete | every `--sl-x: var(--dk-y)` assignment present |
| `--dk-*`-only | brand/consumer emitted sheets contain zero `--sl-*:` declarations |
| Cascade order | brand/consumer `customCss` strictly **after** the token sheet |
| Mode-varying completeness | each enumerated mode-varying `--dk-*` re-declared under the dark selector |
| Components map fixed | Starlight `components` map is exactly the four carriers |
| Layout resolution | `resolveLayout(kind)` synchronous; `Default` fallback; Hub + Persona layout-unique markers (`dk-hub__list`, `.dk-passport`) |
| Accessibility | axe-core `wcag22aa` 0 serious/critical on the enumerated pages, both modes; CSS ≥24px target + `.dk-*:focus-visible` construction checks |
