# Quickstart / verification: Glossary a11y follow-up cluster

Direct-to-feat on `feat/glossary-a11y-followups`. Gate order matters — vitest
mutates `example/dist`, so rebuild immediately before the artifact/link asserts
and run no vitest between build and assert.

```bash
# Unit (serial — fileParallelism:false is set in vitest config)
pnpm test

# Build the toolkit + example site
pnpm build

# Rebuild the example dist RIGHT before the artifact/link asserts (vitest mutated it)
#   (pnpm build above already produced it; do not run vitest again before these)
pnpm run validate:docs
pnpm run validate:example
pnpm run validate:adr-index
pnpm run validate:links
pnpm run assert:artifacts
pnpm run assert:no-broken-links
pnpm run assert:markua

# e2e / a11y (Playwright, both colour modes)
pnpm run test:a11y
```

Notes:
- `astro check` OOMs locally → CI is the typecheck verifier.
- The 2 visual-brand-home baselines fail locally (fonts) but pass in CI.
- If a broken `node_modules` blocks local gates, CI is the verifier (env hazard).

## Manual spot-checks

- Built HTML: `grep -o 'aria-label="[^"]*glossary term"' example/dist/**/*.html`
  finds the affordance on term anchors; ordinary links have none.
- Screen-reader smoke (optional): a glossary term announces
  "<text>, glossary term, link".

## Done when

- All gates above green in CI.
- Both parity guards green.
- e2e placement/caret assertions present and passing; count-pins unchanged.
- One shared builder; both emitters import it.
- `docs/architecture/glossary.md` footprint section + ADR/changelog note updated.
- Non-draft PR to `main`, `Closes #77 #78 #79`.
