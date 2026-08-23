# Quickstart — Metadata model and chrome (M1)

Commands to build, validate, and test the mission locally (Node ≥22, pnpm). Run
from the repository root.

## Install

```bash
pnpm install --frozen-lockfile
```

## The three `ci-ok` lanes, locally

```bash
# code-quality
pnpm --filter @commondocs-kitty/toolkit test      # vitest (metadata, agent-api, schema-validator parity)
pnpm lint                                          # eslint src
pnpm --filter example typecheck                    # astro check

# doc-sanity
pnpm validate:docs                                 # validate-frontmatter.mjs docs
pnpm validate:example                              # validate-frontmatter.mjs example/docs
pnpm validate:links                                # check-links.mjs docs example/docs  (bare + {ref,note})
npx markdownlint-cli2 "docs/**/*.md" "example/docs/**/*.md"
vale --minAlertLevel=error docs example/docs       # CI downloads Vale 3.18.0

# build-example
pnpm --filter example build                        # astro build -> example/dist
pnpm assert:artifacts                              # assert-build-artifacts.mjs example/dist
```

## Fast inner loop

```bash
# validator contract (build-free) after editing schema/validator
node src/scripts/validate-frontmatter.mjs docs example/docs

# parity: both validators agree on the fixtures
pnpm --filter @commondocs-kitty/toolkit test -- schema-validator-parity

# see the chrome render
pnpm --filter example dev                          # open the Hub + hero demonstrator pages
```

## Migration sanity (the cutover)

```bash
# no legacy key remains (git-tracked only)
git grep -nE "^status:" -- 'docs/**/*.md' 'example/docs/**/*.md' ; echo "expect: no matches"
# every page has the new required fields
git grep -L "^doc_status:" -- 'docs/**/*.md' 'example/docs/**/*.md' ; echo "expect: no files listed"
git grep -L "^kind:" -- 'docs/**/*.md' 'example/docs/**/*.md' ; echo "expect: no files listed"
# the decoy is preserved
git grep -n "status: 404" -- src/lib/routes/agent-page.ts ; echo "expect: still present"
```

## Definition of done (mission)

- `pnpm assert:artifacts` passes with `count === 12`, records carrying
  `doc_status` + `kind`, draft absent from the sitemap, Hub body in the pagefind
  index.
- All three lanes green with no intermediate red boundary (C-010).
- PR opened into `spec-kitty/doc-kitty` `main`; `ci-ok` green.
