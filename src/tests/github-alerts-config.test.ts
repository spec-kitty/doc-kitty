/**
 * The `githubAlerts` option gates the `doc-kitty:github-alerts` integration
 * (#250, ADR-0068): absent by default (byte-identical array), present when set,
 * last before Starlight, and registering exactly the `githubAlerts` remark pass.
 */
import { describe, it, expect, vi } from 'vitest';
import githubAlerts from '../lib/remark/github-alerts.js';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({ name: '@astrojs/starlight', __starlightConfig: config, hooks: {} }),
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');

type Integration = { name?: string; hooks?: Record<string, (arg: unknown) => void> };
const names = (arr: unknown[]) => (arr as Integration[]).map((i) => i.name);

describe('githubAlerts option', () => {
  it('is off by default: no github-alerts integration', () => {
    expect(names(defineDocKittyIntegrations({ title: 'Docs' }))).not.toContain('doc-kitty:github-alerts');
    expect(names(defineDocKittyIntegrations({ title: 'Docs', githubAlerts: false }))).not.toContain(
      'doc-kitty:github-alerts',
    );
  });

  it('when on, sits immediately before Starlight and registers only the remark pass', () => {
    const arr = defineDocKittyIntegrations({ title: 'Docs', githubAlerts: true }) as Integration[];
    const list = names(arr);
    const at = list.indexOf('doc-kitty:github-alerts');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(list[at + 1]).toBe('@astrojs/starlight');

    const calls: unknown[] = [];
    arr[at].hooks!['astro:config:setup']({ updateConfig: (c: unknown) => calls.push(c) });
    expect(calls).toEqual([{ markdown: { remarkPlugins: [githubAlerts] } }]);
  });
});
