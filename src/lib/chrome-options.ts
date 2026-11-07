/**
 * The page-chrome options: their shape, their validation and their one reader.
 *
 * `defineDocKittyIntegrations` validates them and publishes what the site set
 * through `DK_CHROME_OPTIONS`. `chromeOptions()` reads that and applies the
 * defaults, so `.astro` carriers and routes can use it. This module must not
 * import `config.ts`, which pulls in Starlight and every integration.
 */
import { DK_CHROME_OPTIONS_ENV } from './internal-env.mjs';

const REPOSITORY_PROVIDERS = ['github', 'gitlab', 'bitbucket'] as const;

/** Where a site's sources are hosted. Hosted services only. */
export interface RepositorySettings {
  provider: (typeof REPOSITORY_PROVIDERS)[number];
  /** `owner/name`. */
  repo: string;
  branch: string;
  /** The repo-relative folder of the site. */
  siteDir?: string;
}

/** The `sidebar` keys this reader carries; `indexLabel` has its own transport. */
export interface ChromeSidebarInput {
  collapsed?: boolean;
  titleIsIndex?: boolean;
}

/** What a site may set. Everything is optional. */
export interface ChromeOptionsInput {
  sidebar?: ChromeSidebarInput;
  metadataBlocks?: { collapsed?: boolean };
  footer?: { machineEntryPoints?: false | { label: string } };
  pageFormats?: { atom?: boolean };
  repository?: RepositorySettings;
}

/** The options with their defaults applied. */
export interface ChromeOptions {
  sidebar: { collapsed: boolean; titleIsIndex: boolean };
  metadataBlocks: { collapsed: boolean };
  footer: { machineEntryPoints: false | { label: string } };
  pageFormats: { atom: boolean };
  repository?: RepositorySettings;
}

const DEFAULT_MACHINE_ENTRY_POINTS_LABEL = 'Machine-readable';

function withDefaults(input: ChromeOptionsInput): ChromeOptions {
  return {
    sidebar: {
      collapsed: input.sidebar?.collapsed ?? true,
      titleIsIndex: input.sidebar?.titleIsIndex ?? false,
    },
    metadataBlocks: { collapsed: input.metadataBlocks?.collapsed ?? true },
    footer: { machineEntryPoints: input.footer?.machineEntryPoints ?? { label: DEFAULT_MACHINE_ENTRY_POINTS_LABEL } },
    pageFormats: { atom: input.pageFormats?.atom ?? true },
    ...(input.repository ? { repository: input.repository } : {}),
  };
}

let cached: { raw: string | undefined; options: ChromeOptions } | undefined;

/**
 * The options in force. With the handoff unset, as under Vitest, these are the
 * defaults. Carriers call it on every page, so a value is parsed once.
 */
export function chromeOptions(): ChromeOptions {
  const raw = process.env[DK_CHROME_OPTIONS_ENV];
  if (cached?.raw !== raw || cached === undefined) {
    cached = { raw, options: withDefaults(raw === undefined ? {} : (JSON.parse(raw) as ChromeOptionsInput)) };
  }
  return cached.options;
}

function assertObject(value: unknown, key: string, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`[dk-config] ${key} must be an object with ${keys.join(', ')}`);
  }
  const extra = Object.keys(value).find((name) => !keys.includes(name));
  if (extra !== undefined) throw new Error(`[dk-config] unknown key "${extra}" under ${key}; expected ${keys.join(', ')}`);
}

function assertBoolean(value: unknown, key: string): void {
  if (value !== undefined && typeof value !== 'boolean') throw new Error(`[dk-config] ${key} must be a boolean`);
}

function assertNonEmpty(value: unknown, key: string): void {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`[dk-config] ${key} must be a non-empty string`);
}

/**
 * Throw a `[dk-config]` error naming the key of the first invalid option, and
 * return the input. The `sidebar` keys are checked where that option is split.
 */
export function validateChromeOptions(input: ChromeOptionsInput): ChromeOptionsInput {
  const { metadataBlocks, footer, pageFormats, repository } = input;
  if (metadataBlocks !== undefined) {
    assertObject(metadataBlocks, 'metadataBlocks', ['collapsed']);
    assertBoolean(metadataBlocks.collapsed, 'metadataBlocks.collapsed');
  }
  if (footer !== undefined) {
    assertObject(footer, 'footer', ['machineEntryPoints']);
    const entryPoints: unknown = footer.machineEntryPoints;
    if (entryPoints !== undefined && entryPoints !== false) {
      if (typeof entryPoints !== 'object' || entryPoints === null || Array.isArray(entryPoints)) {
        throw new Error('[dk-config] footer.machineEntryPoints must be false or an object with label');
      }
      assertObject(entryPoints, 'footer.machineEntryPoints', ['label']);
      assertNonEmpty(entryPoints.label, 'footer.machineEntryPoints.label');
    }
  }
  if (pageFormats !== undefined) {
    assertObject(pageFormats, 'pageFormats', ['atom']);
    assertBoolean(pageFormats.atom, 'pageFormats.atom');
  }
  if (repository !== undefined) {
    assertObject(repository, 'repository', ['provider', 'repo', 'branch', 'siteDir']);
    if (!(REPOSITORY_PROVIDERS as readonly unknown[]).includes(repository.provider)) {
      throw new Error(`[dk-config] repository.provider must be one of ${REPOSITORY_PROVIDERS.join(', ')}`);
    }
    assertNonEmpty(repository.repo, 'repository.repo');
    assertNonEmpty(repository.branch, 'repository.branch');
    if (repository.siteDir !== undefined) assertNonEmpty(repository.siteDir, 'repository.siteDir');
  }
  return input;
}
