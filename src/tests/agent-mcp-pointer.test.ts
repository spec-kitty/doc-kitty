/**
 * FR-009 (WP01/T005): the opt-in MCP wiring pointer. With `links.mcp: true`
 * the machine index carries `_links.mcp` and llms.txt gains its one-line
 * mention; the default (`mcp` unset or false) emits neither, byte-compatibly.
 *
 * #307: `@spec-kitty/doc-kitty-mcp` is not published (publishing is #408), so
 * neither surface may present it as installable. The `href` points at the
 * build-from-source instructions, not an `npm:` name, and both the title and
 * the llms.txt line say plainly that the server must be built from source.
 * Route-level unit tests with a mocked collection — the example site itself
 * ships with the knob OFF.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: async () => [
    { id: 'guides/a', body: '# A\n', data: { title: 'A', doc_status: 'active' } },
  ],
}));

const { agentIndexRoute } = await import('../lib/routes/agent-index.js');
const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');
const { MCP_BUILD_FROM_SOURCE_URL } = await import('../lib/routes/shared.js');

const SITE = new URL('https://docs.example/');

// A based deployment, exercised through withBase's BASE_URL like the other
// route suites (stubbed per test so the shared worker env is restored).
afterEach(() => {
  vi.unstubAllEnvs();
});

type Ctx = { site: URL };

async function getIndex(links?: { mcp?: boolean }) {
  const route = agentIndexRoute({ title: 'Docs', links }) as (ctx: Ctx) => Promise<Response>;
  return JSON.parse(await (await route({ site: SITE })).text());
}

async function getLlmsTxt(links?: { mcp?: boolean }) {
  const route = llmsTxtRoute({ title: 'Docs', links }) as (ctx: Ctx) => Promise<Response>;
  return (await route({ site: SITE })).text();
}

// Pinned independently of the exported constant so a change to it is a
// deliberate, visible test edit (deployed sites bake this URL in).
const BUILD_FROM_SOURCE =
  'https://github.com/spec-kitty/doc-kitty/blob/main/docs/guides/mcp-server-quickstart.md#build-from-source';

describe('links.mcp (FR-009)', () => {
  it('is off by default: no _links.mcp and no llms.txt mention', async () => {
    vi.stubEnv('BASE_URL', '/docs');
    const index = await getIndex();
    expect('mcp' in index._links).toBe(false);
    expect(await getLlmsTxt()).not.toContain('MCP server');
  });

  it('emits nothing with links.mcp: false', async () => {
    vi.stubEnv('BASE_URL', '/docs');
    const index = await getIndex({ mcp: false });
    expect('mcp' in index._links).toBe(false);
    const llms = await getLlmsTxt({ mcp: false });
    expect(llms).not.toContain('MCP server');
    expect(llms).not.toContain('doc-kitty-mcp');
  });

  it('points at the build-from-source instructions, never an uninstallable npm name (#307)', async () => {
    vi.stubEnv('BASE_URL', '/docs');
    const index = await getIndex({ mcp: true });
    expect(index._links.mcp).toEqual({
      href: BUILD_FROM_SOURCE,
      title: 'Doc-Kitty MCP server (not published yet: build it from source, see href)',
      usage: 'doc-kitty-mcp --site https://docs.example/docs',
    });
    // No registry form of any kind until the package is published (#408).
    expect(JSON.stringify(index._links.mcp)).not.toContain('npm:');
    expect(index._links.mcp.usage).not.toContain('npx');

    const llms = await getLlmsTxt({ mcp: true });
    expect(llms).not.toContain('npm:');
    const mcpLines = llms.split('\n').filter((line) => line.startsWith('MCP server'));
    expect(mcpLines).toEqual([
      'MCP server (not published yet, build it from source: ' + BUILD_FROM_SOURCE + '): ' +
        'once built, doc-kitty-mcp --site https://docs.example/docs serves the machine index ' +
        '(https://docs.example/docs/api/index.json) to MCP clients',
    ]);
  });

  it('targets a heading that exists in the quickstart, so the emitted link resolves', () => {
    // The anchor is GitHub's slug of the heading; renaming the heading would
    // silently break every emitted pointer.
    const quickstart = readFileSync(
      fileURLToPath(new URL('../../docs/guides/mcp-server-quickstart.md', import.meta.url)),
      'utf8',
    );
    expect(MCP_BUILD_FROM_SOURCE_URL).toBe(BUILD_FROM_SOURCE);
    expect(MCP_BUILD_FROM_SOURCE_URL.endsWith('#build-from-source')).toBe(true);
    expect(quickstart.split('\n')).toContain('## Build from source');
  });
});
