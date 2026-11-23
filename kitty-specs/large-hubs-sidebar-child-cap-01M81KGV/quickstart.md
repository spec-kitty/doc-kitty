# Quickstart: sidebar child cap

```js
// astro.config.mjs
defineDocKittyIntegrations({ title: 'Docs', sidebar: { childCap: 30 } });
```

```yaml
# docs/_meta/sections.yaml
  - id: adr
    label: Decision Records
    order: 30
    sidebar:
      childCap: 100
```

```yaml
# docs/missions/README.md (a hub)
sidebar_child_cap: 10
```

Verify: `pnpm --filter @spec-kitty/doc-toolkit exec vitest run src/tests/sidebar-child-cap.test.ts src/tests/sidebar-child-cap-build.test.ts`, then `pnpm build:a11y && pnpm test:a11y tests/a11y/sidebar-child-cap.spec.ts`.
