---
section: Changed
---

- **`dockitty-assert-plantuml-no-remote-include --service-container` now fails
  a service that is not in SANDBOX mode (#268).** Before, the check passed any
  service that refused its test include, even one whose
  `PLANTUML_SECURITY_PROFILE` was missing (the image default is `INTERNET`).
  Now, with the opt-in unset, the named container must have
  `PLANTUML_SECURITY_PROFILE=SANDBOX`. The check also fails when PlantUML
  options are set as Java `-D` properties (in the environment or on the
  container's command line) or in a `PLANTUML_PROPERTY_FILE`, because it cannot
  read them, and when `--server` points at a local port the named container
  does not publish. To fix: set `PLANTUML_SECURITY_PROFILE=SANDBOX` on the
  service, or declare the opt-in; move PlantUML settings into the two
  environment variables; and name the container that serves `--server`.
