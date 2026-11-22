# Quickstart: verify the mission

```bash
# A self-hosted PlantUML server on :8091 (CI runs the pinned plantuml-server image).
docker run -d -p 8091:8080 -e PLANTUML_SECURITY_PROFILE=SANDBOX plantuml/plantuml-server:jetty-v1.2026.9

pnpm test                                    # unit tests, including diagram-label-contrast
DK_DIAGRAM_BUILD_RENDER=1 pnpm build:a11y    # example/dist, build render
DK_DIAGRAM_BUILD_RENDER=1 DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build
pnpm test:a11y --project=light --project=dark diagram-legibility
```

Expected: every label at least 4.5:1, every themed edge at least 3:1, and no
label overflow on `/architecture/diagram-contrast-fixture/`, at 1280 px and
390 px, in both themes.
