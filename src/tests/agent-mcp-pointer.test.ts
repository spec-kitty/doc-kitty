/**
 * FR-009 (WP01/T005): the opt-in MCP wiring pointer. With `links.mcp: true`
 * the machine index carries `_links.mcp` (href `npm:@spec-kitty/doc-kitty-mcp`,
 * the `doc-kitty-mcp --site <this site's base URL>` launch line in `usage`)
 * and llms.txt gains its one-line mention; the default (`mcp` unset) emits
 * neither, byte-compatibly. Route-level unit tests with a mocked collection —
 * the example site itself ships with the knob OFF.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:content', () => ({
  getCollection: async () => [
    { id: 'guides/a', body: '# A\n', data: { title: 'A', doc_status: 'active' } },
  ],
}));

const { agentIndexRoute } = await import('../lib/routes/agent-index.js');
const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');

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

describe('links.mcp (FR-009)', () => {
  it('is off by default: no _links.mcp and no llms.txt mention', async () => {
    vi.stubEnv('BASE_URL', '/docs');
    const index = await getIndex();
    expect('mcp' in index._links).toBe(false);
    expect(await getLlmsTxt()).not.toContain('MCP server');
  });

  it('emits the pointer with this site\'s base URL substituted, and the llms.txt one-liner', async () => {
    vi.stubEnv('BASE_URL', '/docs');
    const index = await getIndex({ mcp: true });
    expect(index._links.mcp).toEqual({
      href: 'npm:@spec-kitty/doc-kitty-mcp',
      title: 'Doc-Kitty MCP server',
      usage: 'doc-kitty-mcp --site https://docs.example/docs',
    });
    // Until the C-002 publishing ruling, the usage names the packed-tarball
    // bin — never an npmjs `npx -y` form.
    expect(index._links.mcp.usage).not.toContain('npx');

    const llms = await getLlmsTxt({ mcp: true });
    const mcpLines = llms.split('\n').filter((line) => line.startsWith('MCP server:'));
    expect(mcpLines).toEqual([
      'MCP server: doc-kitty-mcp --site https://docs.example/docs serves the machine index ' +
        '(https://docs.example/docs/api/index.json) to MCP clients (npm:@spec-kitty/doc-kitty-mcp)',
    ]);
  });
});
