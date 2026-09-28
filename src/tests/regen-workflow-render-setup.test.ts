/**
 * WP01 — regeneration-job render setup guard (#106, FR-005/NFR-002, User
 * Story 2). The `regenerate` job in
 * `.github/workflows/update-a11y-baselines.yml` runs INSIDE the pinned
 * `mcr.microsoft.com/playwright:v1.62.1-noble` container and builds the
 * example with an auto-detected BUILD diagram-render mode, but historically
 * declared no PlantUML render server — so the build-mode PlantUML assertion
 * in `tests/a11y/diagram.spec.ts` failed and the job aborted before ever
 * reaching the detect/commit/PR steps.
 *
 * This is a TEXT-based guard (no YAML-parser dependency — none exists in this
 * repo and `pnpm install --frozen-lockfile` must stay unchanged). It parses
 * the workflow file as a string and asserts on it directly. The whole file
 * has exactly one job (`regenerate`), so every assertion below is already
 * scoped to that job without needing to slice a job boundary.
 *
 * The load-bearing, NON-VACUOUS assertion is the "no `localhost`" check: a
 * `regenerate` job runs inside a container, so the PlantUML service is only
 * reachable by its Docker-network service NAME on its own port
 * (`http://plantuml:8080/svg/`) — never a mapped `localhost` port, which is
 * how `ci.yml`'s `build-example` (which runs directly on the runner) reaches
 * it. A guard that only checked for the substring `plantuml` would pass on a
 * `localhost`-form URL and miss the actual #106 defect class.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workflowPath = fileURLToPath(
  new URL('../../.github/workflows/update-a11y-baselines.yml', import.meta.url),
);

let workflow: string;

beforeAll(() => {
  workflow = readFileSync(workflowPath, 'utf8');
});

describe('regenerate job render setup (#106, FR-001..FR-003, NFR-001/NFR-002)', () => {
  it('declares a plantuml service using the self-hosted jetty image (C-001, FR-001)', () => {
    expect(workflow).toMatch(/^\s*plantuml:\s*$/m);
    expect(workflow).toContain('image: plantuml/plantuml-server:jetty');
  });

  it('forces deterministic BUILD render mode (FR-002)', () => {
    expect(workflow).toMatch(/DK_DIAGRAM_BUILD_RENDER:\s*'on'/);
  });

  it('points the render URL at the service BY NAME, on port 8080, with the /svg/ suffix (FR-002, NFR-002)', () => {
    expect(workflow).toContain('DK_PLANTUML_SERVER_URL: http://plantuml:8080/svg/');
  });

  it('never resolves the render URL via localhost — the container-networking invariant (NFR-002)', () => {
    // Non-vacuous: this is what actually distinguishes the fix from a
    // ci.yml-style `build-example` copy-paste that would silently fail to
    // connect from inside the job container. Asserted over the whole file,
    // not just the env line, so a stray localhost reference anywhere in the
    // render setup (e.g. a copy-pasted wait-step URL) also fails the guard.
    expect(workflow).not.toContain('localhost');
  });

  it('waits for the PlantUML server before building the example site, in that order (FR-003)', () => {
    const waitIndex = workflow.indexOf('Wait for the PlantUML server');
    const buildIndex = workflow.indexOf('Build example site');

    expect(waitIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(-1);
    expect(waitIndex).toBeLessThan(buildIndex);
  });
});
