Fixtures for src/tests/header-carrier.test.ts (the Header carrier).

stock-header.html, stock-header.meta.json
  stock-header.html is the <header ...>...</header> block of the example's
  index.html, built with the Header carrier switched off
  (DK_INTERNAL_STOCK_HEADER=on), so it is Starlight's own header and the test
  compares the carrier with stock Starlight, not with an earlier capture of
  itself (#207). Every framed page of the example shares this block.

  stock-header.meta.json is its stamp: the @astrojs/starlight and astro
  versions example/ resolves, the toolkit's compressHTML pin, carrier
  "disabled" and the captured page. All of them change the block (a
  compressHTML change changes its whitespace; an Astro change can change the
  asset hash in it). src/tests/stock-header-stamp.test.ts fails fast, without a
  build, when one of them no longer matches what is installed or configured.

  One thing in stock-header.html is normalised: each Astro scoped-class name
  ("astro-" followed by eight characters of [a-z0-9]) has been replaced with the
  fixed token "astro-HASH". Astro derives that hash from the component's file path,
  including the absolute path of the checkout, so the same commit built in
  another directory (the repository root, another worktree, CI) produces
  different hashes. The hash therefore says where the build ran, not what the
  header contains. The test applies the same replacement to every built header
  block before comparing.

  Nothing else is normalised. Element structure, attributes, other class names,
  text, whitespace and asset file names (content-hashed, so the same at every
  path) are the bytes the build produced.

  To regenerate (expected only when Starlight, Astro, compressHTML, the
  example's title or the brand logo changes): run "pnpm fixture:stock-header"
  (src/scripts/capture-stock-header.mjs). It builds the example without the
  Header carrier into its own output folder, takes the header block, applies the
  normalisation above, and writes stock-header.html (no trailing newline) and the stamp
  together. It prints "fixture unchanged" or the changed tags; review them and
  commit both files with a message that says why. Do not edit either file by
  hand.

astro.config.mjs, SiteHeader.astro
  The example site's configuration plus a theme layer that fills the
  dk:site-header slot with SiteHeader.astro.
