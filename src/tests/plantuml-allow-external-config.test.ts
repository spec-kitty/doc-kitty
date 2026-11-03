import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreInternalEnv } from './helpers/restore-internal-env';

/**
 * Build half of the PlantUML external-include opt-in (#268, ADR-0074): the option,
 * eager validation, the always-published handoff, and the FR-003 notice.
 */
vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({ name: '@astrojs/starlight', __starlightConfig: config, hooks: {} }),
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');
const { PlantumlAllowExternalError } = await import('../lib/plantuml-external.mjs');
const { INTERNAL_ENV_NAMES, clearInternalEnv } = await import('../lib/internal-env.mjs');

const HANDOFF = 'DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED';
const ENV = 'DK_PLANTUML_ALLOW_EXTERNAL';
const ALLOW = ['http://plantuml.internal/includes/', 'https://example.org/lib/'];

restoreInternalEnv();

let savedEnv: string | undefined;
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  savedEnv = process.env[ENV];
  delete process.env[ENV];
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  if (savedEnv === undefined) delete process.env[ENV];
  else process.env[ENV] = savedEnv;
});

const notices = () => warn.mock.calls.map((c) => String(c[0])).filter((m) => m.startsWith('[dk-plantuml]'));
const handoff = () => JSON.parse(process.env[HANDOFF] ?? 'null');

describe('plantumlAllowExternal: eager validation', () => {
  it.each([[['http://host']]])('refuses invalid site value %j at definition time (the resolver table owns every shape)', (value) => {
    // positive control: the same call with a valid value does not throw
    expect(() => defineDocKittyIntegrations({ title: 'Docs', plantumlAllowExternal: ALLOW })).not.toThrow();
    const attempt = () => defineDocKittyIntegrations({ title: 'Docs', plantumlAllowExternal: value as string[] });
    expect(attempt).toThrow(PlantumlAllowExternalError);
    expect(attempt).toThrow('invalid plantumlAllowExternal (site configuration)');
  });

  it('refuses an invalid environment value', () => {
    process.env[ENV] = 'INTERNET';
    expect(() => defineDocKittyIntegrations({ title: 'Docs' })).toThrow('use lowercase "internet"');
    process.env[ENV] = 'internet';
    expect(() => defineDocKittyIntegrations({ title: 'Docs' })).not.toThrow();
  });
});

describe('plantumlAllowExternal: handoff', () => {
  it('unset publishes sandbox and prints nothing', () => {
    defineDocKittyIntegrations({ title: 'Docs' });
    expect(handoff()).toEqual({ mode: 'sandbox', entries: [], source: 'default' });
    expect(notices()).toEqual([]);
    // positive control: the same capture sees a notice once the setting is on
    defineDocKittyIntegrations({ title: 'Docs', plantumlAllowExternal: ALLOW });
    expect(notices()).toHaveLength(1);
  });

  it('allowlist from site publishes the resolution', () => {
    defineDocKittyIntegrations({ title: 'Docs', plantumlAllowExternal: ALLOW });
    expect(handoff()).toEqual({ mode: 'allowlist', entries: ALLOW, source: 'site configuration' });
  });

  it('environment wins over the site value', () => {
    process.env[ENV] = 'internet';
    defineDocKittyIntegrations({ title: 'Docs', plantumlAllowExternal: ALLOW });
    expect(handoff()).toEqual({ mode: 'internet', entries: [], source: 'environment' });
  });

  it('clearInternalEnv removes it and INTERNAL_ENV_NAMES lists it', () => {
    defineDocKittyIntegrations({ title: 'Docs' });
    expect(process.env[HANDOFF]).toBeDefined();
    clearInternalEnv();
    expect(process.env[HANDOFF]).toBeUndefined();
    expect(INTERNAL_ENV_NAMES).toContain(HANDOFF);
  });
});

describe('plantumlAllowExternal: build notice (FR-003)', () => {
  it('allowlist prints exactly one notice with the full verify command', () => {
    defineDocKittyIntegrations({ title: 'Docs', diagrams: true, plantumlAllowExternal: ALLOW });
    expect(notices()).toEqual([
      '[dk-plantuml] declared PlantUML allowlist mode (from site configuration): ' +
        `${ALLOW.join(', ')}. The build cannot see the service; verify it with: ` +
        'dockitty-assert-plantuml-no-remote-include --astro-config <path> --server <url> ' +
        '--canary-host <host> --canary-port 18091 --service-container <container>',
    ]);
  });

  it('internet from the environment warns and includes --service-container', () => {
    process.env[ENV] = 'internet';
    defineDocKittyIntegrations({ title: 'Docs', diagrams: true });
    expect(notices()).toEqual([
      '[dk-plantuml] WARNING: declared PlantUML internet mode (from environment DK_PLANTUML_ALLOW_EXTERNAL): ' +
        'the service may fetch any URL, including internal networks and cloud metadata endpoints. ' +
        'Verify it with: dockitty-assert-plantuml-no-remote-include --astro-config <path> --server <url> ' +
        '--canary-host <host> --canary-port 18091 --service-container <container>',
    ]);
    expect(notices()[0]).toContain('--service-container <container>');
  });

  it('prints once per call', () => {
    defineDocKittyIntegrations({ title: 'Docs', plantumlAllowExternal: ALLOW });
    defineDocKittyIntegrations({ title: 'Docs', plantumlAllowExternal: ALLOW });
    expect(notices()).toHaveLength(2);
  });

  it('with diagrams off, both modes say nothing is rendered; with diagrams on, neither does', () => {
    const suffix = ' (diagrams are off, so nothing is rendered)';
    defineDocKittyIntegrations({ title: 'Docs', plantumlAllowExternal: ALLOW });
    defineDocKittyIntegrations({ title: 'Docs', plantumlAllowExternal: 'internet' });
    defineDocKittyIntegrations({ title: 'Docs', diagrams: true, plantumlAllowExternal: ALLOW });
    const [a, b, c] = notices();
    expect(a.endsWith(suffix)).toBe(true);
    expect(b.endsWith(suffix)).toBe(true);
    expect(c.endsWith(suffix)).toBe(false);
  });
});

describe('plantumlAllowExternal: existing behaviour untouched', () => {
  it('diagrams: true still adds integrations, and the option does not change the array', () => {
    const off = defineDocKittyIntegrations({ title: 'Docs' }).length;
    const on = defineDocKittyIntegrations({ title: 'Docs', diagrams: true }).length;
    expect(on).toBeGreaterThan(off);
    expect(defineDocKittyIntegrations({ title: 'Docs', diagrams: true, plantumlAllowExternal: ALLOW }).length).toBe(on);
  });
});
