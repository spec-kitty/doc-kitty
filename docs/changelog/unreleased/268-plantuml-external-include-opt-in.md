---
section: Added
---

- **Operators can let PlantUML fetch declared remote includes (#268).** Before,
  every URL include failed the build under the hardened `SANDBOX` service. Now
  `plantumlAllowExternal` (or `DK_PLANTUML_ALLOW_EXTERNAL`) accepts exactly
  three values: unset (sandbox, the default, unchanged), a list of URL prefixes
  (allowlist mode), or `internet`. The build prints the declared entries, and
  `dockitty-assert-plantuml-no-remote-include` verifies that the running service
  matches them. An entry must end in `/` and may not carry `:80/` or `:443/`.
  Most sites need no change: bundled `<C4/...>` includes work in
  the default sandbox. See [ADR-0074](docs/adr/0074-plantuml-external-include-opt-in.md)
  and [Allowing external includes](docs/guides/consumer-setup.md#allowing-external-includes).
