/**
 * The page-chrome options (page-chrome WP01; FR-009): what config evaluation
 * refuses, each paired with an accepted value of the same key, and the one reader's
 * round trip through the real `defineDocKittyIntegrations`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { chromeOptions, type ChromeOptions } from '../lib/chrome-options.js';
import { defineDocKittyIntegrations, type DocKittyOptions } from '../lib/config.js';
import { DK_CHROME_OPTIONS_ENV } from '../lib/internal-env.mjs';
import { restoreInternalEnv } from './helpers/restore-internal-env.js';

restoreInternalEnv();
beforeEach(() => {
  delete process.env[DK_CHROME_OPTIONS_ENV];
});

const define = (options: Record<string, unknown>) =>
  defineDocKittyIntegrations({ title: 'Docs', ...options } as DocKittyOptions);

const DEFAULTS: ChromeOptions = {
  sidebar: { collapsed: true, titleIsIndex: false },
  metadataBlocks: { collapsed: true },
  footer: { machineEntryPoints: { label: 'Machine-readable' } },
  pageFormats: { atom: true },
};
const REPOSITORY = { provider: 'gitlab', repo: 'owner/name', branch: 'main' };

const CASES: Array<{ key: string; accepted: Record<string, unknown>; read: Partial<ChromeOptions>; rejected: Record<string, unknown>; message: string }> = [
  {
    key: 'sidebar.collapsed',
    accepted: { sidebar: { collapsed: false } },
    read: { sidebar: { collapsed: false, titleIsIndex: false } },
    rejected: { sidebar: { collapsed: 'no' } },
    message: '[dk-config] sidebar.collapsed must be a boolean',
  },
  {
    key: 'sidebar.titleIsIndex',
    accepted: { sidebar: { titleIsIndex: true } },
    read: { sidebar: { collapsed: true, titleIsIndex: true } },
    rejected: { sidebar: { titleIsIndex: 1 } },
    message: '[dk-config] sidebar.titleIsIndex must be a boolean',
  },
  {
    key: 'an unknown sidebar key',
    accepted: { sidebar: { collapsed: true } },
    read: {},
    rejected: { sidebar: { collapse: true } },
    message: '[dk-config] unknown key "collapse" under sidebar; expected indexLabel, collapsed or titleIsIndex',
  },
  {
    key: 'metadataBlocks.collapsed',
    accepted: { metadataBlocks: { collapsed: false } },
    read: { metadataBlocks: { collapsed: false } },
    rejected: { metadataBlocks: { collapsed: 0 } },
    message: '[dk-config] metadataBlocks.collapsed must be a boolean',
  },
  {
    key: 'an unknown metadataBlocks key',
    accepted: { metadataBlocks: {} },
    read: {},
    rejected: { metadataBlocks: { open: true } },
    message: '[dk-config] unknown key "open" under metadataBlocks; expected collapsed',
  },
  {
    key: 'footer.machineEntryPoints false',
    accepted: { footer: { machineEntryPoints: false } },
    read: { footer: { machineEntryPoints: false } },
    rejected: { footer: { machineEntryPoints: true } },
    message: '[dk-config] footer.machineEntryPoints must be false or an object with label',
  },
  {
    key: 'footer.machineEntryPoints.label',
    accepted: { footer: { machineEntryPoints: { label: 'For machines' } } },
    read: { footer: { machineEntryPoints: { label: 'For machines' } } },
    rejected: { footer: { machineEntryPoints: { label: '  ' } } },
    message: '[dk-config] footer.machineEntryPoints.label must be a non-empty string',
  },
  {
    key: 'a machineEntryPoints object with no label',
    accepted: { footer: {} },
    read: {},
    rejected: { footer: { machineEntryPoints: {} } },
    message: '[dk-config] footer.machineEntryPoints.label must be a non-empty string',
  },
  {
    key: 'pageFormats.atom',
    accepted: { pageFormats: { atom: false } },
    read: { pageFormats: { atom: false } },
    rejected: { pageFormats: { atom: 'off' } },
    message: '[dk-config] pageFormats.atom must be a boolean',
  },
  {
    key: 'repository.provider',
    accepted: { repository: REPOSITORY },
    read: { repository: REPOSITORY } as Partial<ChromeOptions>,
    rejected: { repository: { ...REPOSITORY, provider: 'gitea' } },
    message: '[dk-config] repository.provider must be one of github, gitlab, bitbucket',
  },
  {
    key: 'repository.repo, when empty',
    accepted: { repository: { ...REPOSITORY, provider: 'bitbucket' } },
    read: { repository: { ...REPOSITORY, provider: 'bitbucket' } } as Partial<ChromeOptions>,
    rejected: { repository: { ...REPOSITORY, repo: '' } },
    message: '[dk-config] repository.repo must be a non-empty string',
  },
  {
    key: 'repository.repo, when missing',
    accepted: { repository: { ...REPOSITORY, provider: 'github' } },
    read: { repository: { ...REPOSITORY, provider: 'github' } } as Partial<ChromeOptions>,
    rejected: { repository: { provider: 'github', branch: 'main' } },
    message: '[dk-config] repository.repo must be a non-empty string',
  },
  {
    key: 'repository.branch, when missing',
    accepted: { repository: { ...REPOSITORY, branch: 'trunk' } },
    read: { repository: { ...REPOSITORY, branch: 'trunk' } } as Partial<ChromeOptions>,
    rejected: { repository: { provider: 'github', repo: 'owner/name' } },
    message: '[dk-config] repository.branch must be a non-empty string',
  },
  {
    key: 'repository.siteDir',
    accepted: { repository: { ...REPOSITORY, siteDir: 'example' } },
    read: { repository: { ...REPOSITORY, siteDir: 'example' } } as Partial<ChromeOptions>,
    rejected: { repository: { ...REPOSITORY, siteDir: '' } },
    message: '[dk-config] repository.siteDir must be a non-empty string',
  },
];

describe('option validation', () => {
  it.each(CASES)('$key: the accepted value is read back, the rejected one throws by name', ({ accepted, read, rejected, message }) => {
    define(accepted);
    expect(chromeOptions()).toEqual({ ...DEFAULTS, ...read });
    expect(() => define(rejected)).toThrow(new Error(message));
  });

  it.each([
    ['metadataBlocks', '[dk-config] metadataBlocks must be an object with collapsed'],
    ['footer', '[dk-config] footer must be an object with machineEntryPoints'],
    ['pageFormats', '[dk-config] pageFormats must be an object with atom'],
    ['repository', '[dk-config] repository must be an object with provider, repo, branch, siteDir'],
  ])('%s must be an object', (key, message) => {
    expect(() => define({ [key]: true })).toThrow(new Error(message));
    expect(() => define({ [key]: null })).toThrow(new Error(message));
  });
});

describe('titleIsIndex with indexLabel (FR-009)', () => {
  it('refuses the two together, naming both keys', () => {
    expect(() => define({ sidebar: { titleIsIndex: true, indexLabel: 'Start here' } })).toThrow(
      /^\[dk-config\] sidebar\.titleIsIndex and sidebar\.indexLabel cannot be set together/,
    );
  });

  it('accepts each alone, and an index label with the option explicitly off', () => {
    expect(() => define({ sidebar: { titleIsIndex: true } })).not.toThrow();
    expect(() => define({ sidebar: { indexLabel: 'Start here' } })).not.toThrow();
    expect(() => define({ sidebar: { titleIsIndex: false, indexLabel: 'Start here' } })).not.toThrow();
  });
});

describe('chromeOptions()', () => {
  it('returns the defaults with the handoff unset', () => {
    expect(process.env[DK_CHROME_OPTIONS_ENV]).toBeUndefined();
    expect(chromeOptions()).toEqual(DEFAULTS);
  });

  it('returns the defaults for a config that sets nothing, and for a Starlight sidebar array', () => {
    define({});
    expect(process.env[DK_CHROME_OPTIONS_ENV]).toBeDefined();
    expect(chromeOptions()).toEqual(DEFAULTS);
    define({ sidebar: [] });
    expect(chromeOptions()).toEqual(DEFAULTS);
  });

  it('round-trips every option from defineDocKittyIntegrations', () => {
    define({
      sidebar: { collapsed: false, titleIsIndex: true },
      metadataBlocks: { collapsed: false },
      footer: { machineEntryPoints: false },
      pageFormats: { atom: false },
      repository: { ...REPOSITORY, siteDir: 'example' },
    });
    expect(chromeOptions()).toEqual({
      sidebar: { collapsed: false, titleIsIndex: true },
      metadataBlocks: { collapsed: false },
      footer: { machineEntryPoints: false },
      pageFormats: { atom: false },
      repository: { ...REPOSITORY, siteDir: 'example' },
    });
  });

  it('a second config call in one process does not inherit the first one\'s values', () => {
    define({ sidebar: { collapsed: false }, repository: REPOSITORY });
    expect(chromeOptions().sidebar.collapsed).toBe(false);
    expect(chromeOptions().repository).toEqual(REPOSITORY);
    define({});
    expect(chromeOptions()).toEqual(DEFAULTS);
    expect(chromeOptions()).not.toHaveProperty('repository');
  });

  it('follows the handoff when it is removed, so a cached value cannot outlive it', () => {
    define({ pageFormats: { atom: false } });
    expect(chromeOptions().pageFormats.atom).toBe(false);
    delete process.env[DK_CHROME_OPTIONS_ENV];
    expect(chromeOptions().pageFormats.atom).toBe(true);
  });
});
