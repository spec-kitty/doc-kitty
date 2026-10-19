# Contract: `generate-feature-pages` CLI (`validate:features`)

New flag, the twin of `gherkin.defaultGlossaryContext`, registered in `FLAG`
(the FR-004a parity test enforces it):

```
--default-glossary-context <dir>=<context>     (repeatable)
```

- **Parsing**: each value splits on its first `=`. A missing `=` or a repeated
  `<dir>` is a usage error (exit 2, matching `--titles`). Keys and values then
  pass the shared validator.
- **Behaviour**: identical page bytes to the integration given the same map.
- **Not added**: no lint flag (D1). The CLI does not run the unknown-context
  check (research R-02).
- **Example**: `--default-glossary-context shipping=shipping --default-glossary-context hr=hr`.
