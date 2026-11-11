---
section: Added
---

- **`dockitty-plantuml-guard` checks a site's PlantUML setup before the
  build (#314).** Before, the no-`plantuml.com` guard was a library a site had
  to call through an inline `node -e` script, and it read only the toolkit's
  own files. Now `pnpm exec dockitty-plantuml-guard --astro-config
  astro.config.mjs` checks the installed toolkit, the server the build will use
  (`DK_PLANTUML_SERVER_URL` or the default) and the site's config, and fails
  when any of them names `plantuml.com`.
