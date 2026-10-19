# Contract: new warnings

All warnings are non-fatal. They go through the existing `warn` callbacks
(`logger.warn` in the build, `console.warn` in fences, `⚠` in the CLI), never
through the fatal error sink. The prefix is `[dk-gherkin]`.

| Code path | Text |
|---|---|
| Unused map key | `[dk-gherkin] gherkin.defaultGlossaryContext key "<key>" matches no source directory with a feature; ignored` |
| Unknown context (build only) | `[dk-gherkin] <relPath> glossary context "<ctx>" (from <the @dk:context tag \| gherkin.defaultGlossaryContext key "<key>">) is not a context in .contextive/definitions.yaml; terms on this page cannot be disambiguated by it` |
| Imperative step | `[dk-gherkin] <file>:<line> step "<Keyword> <text>" names a UI action ("<match>") — describe the behaviour instead; silence with @dk:allow=imperative` |
| Selector in a step | `[dk-gherkin] <file>:<line> step "<Keyword> <text>" quotes a CSS selector ("<arg>") — describe the behaviour instead; silence with @dk:allow=imperative` |
| Bad suppression value | `[dk-gherkin] <file>:<line> unknown @dk:allow value "<v>" (expected imperative); ignored` |

- **One warning per step**: the first match wins.
- **Fence line numbers**: a fence's `<file>` is the host page and `<line>`
  includes the fence offset.
- **What is never linted**: included features (silent sink) and `gherkin raw`
  fences.
