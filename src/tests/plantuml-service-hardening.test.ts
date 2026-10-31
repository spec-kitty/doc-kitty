/**
 * The PlantUML render service is pinned and sandboxed (#251). A text guard over
 * the workflows and the consumer guide (no YAML parser, as in
 * regen-workflow-render-setup.test.ts):
 *   - every `plantuml` service runs ONE image, pinned by digest (a re-tag of
 *     `:jetty` can no longer swap the renderer), and the consumer guide shows the
 *     same pin, so adopters copy the reviewed form;
 *   - every service sets `PLANTUML_SECURITY_PROFILE: SANDBOX`, which makes
 *     PlantUML refuse every URL read (`!include`/`!includeurl` of a URL, remote
 *     images), so a diagram cannot make the build reach the network;
 *   - ci.yml's build-example job proves the refusal against the live service
 *     (assert-plantuml-no-remote-include) after the server is up and before the
 *     example is built.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

const WORKFLOWS = [
  '.github/workflows/ci.yml',
  '.github/workflows/update-a11y-baselines.yml',
  '.github/workflows/deploy.yml',
] as const;

const PINNED_IMAGE = /plantuml\/plantuml-server:jetty-v\d+\.\d+\.\d+@sha256:[0-9a-f]{64}/;

/** The `plantuml:` service block of a workflow: from the key to the next key at its indent or less. */
function serviceBlock(workflow: string): string {
  const start = workflow.search(/^ {6}plantuml:\s*$/m);
  expect(start, 'a `plantuml:` service is declared').toBeGreaterThan(-1);
  const rest = workflow.slice(start);
  const firstLineEnd = rest.indexOf('\n') + 1;
  const end = rest.slice(firstLineEnd).search(/^ {0,6}\S/m);
  return end === -1 ? rest : rest.slice(0, firstLineEnd + end);
}

describe('PlantUML service hardening (#251)', () => {
  const images = new Map<string, string>();

  for (const file of WORKFLOWS) {
    describe(file, () => {
      const block = serviceBlock(read(file));

      it('runs the image pinned by digest, never the floating :jetty tag', () => {
        const image = /^\s*image:\s*(\S+)\s*$/m.exec(block)?.[1];
        expect(image).toMatch(new RegExp(`^${PINNED_IMAGE.source}$`));
        images.set(file, image!);
      });

      it('sets PLANTUML_SECURITY_PROFILE to SANDBOX on the service', () => {
        expect(block).toMatch(/^\s*env:\s*$/m);
        expect(block).toMatch(/^\s*PLANTUML_SECURITY_PROFILE:\s*SANDBOX\s*$/m);
      });
    });
  }

  it('uses one pin everywhere, and the consumer guide shows that same pin and profile', () => {
    expect(new Set(images.values()).size).toBe(1);
    const [image] = images.values();
    const guide = read('docs/guides/consumer-setup.md');
    expect(guide).toContain(image);
    expect(guide).toMatch(/PLANTUML_SECURITY_PROFILE[=:]\s*SANDBOX/);
    // No floating tag left in the guide's recommended setup.
    expect(guide).not.toMatch(/plantuml\/plantuml-server:jetty(?![-\w])/);
  });

  it('ci.yml proves the refusal against the live service, between the wait and the build', () => {
    const ci = read('.github/workflows/ci.yml');
    const wait = ci.indexOf('name: Wait for the PlantUML server');
    const check = ci.indexOf('name: Assert PlantUML refuses remote includes');
    const build = ci.indexOf('name: Build example site');
    expect(wait).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(wait);
    expect(build).toBeGreaterThan(check);
    const step = ci.slice(check, build);
    expect(step).toContain('src/scripts/assert-plantuml-no-remote-include.mjs');
    // Reachability is proven from inside the service container, so a refusal
    // cannot be a network that simply cannot reach the canary.
    expect(step).toContain('--service-container "${{ job.services.plantuml.id }}"');
    expect(step).toContain('--canary-host');
  });
});
