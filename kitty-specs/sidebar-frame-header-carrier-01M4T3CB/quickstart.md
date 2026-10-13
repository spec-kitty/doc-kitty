# Quickstart: verifying this mission

Run from the repository root. Local `node_modules` on the maintainer machine can be unreliable; CI is the authoritative verifier.

1. **Unit and contract tests**: `pnpm test`
2. **Build with drafts on** (the CI default): `DK_PUBLISH_DRAFTS=on pnpm build`
3. **Geometry guard**: `pnpm test:a11y -- layout-geometry` — asserts alignment at 1152, 1280, 1600, 1920 and 2560 in both rail states, both directions, with a capped and an invalid frame value.
4. **Build with drafts off**: `DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build`, then confirm no draft route exists and `pnpm assert:no-broken-links` is clean against that output.
5. **Header neutrality**: diff the header markup of a pre-mission build against the new build with no theme header; expect no difference.
6. **Packed consumer**: run the consumption test; it sets the frame token, the draft setting and a theme header from the tarball.
7. **Manual look**: `pnpm dev`, open a page with a long table of contents at a wide window, collapse and expand the rail, tab to the toggle.
