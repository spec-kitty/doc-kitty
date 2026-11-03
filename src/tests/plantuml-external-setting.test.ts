import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  PlantumlAllowExternalError,
  describeDeclared,
  resolvePlantumlAllowExternal,
} from '../lib/plantuml-external.mjs';

const MODULE_PATH = fileURLToPath(new URL('../lib/plantuml-external.mjs', import.meta.url));
const ENV = 'invalid DK_PLANTUML_ALLOW_EXTERNAL (environment)';
const SITE = 'invalid plantumlAllowExternal (site configuration)';

describe('resolves env, site, default', () => {
  const rows: Array<[string, { env?: string; site?: unknown }, unknown]> = [
    ['nothing set', {}, { mode: 'sandbox', entries: [], source: 'default' }],
    [
      'empty env, site allowlist (E5)',
      { env: '', site: ['https://a.example/x/'] },
      { mode: 'allowlist', entries: ['https://a.example/x/'], source: 'site configuration' },
    ],
    ['blank env (E5)', { env: '   ' }, { mode: 'sandbox', entries: [], source: 'default' }],
    [
      'env allowlist',
      { env: 'https://a.example/x/' },
      { mode: 'allowlist', entries: ['https://a.example/x/'], source: 'environment' },
    ],
    [
      'env two entries, trailing ;',
      { env: ' https://a.example/x/ ; https://b.example/y/;' },
      {
        mode: 'allowlist',
        entries: ['https://a.example/x/', 'https://b.example/y/'],
        source: 'environment',
      },
    ],
    [
      'env internet beats site allowlist (E6)',
      { env: 'internet', site: ['https://b.example/'] },
      { mode: 'internet', entries: [], source: 'environment' },
    ],
    [
      'env allowlist beats site internet (E6)',
      { env: 'https://a.example/x/', site: 'internet' },
      { mode: 'allowlist', entries: ['https://a.example/x/'], source: 'environment' },
    ],
    [
      'site internet',
      { site: 'internet' },
      { mode: 'internet', entries: [], source: 'site configuration' },
    ],
    [
      'order and case kept as written',
      { site: ['https://B.example/z/', 'https://A.example/x/'] },
      {
        mode: 'allowlist',
        entries: ['https://B.example/z/', 'https://A.example/x/'],
        source: 'site configuration',
      },
    ],
  ];
  it.each(rows)('%s', (_n, input, expected) => {
    expect(
      resolvePlantumlAllowExternal({ env: input.env, siteValue: input.site }),
    ).toEqual(expected);
  });

  it('returns a frozen result with fresh arrays', () => {
    const site = ['https://a.example/x/'];
    const r = resolvePlantumlAllowExternal({ env: undefined, siteValue: site });
    expect(Object.isFrozen(r)).toBe(true);
    expect(r.entries).not.toBe(site);
  });

  it('validates the site value even when the env wins', () => {
    expect(() =>
      resolvePlantumlAllowExternal({ env: 'internet', siteValue: 'sandbox' }),
    ).toThrow(PlantumlAllowExternalError);
    expect(() =>
      resolvePlantumlAllowExternal({ env: 'internet', siteValue: 'sandbox' }),
    ).toThrow(SITE);
  });
});

type Row = [string, { env?: string; site?: unknown }, string, string];
const MUST_END = 'must end with "/"';
const PREFIX = 'also allows "http://host.evil.com"';

