---
section: Fixed
---

- **A clean `pnpm install` and `pnpm build` no longer change tracked files
  (#398).** Before, every build after a release restamped the committed
  glossary pages with the new toolkit version, though their content was
  unchanged, and `pnpm install` flipped the thirteen `bin` scripts of
  `@spec-kitty/doc-toolkit` from mode `644` to `755`. Now a generated page whose
  `content_hash` is unchanged keeps its whole `generated` stamp, `by` as well as
  `at`, so `by` names the toolkit version that last changed the content. This
  covers the glossary and the Gherkin feature pages. The `bin` scripts are
  committed executable. CI fails the build lane when the build leaves the
  working tree dirty. See
  [Metadata model](docs/architecture/metadata-model.md).
