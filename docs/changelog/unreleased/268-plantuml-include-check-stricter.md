---
section: Breaking
---

- **`dockitty-assert-plantuml-no-remote-include --service-container` now fails
  service setups it used to pass (#268).** Before, the check passed any
  service that refused its test include. Now, with the opt-in unset, it fails
  when the named container has: a `PLANTUML_SECURITY_PROFILE` that is missing
  or not `SANDBOX`; a security-relevant `-D` property, `plantuml.*` env key or
  `PLANTUML_PROPERTY_FILE`; a Java `@argfile`; or a local `--server` port the
  container does not publish on a matching address. An empty value for any
  flag now exits 2. To fix: set `PLANTUML_SECURITY_PROFILE=SANDBOX` on the
  service (or declare the opt-in), move PlantUML settings into the two
  environment variables, and name the container that serves `--server`. See the
  [0.6 to 0.7 migration guide](docs/migrations/0.6-to-0.7.md).
