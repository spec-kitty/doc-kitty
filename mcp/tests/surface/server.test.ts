/**
 * server.ts (T011): handshake identity, advertised capabilities (tools only -
 * no resources capability until WP04), the pinned five-tool surface, and the
 * launch-configuration boundary guard.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/server';
import { createServer, SERVER_NAME, serverVersion } from '../../src/server.js';
import { TOOL_NAMES } from '../../src/surface/tools.js';
import { MalformedCorpusError } from '../../src/errors.js';
import { SurfaceClient, WireError } from './harness.js';
import { connectFixture, loadFsCorpus } from './helpers.js';

const pkgVersion = (): string =>
  (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;

describe('MCP server core', () => {
  let server: McpServer;
  let client: SurfaceClient;

  beforeAll(async () => {
    const { snapshot, config } = await loadFsCorpus('example');
    server = createServer(snapshot, config);
    client = await SurfaceClient.connect(server);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  it('identifies itself in the initialize handshake from the package manifest', () => {
    expect(client.initializeResult.serverInfo).toEqual({ name: SERVER_NAME, version: pkgVersion() });
    expect(SERVER_NAME).toBe('doc-kitty-mcp');
    expect(serverVersion()).toBe(pkgVersion());
  });

  it('advertises tools and the WP04 resources capability (never prompts)', () => {
    const capabilities = client.initializeResult.capabilities;
    expect(capabilities).toHaveProperty('tools');
    // WP04 (FR-011): the resources surface registers - capability and
    // handlers as one unit, static snapshot so listChanged is false.
    expect(capabilities).toHaveProperty('resources', { listChanged: false });
    expect(capabilities).not.toHaveProperty('prompts');
  });

  it('lists exactly the five contract tools in registration order', async () => {
    const tools = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
    }
  });

  it('declares the pinned input shapes: required id/query; optional section', async () => {
    const tools = await client.listTools();
    const byName = new Map(tools.map((t) => [t.name, t]));
    expect(byName.get('get_page')!.inputSchema).toMatchObject({
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
      additionalProperties: false,
    });
    expect(byName.get('search_pages')!.inputSchema).toMatchObject({
      type: 'object',
      required: ['query'],
      properties: { query: { type: 'string' } },
      additionalProperties: false,
    });
    expect(byName.get('list_pages')!.inputSchema).toMatchObject({
      type: 'object',
      properties: { section: { type: 'string' } },
      additionalProperties: false,
    });
    expect(byName.get('get_site_info')!.inputSchema).toMatchObject({ type: 'object' });
    expect(byName.get('list_scenarios')!.inputSchema).toMatchObject({ type: 'object' });
  });

  it('rejects an unknown tool at the wire level (not as a tool result)', async () => {
    const failure = await client.callTool('frobnicate_pages').then(
      () => undefined,
      (error: WireError) => error,
    );
    expect(failure).toBeInstanceOf(WireError);
    expect(failure!.code).toBe(-32602);
    expect(failure!.message).toContain('frobnicate_pages');
  });

  it('guards the launch configuration at the createServer boundary', async () => {
    const { snapshot, config } = await loadFsCorpus('surface');
    expect(() => createServer(snapshot, { ...config, resourceListingThreshold: 0 })).toThrowError(MalformedCorpusError);
    expect(() => createServer(snapshot, { ...config, resourceListingThreshold: 0 })).toThrowError(
      'launch config: resourceListingThreshold - expected an integer >= 1',
    );
  });

  it('smoke: a connected client can call get_site_info (the wiring works end to end)', async () => {
    const byFixture = await connectFixture('surface');
    try {
      const result = await byFixture.callTool('get_site_info');
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toHaveProperty('siteTitle', 'Surface Fixture');
    } finally {
      await byFixture.close();
    }
  });
});
