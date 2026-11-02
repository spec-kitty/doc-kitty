/**
 * FR-008 build identity over a real example build (WP01/T004 + DoD):
 *
 *   - one build stamps the SAME `buildId` into the machine index, EVERY
 *     per-page artifact and the scenarios artifact (the torn-read signal);
 *   - two consecutive builds of unchanged sources produce byte-equal identity
 *     (reproducibility: no artifact carries a build clock, so identical
 *     sources hash identically — squad A3's determinism claim, asserted);
 *   - a content edit changes it (a rebuild after touching one doc's body
 *     produces a different identity everywhere);
 *   - FR-003: the index's `sections[]` equals the projection of the example's
 *     own `docs/_meta/sections.yaml`, in registry order;
 *
 * Each build lands in its own DK_OUTDIR (agent-links.test.ts precedent), so
 * this suite never touches another suite's dist; the example tree itself is
 * only ADD-probed (a temporary published page under `example/docs/`), restored
 * in a finally.
 */
import { spawnSync } from 'node:child_process';
import {
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type {
  AgentIncludeRef,
  AgentIndex,
  AgentLink,
  AgentPageLinks,
  AgentPagePayload,
  AgentRecordEntry,
  AgentRecordLinks,
  AgentTitledLink,
  AudienceRecord,
  FeatureRecord,
  IndexLinks,
  McpWiringPointer,
  PageGeneratedStamp,
  PageSourceRef,
  PageVerifiedStamp,
  ResolvedRelatedRecord,
  ScenarioExamples,
  ScenarioIndex,
  ScenarioRecord,
  ScenarioResult,
  ScenarioRunInfo,
  ScenarioStep,
  SectionRecord,
} from '../lib/contract.js';
import { parseSectionRegistry } from '../lib/sections.js';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXAMPLE = path.join(REPO_ROOT, 'example');
const OUT_RUN1 = 'dist-wp01-buildid-run1';
const OUT_RUN2 = 'dist-wp01-buildid-run2';
const OUT_EDIT = 'dist-wp01-buildid-edit';
const PROBE = path.join(EXAMPLE, 'docs', 'buildid-probe.md');
const HEX64 = /^[0-9a-f]{64}$/;

const cleanup: string[] = [];
afterAll(() => {
  for (const dir of cleanup) rmSync(dir, { recursive: true, force: true });
  rmSync(PROBE, { force: true });
});

// Exhaustive key tables, one per contract record. `satisfies Record<keyof T, true>`
// makes tsc fail on a key the contract has but this table lacks AND on a key
// the table has but the contract lacks, so the tables cannot rot. contract.ts
// stays type-only (contract-module.test.ts), hence the tables live here. The
// routes spread `toAgentRecord()` (a parallel type), which skips excess-property
// checks, so the emitted JSON is checked against the tables at run time below.
const KEYS = {
  AgentLink: { href: true } satisfies Record<keyof AgentLink, true>,
  AgentTitledLink: { href: true, title: true } satisfies Record<keyof AgentTitledLink, true>,
  McpWiringPointer: { href: true, title: true, usage: true } satisfies Record<keyof McpWiringPointer, true>,
  SectionRecord: { id: true, label: true, order: true, purpose: true } satisfies Record<keyof SectionRecord, true>,
  ResolvedRelatedRecord: { ref: true, title: true, kind: true, doc_status: true } satisfies Record<
    keyof ResolvedRelatedRecord,
    true
  >,
  AudienceRecord: { profile: true, guidance_text: true } satisfies Record<keyof AudienceRecord, true>,
  AgentRecordLinks: { self: true, html: true, related: true } satisfies Record<keyof AgentRecordLinks, true>,
  AgentRecordEntry: {
    slug: true, route: true, section: true, title: true, description: true, type: true, doc_status: true,
    kind: true, tags: true, related: true, priority: true, updated: true, source: true, audience: true,
    url: true, _links: true,
  } satisfies Record<keyof AgentRecordEntry, true>,
  IndexLinks: {
    self: true, llms: true, sitemap: true, contentGraph: true, rss: true, bibliography: true,
    scenarios: true, mcp: true,
  } satisfies Record<keyof IndexLinks, true>,
  AgentIndex: {
    title: true, version: true, count: true, buildId: true, generatedFrom: true, sections: true,
    pages: true, _links: true,
  } satisfies Record<keyof AgentIndex, true>,
  PageGeneratedStamp: { by: true, at: true, content_hash: true } satisfies Record<keyof PageGeneratedStamp, true>,
  PageVerifiedStamp: { by: true, at: true } satisfies Record<keyof PageVerifiedStamp, true>,
  PageSourceRef: { resource: true, title: true } satisfies Record<keyof PageSourceRef, true>,
  AgentIncludeRef: { src: true, scenario: true, tags: true } satisfies Record<keyof AgentIncludeRef, true>,
  AgentPageLinks: { self: true, up: true, html: true, related: true } satisfies Record<keyof AgentPageLinks, true>,
  AgentPagePayload: {
    slug: true, route: true, section: true, title: true, description: true, type: true, doc_status: true,
    kind: true, tags: true, related: true, priority: true, updated: true, source: true, audience: true,
    url: true, authors: true, keywords: true, generated: true, verified: true, sources: true, includes: true,
    markdown: true, buildId: true, _links: true,
  } satisfies Record<keyof AgentPagePayload, true>,
  ScenarioResult: { status: true, retried: true, counts: true } satisfies Record<keyof ScenarioResult, true>,
  ScenarioStep: { keyword: true, text: true } satisfies Record<keyof ScenarioStep, true>,
  ScenarioExamples: { name: true, tags: true, header: true, rows: true, results: true } satisfies Record<
    keyof ScenarioExamples,
    true
  >,
  ScenarioRecord: {
    name: true, rule: true, anchor: true, line: true, tags: true, outline: true, steps: true,
    examples: true, result: true,
  } satisfies Record<keyof ScenarioRecord, true>,
  FeatureRecord: {
    id: true, title: true, url: true, source: true, doc_status: true, glossary_context: true, tags: true,
    related: true, scenarios: true, results: true,
  } satisfies Record<keyof FeatureRecord, true>,
  ScenarioRunInfo: { report: true, format: true, as_of: true, revision: true } satisfies Record<
    keyof ScenarioRunInfo,
    true
  >,
  ScenarioIndex: {
    version: true, generated_by: true, count: true, buildId: true, results: true, features: true,
  } satisfies Record<keyof ScenarioIndex, true>,
};
type RecordName = keyof typeof KEYS;

/** Nested record-typed properties, by owning record, so the walk descends the contract's shape. */
const CHILDREN: { [R in RecordName]?: Record<string, RecordName> } = {
  AgentRecordEntry: { related: 'ResolvedRelatedRecord', audience: 'AudienceRecord', _links: 'AgentRecordLinks' },
  AgentRecordLinks: { self: 'AgentLink', html: 'AgentLink', related: 'AgentTitledLink' },
  IndexLinks: {
    self: 'AgentLink', llms: 'AgentLink', sitemap: 'AgentLink', contentGraph: 'AgentLink', rss: 'AgentLink',
    bibliography: 'AgentLink', scenarios: 'AgentLink', mcp: 'McpWiringPointer',
  },
  AgentIndex: { sections: 'SectionRecord', pages: 'AgentRecordEntry', _links: 'IndexLinks' },
  AgentPageLinks: { self: 'AgentLink', up: 'AgentLink', html: 'AgentLink', related: 'AgentTitledLink' },
  AgentPagePayload: {
    related: 'ResolvedRelatedRecord', audience: 'AudienceRecord', generated: 'PageGeneratedStamp',
    verified: 'PageVerifiedStamp', sources: 'PageSourceRef', includes: 'AgentIncludeRef', _links: 'AgentPageLinks',
  },
  ScenarioExamples: {},
  ScenarioRecord: { steps: 'ScenarioStep', examples: 'ScenarioExamples', result: 'ScenarioResult' },
  FeatureRecord: { scenarios: 'ScenarioRecord' },
  ScenarioIndex: { results: 'ScenarioRunInfo', features: 'FeatureRecord' },
};

/** Every emitted key, at every record level, that the contract's table does not list. */
function undeclaredKeys(value: unknown, record: RecordName, where: string): string[] {
  if (Array.isArray(value)) return value.flatMap((item, i) => undeclaredKeys(item, record, `${where}[${i}]`));
  if (value === null || typeof value !== 'object') return [];
  const declared = KEYS[record] as Record<string, true>;
  const out: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (!(key in declared)) out.push(`${where}.${key}`);
    const childRecord = CHILDREN[record]?.[key];
    if (childRecord) out.push(...undeclaredKeys(child, childRecord, `${where}.${key}`));
  }
  return out;
}

