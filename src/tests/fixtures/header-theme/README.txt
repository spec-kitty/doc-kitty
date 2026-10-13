Fixtures for src/tests/header-carrier.test.ts (the Header carrier).

stock-header.html
  The <header ...>...</header> block of example/dist/index.html, captured from a
  build of commit 2ffe856, the commit before the Header carrier existed. Every
  framed page of the example shares this block.

  One thing in it is normalised: each Astro scoped-class name ("astro-" followed
  by eight characters of [a-z0-9]) has been replaced with the fixed token
  "astro-HASH". Astro derives that hash from the component's file path,
  including the absolute path of the checkout, so the same commit built in
  another directory (the repository root, another worktree, CI) produces
  different hashes. The hash therefore says where the build ran, not what the
  header contains. The test applies the same replacement to every built header
  block before comparing.

  Nothing else is normalised. Element structure, attributes, other class names,
  text, whitespace and asset file names (content-hashed, so the same at every
  path) are the bytes the build produced.

  To regenerate (expected only when Starlight, the example's title or the brand
  logo changes): run "DK_PUBLISH_DRAFTS=off pnpm build", take the header block of
  example/dist/index.html, replace each astro-xxxxxxxx class with astro-HASH,
  and write it over the file without a trailing newline.

astro.config.mjs, SiteHeader.astro
  The example site's configuration plus a theme layer that fills the
  dk:site-header slot with SiteHeader.astro.