describe('rejects each shape', () => {
  const DEFAULT_PORT = 'drop the default port';
  const rows: Row[] = [
    ['env sandbox', { env: 'sandbox' }, ENV, 'unknown value "sandbox"'],
    ['env yes', { env: 'yes' }, ENV, 'unknown value "yes"'],
    ['env INTERNET', { env: 'INTERNET' }, ENV, 'use lowercase "internet"'],
    ['env Internet', { env: 'Internet' }, ENV, 'use lowercase "internet"'],
    ['site Internet', { site: 'Internet' }, SITE, 'use lowercase "internet"'],
    ['site INTERNET', { site: 'INTERNET' }, SITE, 'use lowercase "internet"'],
    ['site true', { site: true }, SITE, 'unknown value'],
    ['site sandbox', { site: 'sandbox' }, SITE, 'unknown value'],
    ['site {}', { site: {} }, SITE, 'unknown value'],
    ['site 42', { site: 42 }, SITE, 'unknown value'],
    ['site []', { site: [] }, SITE, 'an empty allowlist is not sandbox'],
    ['env ;', { env: ';' }, ENV, 'an empty allowlist is not sandbox'],
    ['env "; ;"', { env: '; ;' }, ENV, 'an empty allowlist is not sandbox'],
    ['ftp env', { env: 'ftp://a.example/x/' }, ENV, 'is not an http(s) URL'],
    ['ftp site', { site: ['ftp://a.example/x/'] }, SITE, 'is not an http(s) URL'],
    ['not a url (site)', { site: ['not a url'] }, SITE, 'is not an http(s) URL'],
    ['not a url (env)', { env: 'not a url' }, ENV, 'unknown value "not a url"'],
    ['query', { site: ['https://a.example/x/?q=1'] }, SITE, 'is not an http(s) URL'],
    ['fragment', { site: ['https://a.example/x/#f'] }, SITE, 'is not an http(s) URL'],
    ['space', { site: ['https://a.example/x y/'] }, SITE, 'is not an http(s) URL'],
    ['space env', { env: 'https://a.example/x y/' }, ENV, 'is not an http(s) URL'],
    ['non-string entry', { site: [42] }, SITE, 'is not an http(s) URL'],
    ['bare host', { site: ['http://host'] }, SITE, MUST_END],
    ['bare host env', { env: 'http://host' }, ENV, MUST_END],
    ['host and port', { site: ['http://host:8080'] }, SITE, MUST_END],
    ['no trailing slash', { site: ['https://host/path'] }, SITE, MUST_END],
    [
      'semicolon in site entry',
      { site: ['https://a.example/x/;https://b.example/'] },
      SITE,
      'contains ";"',
    ],
    ['@ in path (site)', { site: ['https://a.example/a@b/'] }, SITE, 'contains "@"'],
    ['@ in path (env)', { env: 'https://a.example/a@b/' }, ENV, 'contains "@"'],
    ['@ segment', { site: ['https://a.example/@/'] }, SITE, 'contains "@"'],
    ['userinfo (site)', { site: ['https://user@a.example/x/'] }, SITE, 'contains "@"'],
    ['userinfo (env)', { env: 'https://user@a.example/x/' }, ENV, 'contains "@"'],
    ['default port 443', { site: ['https://a.example:443/'] }, SITE, DEFAULT_PORT],
    ['default port 80', { env: 'http://a.example:80/' }, ENV, DEFAULT_PORT],
    ['default port in path', { site: ['https://a.example/x:443/'] }, SITE, DEFAULT_PORT],
  ];

  it.each(rows)('%s', (_n, input, label, reason) => {
    const run = () => resolvePlantumlAllowExternal({ env: input.env, siteValue: input.site });
    expect(run).toThrow(PlantumlAllowExternalError);
    expect(run).toThrow(label);
    expect(run).toThrow(reason);
    expect(run).toThrow('accepted:');
  });

  it.each([
    ['bare host', { site: ['http://host'] }, SITE],
    ['bare host env', { env: 'http://host' }, ENV],
    ['host and port', { site: ['http://host:8080'] }, SITE],
    ['no trailing slash', { site: ['https://host/path'] }, SITE],
  ] as Array<[string, { env?: string; site?: unknown }, string]>)(
    'bare-host row asserts both substrings: %s',
    (_n, input, label) => {
      const run = () => resolvePlantumlAllowExternal({ env: input.env, siteValue: input.site });
      expect(run).toThrow(label);
      expect(run).toThrow(MUST_END);
      expect(run).toThrow(PREFIX);
    },
  );

  it('carries source and reason on the error', () => {
    try {
      resolvePlantumlAllowExternal({ env: 'yes' });
      expect.unreachable();
    } catch (e) {
      const err = e as PlantumlAllowExternalError;
      expect(err.name).toBe('PlantumlAllowExternalError');
      expect(err.source).toBe('environment');
      expect(err.reason).toBe('unknown value "yes"');
    }
  });
});

describe('describeDeclared', () => {
  it('describes an env allowlist', () => {
    const r = resolvePlantumlAllowExternal({
      env: 'https://a.example/x/; https://b.example/y/',
    });
    expect(describeDeclared(r)).toBe(
      'allowlist (from environment DK_PLANTUML_ALLOW_EXTERNAL): https://a.example/x/, https://b.example/y/',
    );
  });
  it('describes a site allowlist', () => {
    const r = resolvePlantumlAllowExternal({ siteValue: ['https://a.example/x/'] });
    expect(describeDeclared(r)).toBe(
      'allowlist (from site configuration): https://a.example/x/',
    );
  });
  it('describes internet from the environment', () => {
    expect(describeDeclared(resolvePlantumlAllowExternal({ env: 'internet' }))).toBe(
      'internet (from environment DK_PLANTUML_ALLOW_EXTERNAL)',
    );
  });
  it('describes internet from site', () => {
    expect(describeDeclared(resolvePlantumlAllowExternal({ siteValue: 'internet' }))).toBe(
      'internet (from site configuration)',
    );
  });
  it('describes sandbox', () => {
    expect(describeDeclared(resolvePlantumlAllowExternal({}))).toBe('sandbox (default)');
  });
});

describe('module contract', () => {
  it('has no imports (C-006)', () => {
    const src = readFileSync(MODULE_PATH, 'utf8');
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/\bimport\(/);
    expect(src).not.toMatch(/\brequire\(/);
  });
  it('exports only the contract surface', async () => {
    const mod = await import('../lib/plantuml-external.mjs');
    expect(Object.keys(mod).sort()).toEqual(
      [
        'PLANTUML_ALLOW_EXTERNAL_ENV',
        'PlantumlAllowExternalError',
        'describeDeclared',
        'parseAllowExternalEnv',
        'resolvePlantumlAllowExternal',
        'validateAllowExternal',
      ].sort(),
    );
    expect(mod.PLANTUML_ALLOW_EXTERNAL_ENV).toBe('DK_PLANTUML_ALLOW_EXTERNAL');
  });
});
