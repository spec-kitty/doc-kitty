/**
 * ADR-0072, decision 3: CI is ready for a GitHub merge queue.
 *
 * A queue tests each PR on a temporary `gh-readonly-queue/main/…` branch and
 * waits for the required check, `ci-ok`, on the `merge_group` event. So:
 *   - ci.yml, the only workflow that produces a required check, runs on
 *     `merge_group`;
 *   - nothing in ci.yml reads pull-request-only context unguarded (a
 *     `merge_group` payload has no `pull_request`), and no concurrency group is
 *     keyed on it, so queue entries never cancel each other;
 *   - the `pr:pause-ci` label pauses a PR's lanes and turns `ci-ok` red, and is
 *     read only on `pull_request`, so it can never pause a queue run;
 *   - the CI helpers' own tests run in CI, and a change to them runs every lane.
 *
 * These pin only what no CI job would notice going missing: a dropped trigger, an
 * unguarded pull-request read, the pause wiring, the helper tests and the glob
 * copy. Text checks over the workflow (no YAML parser), like the other workflow
 * tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GROUP_GLOBS } from '../../.github/scripts/derive-change-groups.mjs';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const ci = read('.github/workflows/ci.yml');

/** The `on:` block of a workflow. */
const onBlock = (wf: string) => wf.slice(wf.indexOf('\non:'), wf.search(/\n(permissions|concurrency|jobs):/));

/** A job's block: from `  <id>:` to the next job at the same indent. */
function job(wf: string, id: string): string {
  const start = wf.search(new RegExp(`^ {2}${id}:\\s*$`, 'm'));
  expect(start, `job ${id} exists`).toBeGreaterThan(-1);
  const rest = wf.slice(start + 1);
  const end = rest.search(/^ {2}[a-z0-9-]+:\s*$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

describe('ci.yml runs in the merge queue', () => {
  it('triggers on merge_group', () => {
    expect(onBlock(ci)).toMatch(/^ {2}merge_group:\n {4}types: \[checks_requested\]/m);
  });

  it('re-runs when a label is added or removed, so pr:pause-ci takes effect', () => {
    const types = onBlock(ci).match(/pull_request:\n {4}types: \[([^\]]*)\]/)?.[1].split(/,\s*/) ?? [];
    expect(types).toEqual(expect.arrayContaining(['labeled', 'unlabeled']));
  });

  it('reads pull_request context only behind an event_name guard', () => {
    const uses = ci.split('\n').filter((l) => l.includes('github.event.pull_request'));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) expect(line).toContain("github.event_name == 'pull_request' &&");
    expect(ci).not.toMatch(/github\.(head_ref|base_ref)/);
  });
});

describe('the pr:pause-ci label', () => {
  const detect = job(ci, 'detect-changes');
  const gate = job(ci, 'ci-ok');

  it('detect-changes reads it and passes it on as an output', () => {
    expect(detect).toMatch(/CI_PAUSED:.*'pr:pause-ci'/);
    expect(detect).toMatch(/paused: \$\{\{ steps\.derive\.outputs\.paused \}\}/);
  });

  it('ci-ok receives it, so a paused PR is red', () => {
    expect(gate).toMatch(/PAUSED: \$\{\{ needs\.detect-changes\.outputs\.paused \}\}/);
  });
});

describe('the CI helpers are tested and classified as CI logic', () => {
  it('code-quality runs the .github/scripts tests', () => {
    expect(job(ci, 'code-quality')).toMatch(/run: node --test \.github\/scripts\/\*\.test\.mjs/);
  });

  it('filters.yml and the classifier list the same globs per group', () => {
    const filters = read('.github/filters.yml');
    const fromYaml: Record<string, string[]> = {};
    let group = '';
    for (const line of filters.split('\n')) {
      const g = /^([a-z_]+):\s*$/.exec(line);
      if (g) {
        group = g[1];
        fromYaml[group] = [];
        continue;
      }
      const item = /^ {2}- '([^']+)'/.exec(line);
      if (item && group) fromYaml[group].push(item[1]);
    }
    expect(fromYaml).toEqual(GROUP_GLOBS);
  });
});
