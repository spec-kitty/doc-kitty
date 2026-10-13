# Research: Generated pages and relative links hold up for consumers

Findings come from a four-lens grounding pass and a two-lens post-spec review,
all read-only, on `main` at `27358fe`. "Read" means confirmed by reading code;
nothing here was confirmed by a build.

## R1 — Where the route rule lives

- **Decision**: a pure, fs-free function set in `src/lib/vocabulary-core.mjs`, re-exported by `src/lib/metadata.ts`.
- **Rationale**: the CLI scripts run without a TypeScript step. `metadata.ts:26` already imports from that file. `readmeToIndexId` and `resolveIndexEntries` (`metadata.ts:420,458`) are already fs-free.
- **Alternatives considered**: keep it in `metadata.ts` and duplicate for the CLIs (the present state, which is the defect); a new package export (no consumer needs it).
- **Known divergence today (read)**: `draftRoutesOf` (`draft-publication.mjs:309-311`) and `directoryMetaInputs` (`config.ts:1425`) ignore a second index file in a folder; the loader does not. `check-links.mjs:89` hardcodes `['README','index']`.

## R2 — Can a remark plugin see the source file path?

- **Decision**: yes; read it from `file.path`.
- **Evidence (read)**: Astro's glob loader passes the absolute path to render (`content/loaders/glob.js:117-122`), which becomes `fileURL` (`vite-plugin-markdown/content-entry-type.js:26`) and then `VFile.path` (`@astrojs/markdown-remark/dist/index.js:102-104`). The toolkit's custom loader wraps only `load`/`store.set` (`src/lib/schema.ts:379-405`).
- **Open**: no toolkit plugin reads `file.path` today. The first plugin test must run through the real processor, not a hand-built vfile.

## R3 — Do `.mdx` pages get the plugin?

- **Decision**: yes, by inheritance; add one executed test.
- **Evidence (read)**: Starlight adds `mdx()` and `@astrojs/mdx` defaults `extendMarkdownConfig` to true (`@astrojs/mdx/dist/index.js:51-55,70`).

## R4 — Remark or rehype stage

- **Decision**: remark, on `link` and `definition` nodes.
- **Rationale**: covers reference-style links, keeps raw HTML anchors out (they are out of scope and indistinguishable at the rehype stage), and keeps raw HTML anchors out. The plugin applies the base itself (through `withBase`), because the existing rehype pass skips any href that already starts with the base and would leave a section named like the base unprefixed.
- **Alternatives considered**: extend `base-absolute-links` (would mix two concerns and catch raw HTML anchors).

## R5 — Stale links in cached renders

- **Finding (read)**: the glob loader skips re-rendering an entry whose own digest is unchanged (`glob.js:81-91`), so a renamed target leaves an old link in cached HTML. The store is cleared only when the Astro config digest changes (`content-layer.js:152-173`); that digest serialises plugin options.
- **Decision**: pass the route table to the plugin as plain JSON options. A `Map`, `Set` or closure would serialise to nothing.
- **Alternatives considered**: a hash of the table as a separate option beside a closure (works, but two things to keep in step).

## R6 — Where to register the plugin

- **Decision**: inside the existing `doc-kitty:base-absolute-links` integration.
- **Rationale**: a new integration moves at least four pins (`config-invariants.test.ts:135-146`, `glossary-config.test.ts`, `markua-attributes.test.ts`, the parity classifier behind `src/tests/helpers/remark-stack.ts`); joining the existing one moves only the parity classifier.

## R7 — Recognising stale generated glossary pages

- **Finding (read)**: the generator has no ownership marker and never prunes; `glossary-codegen-guard.test.ts:79` asserts there is no `generated:` field. `isGeneratedPage` (`validate-frontmatter.mjs:140-146`) matches by `glossary/` path plus `kind`.
- **Decision**: prune by rule with the FR-008 conditions; stop on an authored file at a target path; compare names case-insensitively.
- **Alternatives considered**: a `generated.by` stamp (changes every glossary page's bytes and removes an existing guard; rejected by the owner).

## R8 — Gherkin guard point

- **Finding (read)**: missing source directory throws (`load.mjs:204-208`); all-parse-fail throws (`load.mjs:250`); empty reaches `generate.mjs:529-534` (warn) and `:537-557` (delete). Check mode uses `diffFeaturePages` and already fails on empty sources with pages present. A throw inside the Astro hook fails the build and `astro dev` startup.
- **Decision**: guard in `generateFeaturePages` after the authored-file check (`:521`).

## R9 — Consumer proof

- **Finding (read)**: the fixture sets `['README','index']` and has authored `docs/rhetoric/index.md` and `docs/rhetoric/book-one/index.md`; `generateGlossaryPages` is not a package export, so no build-free proof exists.
- **Decision**: move the fixture to the default index name and rename those two files to `README.md`. Routes, `url-baseline.txt` and the lockfile are expected unchanged.
- **Alternatives considered**: a third build with the setting switched (one more full build and its own assertions); a second fixture (new install and lockfile).
- **Cost accepted**: the packaged proof no longer shows several index names; the example does.

## R10 — Source check inputs

- **Finding (read)**: the CLI takes roots, `--site-root`, `--mode` and the draft setting from env; index names and strictness are hardcoded (`check-links.mjs:89,98`). It sees inline links only (`INLINE_LINK`, `:108`) and skips root-absolute links (`:253`).
- **Decision**: add `--index-basename` (pattern at `generate-feature-pages.mjs:108`) and `--strict`; add reference-definition parsing; root-absolute links stay out of the source check, so SC-004 is scoped to relative Markdown links.

## Not verified

- Behaviour of a docs root outside the project or behind a symlink.
- Build-time cost (NFR-003).
- Every item marked "read" above, until CI builds the draft PR.
