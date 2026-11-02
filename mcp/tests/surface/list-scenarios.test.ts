/**
 * list_scenarios (T015): the published features[] pass through byte-derived
 * with nesting intact (each scenario's anchor, examples?, line, name,
 * outline, result?, rule?, steps, tags; result.status is REAL data passed
 * through). A site without the surface answers a structured
 * { available: false } - not an error.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../corpus/helpers.js';
import { SurfaceClient } from './harness.js';
import { connectFixture, resultJson } from './helpers.js';

describe('list_scenarios', () => {
  describe('against the example corpus (surface present)', () => {
    let client: SurfaceClient;
    let envelope: Record<string, unknown>;

    beforeAll(async () => {
      client = await connectFixture('example');
      const result = await client.callTool('list_scenarios');
      expect(result.isError).toBeFalsy();
      envelope = resultJson(result) as Record<string, unknown>;
      expect(result.structuredContent).toEqual(envelope);
    });

    afterAll(async () => {
      await client.close();
    });

    it('emits the pinned envelope: version, generated_from, count, results, features', () => {
      // Expectations recomputed by independently re-reading the published artifact.
      const published = JSON.parse(readFileSync(`${fixture('example')}/api/scenarios.json`, 'utf8')) as {
        version: string;
        generated_by: string;
        count: number;
        results: Record<string, unknown>;
        features: unknown[];
      };
      expect(Object.keys(envelope)).toEqual(['version', 'generated_from', 'count', 'results', 'features']);
      expect(envelope.version).toBe(published.version);
      expect(envelope.generated_from).toBe(published.generated_by);
      expect(envelope.count).toBe(published.count);
      expect(envelope.results).toEqual(published.results);
    });

    it('passes features[] through byte-derived - no flattening, no added pageId, no stripped fields', () => {
      const publishedText = readFileSync(`${fixture('example')}/api/scenarios.json`, 'utf8');
      const publishedFeatures = JSON.parse(publishedText).features;
      // Byte-parity on the passed-through array (same parse -> same serialization).
      expect(JSON.stringify(envelope.features)).toBe(JSON.stringify(publishedFeatures));
    });

    it('keeps scenario nesting intact, including real result.status data', () => {
      const features = envelope.features as Array<{
        id: string;
        scenarios: Array<Record<string, unknown>>;
      }>;
      expect(features.length).toBeGreaterThan(0);
      expect(features[0]!.id).toBe('behaviour/hr/request-leave');
      const first = features[0]!.scenarios[0]!;
      // The pinned per-scenario field set, with optionals when the corpus carries them.
      for (const key of ['name', 'rule', 'anchor', 'line', 'tags', 'outline', 'steps', 'examples', 'result']) {
        expect(first, `scenario key ${key}`).toHaveProperty(key);
      }
      expect((first.result as { status: string }).status).toBe('passed');
      expect(Array.isArray(first.steps)).toBe(true);
      expect((first.steps as Array<{ keyword: string; text: string }>)[0]).toEqual({
        keyword: 'When',
        text: 'the employee requests 5 days of leave starting on 3 November',
      });
      // No invented pageId synthesis - the feature's own id is the identity.
      expect(Object.keys(features[0]!)).not.toContain('pageId');
    });
  });

  it('a site without the scenarios surface answers { available: false }, not an error', async () => {
    const client = await connectFixture('surface'); // its index links no scenarios surface
    try {
      const result = await client.callTool('list_scenarios');
      expect(result.isError).toBeFalsy();
      expect(resultJson(result)).toEqual({ available: false });
      expect(result.structuredContent).toEqual({ available: false });
    } finally {
      await client.close();
    }
  });

  it('a pages-gated corpus can still serve the scenarios surface (degradation is per-surface)', async () => {
    const client = await connectFixture('gated-pages');
    try {
      const info = resultJson(await client.callTool('get_site_info')) as { capabilities: Record<string, boolean> };
      expect(info.capabilities.pages).toBe(false);
      expect(info.capabilities.scenarios).toBe(true);
      const scenarios = resultJson(await client.callTool('list_scenarios')) as { count?: number };
      expect(scenarios.count).toBe(3);
    } finally {
      await client.close();
    }
  });
});
