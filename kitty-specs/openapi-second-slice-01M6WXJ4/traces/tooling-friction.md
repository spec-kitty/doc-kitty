# Tooling friction

Tooling touched: spec-kitty 4.0.0rc8 CLI (plan, tasks, finalize), codegraph, pnpm, Vitest, Playwright + axe, Astro build/dev.

- **[2026-11-08][plan] setup-plan commits only plan.md.** research.md, data-model.md, contracts/ and quickstart.md needed a manual commit after the second `setup-plan` call. Workaround: committed them separately.
- **[2026-11-08][plan] upgrade check could not detect the install method.** `spec-kitty upgrade --agent-check` returned guidance only; no action taken.