function build(outdir: string): void {
  const env: NodeJS.ProcessEnv = { ...process.env, DK_OUTDIR: outdir };
  delete env.BASE_URL;
  const built = spawnSync('pnpm', ['--filter', 'example', 'build'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env,
  });
  expect(built.status, `build (${outdir}) stderr:\n${built.stderr}`).toBe(0);
}

interface IndexDoc {
  buildId: string;
  sections: unknown;
}

function readJson(dir: string, ...segments: string[]): unknown {
  return JSON.parse(readFileSync(path.join(EXAMPLE, dir, ...segments), 'utf8'));
}

function pageBuildIds(dir: string): Map<string, string> {
  const root = path.join(EXAMPLE, dir, 'api', 'pages');
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const full = path.join(d, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        const payload = readJson(dir, 'api', 'pages', path.relative(root, full)) as { buildId: string };
        out.set(path.relative(root, full), payload.buildId);
      }
    }
  };
  walk(root);
  return out;
}

describe('build identity (FR-008) on the example build', () => {
  let index1: IndexDoc;
  let pages1: Map<string, string>;

  beforeAll(() => {
    build(OUT_RUN1);
    build(OUT_RUN2);
    cleanup.push(path.join(EXAMPLE, OUT_RUN1), path.join(EXAMPLE, OUT_RUN2));
    index1 = readJson(OUT_RUN1, 'api', 'index.json') as IndexDoc;
    pages1 = pageBuildIds(OUT_RUN1);
  }, 300_000);

  it('one build stamps one identity across the index, every page artifact and scenarios', () => {
    expect(index1.buildId).toMatch(HEX64);
    expect(pages1.size).toBeGreaterThan(0);
    for (const [file, id] of pages1) expect(id, `buildId of ${file}`).toBe(index1.buildId);
    expect((readJson(OUT_RUN1, 'api', 'scenarios.json') as { buildId: string }).buildId).toBe(index1.buildId);
  });

  it('emits no key the published contract does not declare (index, every page, scenarios)', () => {
    const undeclared = undeclaredKeys(index1, 'AgentIndex', 'index');
    for (const file of pages1.keys()) {
      undeclared.push(
        ...undeclaredKeys(readJson(OUT_RUN1, 'api', 'pages', file), 'AgentPagePayload', `pages/${file}`),
      );
    }
    undeclared.push(...undeclaredKeys(readJson(OUT_RUN1, 'api', 'scenarios.json'), 'ScenarioIndex', 'scenarios'));
    expect(undeclared).toEqual([]);
  });

  it('is deterministic: an unchanged rebuild yields the same identity', () => {
    expect((readJson(OUT_RUN2, 'api', 'index.json') as IndexDoc).buildId).toBe(index1.buildId);
  });

  it('emits sections[] from the section registry, in registry order (FR-003)', () => {
    const registry = parseSectionRegistry(
      readFileSync(path.join(EXAMPLE, 'docs', '_meta', 'sections.yaml'), 'utf8'),
    );
    expect(registry.length).toBeGreaterThan(0);
    expect(index1.sections).toEqual(
      registry.map((entry) => ({
        id: entry.id,
        label: entry.label,
        order: entry.order,
        ...(entry.purpose !== undefined ? { purpose: entry.purpose } : {}),
      })),
    );
  });

  it('changes when a source page changes, and nowhere carries a stale value', () => {
    writeFileSync(
      PROBE,
      [
        '---',
        'title: Build-identity probe',
        'description: Temporary page added and removed by agent-api-build-identity.test.ts.',
        'doc_status: active',
        'updated: 2026-01-01',
        'kind: How-To',
        '---',
        '',
        'Body written only to perturb the corpus hash.',
        '',
      ].join('\n'),
    );
    try {
      build(OUT_EDIT);
      cleanup.push(path.join(EXAMPLE, OUT_EDIT));
      const edited = readJson(OUT_EDIT, 'api', 'index.json') as IndexDoc;
      expect(edited.buildId).toMatch(HEX64);
      expect(edited.buildId).not.toBe(index1.buildId);
      // The build changed the corpus; also assert the fresh value still spans
      // all three artifact kinds within the edited build.
      expect((readJson(OUT_EDIT, 'api', 'scenarios.json') as { buildId: string }).buildId).toBe(edited.buildId);
      for (const [file, id] of pageBuildIds(OUT_EDIT)) {
        expect(id, `edited buildId of ${file}`).toBe(edited.buildId);
      }
    } finally {
      rmSync(PROBE, { force: true });
    }
  }, 180_000);
});
