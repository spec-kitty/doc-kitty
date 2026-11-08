/**
 * get_site_info (T012): identity fields mirror the data model, capabilities
 * announce the gated flags (never hidden), and the pre-FR-008 migration
 * allowance OMITS buildId rather than inventing one.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SurfaceClient } from './harness.js';
import { connectFixture, resultJson } from './helpers.js';

describe('get_site_info', () => {
  describe('against the full example corpus', () => {
    let client: SurfaceClient;
    let info: Record<string, unknown>;

    beforeAll(async () => {
      client = await connectFixture('example');
      const result = await client.callTool('get_site_info');
      expect(result.isError).toBeFalsy();
      info = resultJson(result) as Record<string, unknown>;
    });

    afterAll(async () => {
      await client.close();
    });

    it('reports site identity fields from the index and launch config', () => {
      expect(info.siteTitle).toBe('DocKitty Example');
      expect(info.contractVersion).toBe('3');
      expect(info.baseUrl).toMatch(/^\/.*fixtures\/example$/); // fs launch: the local dist dir
      expect(info.buildId).toMatch(/^[0-9a-f]{64}$/);
      // 70 docs pages + the 3 synthetic OpenAPI version records (WP03).
      expect(info.pageCount).toBe(73);
    });

    it('announces all surfaces live', () => {
      expect(info.capabilities).toEqual({ pages: true, scenarios: true, resources: true });
    });

    it('carries the identical object in structuredContent and the text block', () => {
      // (re-call to compare the two channels of one result)
      return client.callTool('get_site_info').then((result) => {
        expect(result.structuredContent).toEqual(info);
      });
    });
  });

  it('announces PAGES_LINKS_GATED via capabilities on the gated corpus', async () => {
    const client = await connectFixture('gated-pages');
    try {
      const result = await client.callTool('get_site_info');
      expect(result.isError).toBeFalsy();
      const info = resultJson(result) as Record<string, unknown>;
      expect(info.capabilities).toEqual({ pages: false, scenarios: true, resources: true });
      expect(info.pageCount).toBe(0); // no per-page artifacts were promised, none loaded
    } finally {
      await client.close();
    }
  });

  it('omits buildId on a pre-FR-008 corpus instead of inventing one', async () => {
    const client = await connectFixture('pre-buildid');
    try {
      const result = await client.callTool('get_site_info');
      expect(result.isError).toBeFalsy();
      const info = resultJson(result) as Record<string, unknown>;
      expect(info).not.toHaveProperty('buildId');
      expect(info.pageCount).toBe(3);
    } finally {
      await client.close();
    }
  });
});
