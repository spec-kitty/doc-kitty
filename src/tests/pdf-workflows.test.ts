/**
 * The PDF lane and the PDF deploy step (ADR-0081, #396, #397), pinned on the
 * workflow files: path-scoped, advisory (outside ci-ok), fed by the drafts-off dist,
 * and printing before the Pages upload on main only.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { REQUIRED_LANES } from '../../.github/scripts/ci-ok-decision.mjs';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8');
type Step = { name?: string; run?: string; uses?: string; with?: Record<string, unknown> };
type Job = { needs?: string[] | string; if?: string; container?: { image?: string }; steps: Step[] };
const ci = parse(read('.github/workflows/ci.yml')) as { jobs: Record<string, Job> };
const deploy = parse(read('.github/workflows/deploy.yml')) as { on: Record<string, unknown>; jobs: Record<string, Job> };

describe('the pdf lane', () => {
  const pdf = ci.jobs.pdf;

  it('runs exactly when the example builds, never for repo docs alone', () => {
    expect(pdf.if).toBe("needs.detect-changes.outputs.run_build_example == 'true'");
    expect(pdf.needs).toEqual(['detect-changes', 'build-example']);
  });

  it('is advisory: not a ci-ok need and not a required lane', () => {
    expect(ci.jobs['ci-ok'].needs).not.toContain('pdf');
    expect(REQUIRED_LANES).not.toContain('pdf');
  });

  it('reuses the drafts-off dist and the pinned Playwright image, with no site build', () => {
    expect(pdf.container?.image).toBe(ci.jobs.a11y.container?.image);
    const download = pdf.steps.find((s) => s.uses?.startsWith('actions/download-artifact'));
    expect(download?.with).toMatchObject({ name: 'example-dist-nodrafts', path: 'example/dist-nodrafts' });
    // The only build in the lane is the small chrome fixture of the client-mode check.
    expect(pdf.steps.some((s) => /pnpm build|astro build/.test(s.run ?? ''))).toBe(false);
  });

  it('also checks that two client-mode prints are byte-identical (#394)', () => {
    const runs = pdf.steps.map((s) => s.run ?? '');
    const client = runs.findIndex((r) => r.includes('pdf-client-determinism.mjs'));
    expect(client, 'a client-mode determinism step').toBeGreaterThan(runs.findIndex((r) => r.includes('assert-pdf-determinism.mjs')));
  });

  it('prints, gates, then checks determinism, in that order', () => {
    const runs = pdf.steps.map((s) => s.run ?? '');
    const at = (needle: string) => runs.findIndex((r) => r.includes(needle));
    expect(at('SOURCE_DATE_EPOCH')).toBeGreaterThanOrEqual(0);
    expect(at('dockitty-pdf.mjs')).toBeGreaterThan(at('SOURCE_DATE_EPOCH'));
    expect(at('assert-pdf-artifacts.mjs')).toBeGreaterThan(at('dockitty-pdf.mjs'));
    expect(at('assert-pdf-determinism.mjs')).toBeGreaterThan(at('assert-pdf-artifacts.mjs'));
  });
});

describe('the deploy', () => {
  it('runs on main only', () => {
    expect(deploy.on.push).toEqual({ branches: ['main'] });
    expect(deploy.on.pull_request).toBeUndefined();
  });

  it('prints and gates the PDFs after the build and before the Pages upload', () => {
    const steps = deploy.jobs.build.steps;
    const build = steps.findIndex((s) => s.uses === './.github/actions/build-example');
    const print = steps.findIndex((s) => (s.run ?? '').includes('dockitty-pdf.mjs --dist example/dist'));
    const upload = steps.findIndex((s) => s.uses?.startsWith('actions/upload-pages-artifact'));
    expect(build).toBeGreaterThanOrEqual(0);
    expect(print).toBeGreaterThan(build);
    expect(upload).toBeGreaterThan(print);
    expect(steps[print].run).toContain('assert-pdf-artifacts.mjs example/dist');
  });
});
