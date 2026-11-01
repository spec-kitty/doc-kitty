---
section: Security
---

- **The PlantUML render service is pinned by digest and refuses remote
  includes (#251).** Before, every workflow ran the floating
  `plantuml/plantuml-server:jetty` tag, so a re-tag silently changed the renderer.
  The server also ran with its default `INTERNET` profile, so a diagram with
  `!includeurl` (or an `!include` of a URL) was fetched at build time. Now
  `ci.yml`, `deploy.yml` and `update-a11y-baselines.yml` run
  `jetty-v1.2026.9@sha256:065c66ad…` with `PLANTUML_SECURITY_PROFILE=SANDBOX`.
  Such a diagram renders as an error and fails the build. A new bin,
  `dockitty-assert-plantuml-no-remote-include`, proves this against a live
  service, and CI runs it before building: it serves a canary, checks that the
  canary is reachable from inside the service container, and requires the
  `!includeurl` and `!include <url>` fixtures to be refused with zero canary
  requests. The consumer guide now shows the hardened service block. To adopt
  it, copy that block; a diagram that includes a URL or a local file will then
  stop the build.
