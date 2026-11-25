/**
 * The `tomAnnex` option gates the evidence index (#401, operator ruling Q11 on
 * #455): off by default, so a site that classifies pages publishes nothing new
 * until it opts in; on, the `doc-kitty:tom-annex` integration is registered
 * after the content-graph route and before served-surface detection.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({ name: '@astrojs/starlight', __starlightConfig: config, hooks: {} }),
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');

type Integration = { name?: string };
const names = (arr: unknown[]) => (arr as Integration[]).map((i) => i.name);

describe('tomAnnex option', () => {
  it('is off by default: no tom-annex integration, so no route, link or OKF copy', () => {
    expect(names(defineDocKittyIntegrations({ title: 'Docs' }))).not.toContain('doc-kitty:tom-annex');
    expect(names(defineDocKittyIntegrations({ title: 'Docs', tomAnnex: false }))).not.toContain('doc-kitty:tom-annex');
  });

  it('when on, sits after the content-graph route and before served-surface detection', () => {
    const list = names(defineDocKittyIntegrations({ title: 'Docs', tomAnnex: true }));
    const at = list.indexOf('doc-kitty:tom-annex');
    expect(at).toBeGreaterThan(list.indexOf('doc-kitty:content-graph'));
    expect(at).toBeLessThan(list.indexOf('doc-kitty:served-surfaces'));
  });
});
