#!/usr/bin/env node
/**
 * `doc-kitty-mcp` launch CLI (contracts/mcp-surface.md):
 *
 *   doc-kitty-mcp --site <https://host/base>
 *   doc-kitty-mcp --dir  </abs/path/to/build/dist>
 *                [--link-base <uri>]
 *                [--resource-threshold <n>]
 *
 * Exit codes (contract): 0 = clean shutdown; 2 = launch/config failure
 * (unknown contract major, unreachable source, malformed corpus), printed as
 * the named error on stderr. STDOUT is RESERVED for the MCP stdio protocol -
 * every diagnostic line this file writes goes to stderr.
 *
 * The FIRST LINE of this file is the shebang above (T010): tsc preserves but
 * never creates one, and without it `npx <tarball>` dies on POSIX with
 * ENOEXEC/shell-fallback syntax errors while `node .bin/...` stays green.
 *
 * The `serve` handoff below is the WP03 seam (the server module): the real
 * binary entry (bottom of file) injects WP03's stdio `serveSnapshot`, while
 * in-process callers keep the injectable seam and its readiness-reporting
 * default, which keeps the corpus-IO acceptance tests deterministic.
 */
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDocKittyMcpError } from './errors.js';
import { HttpCorpusSource } from './corpus/http-source.js';
import { FsCorpusSource } from './corpus/fs-source.js';
import { loadSnapshot, siteSlugFor } from './corpus/snapshot.js';
import { serveSnapshot } from './server.js';
import type { CorpusSource, LoadEvent } from './corpus/source.js';
import type { CorpusSnapshot } from './corpus/snapshot.js';

export interface LaunchConfiguration {
  source: { kind: 'https'; url: string } | { kind: 'fs'; dir: string };
  /** FR-007 rewrite target (fs input only). */
  linkBase?: string;
  /** FR-011 size gate for resource listing; default 1000 (research R5). */
  resourceListingThreshold: number;
  /** Contract-pinned slug rule: lowercase, scheme/trailing slash dropped, non-alphanumerics collapsed to '-'. */
  siteSlug: string;
}

/** Lines the CLI emits (test seam; defaults bind process streams). */
export interface CliIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

/**
 * The WP03 server seam: receives the ready snapshot and launch config; its
 * promise resolving means clean shutdown (exit 0). The binary entry injects
 * WP03's `serveSnapshot` (stdio); the default below only announces
 * readiness, so in-process callers without an injected surface stay
 * deterministic (no stdio attach).
 */
export type ServerSurface = (snapshot: CorpusSnapshot, config: LaunchConfiguration) => Promise<void> | void;

const USAGE = `Usage: doc-kitty-mcp (--site <https://host/base> | --dir </abs/path/to/build/dist>)
                 [--link-base <uri>] [--resource-threshold <n>]

Reads one doc-kitty site's published machine artifacts into an immutable
snapshot at start, then serves them over MCP (stdio).

Options:
  --site <url>              Base URL of a deployed doc-kitty site (FR-001).
  --dir <path>              Local build output directory (FR-002); zero network access.
  --link-base <uri>         FR-007 rewrite target for baked links (fs input only;
                            default: the site's declared origin from the index).
  --resource-threshold <n>  List resources only at or below this page count (default 1000).
  --help                    Show this text.

Exit codes: 0 clean shutdown; 2 launch/config failure (named error on stderr).`;

/** Configuration mistakes -> usage on stderr + exit 2. */
class UsageError extends Error {}

/** --help -> usage on stdout + exit 0; never loads the corpus. */
class HelpRequested extends Error {}

export async function run(argv: readonly string[], io?: CliIo, serve?: ServerSurface): Promise<number> {
  const out = io ?? defaultIo();
  let resolved: { source: CorpusSource; config: LaunchConfiguration };
  try {
    resolved = resolveSource(parseArgs(argv));
  } catch (error) {
    if (error instanceof HelpRequested) {
      out.stdout(USAGE);
      return 0;
    }
    if (error instanceof UsageError) {
      out.stderr(`doc-kitty-mcp: ${error.message}`);
      out.stderr(USAGE);
      return 2;
    }
    throw error;
  }

  // Quiet-by-default load logger: only warnings and the (single) retry reach
  // stderr; budgets are measured by tests through an injected logger.
  const logger = (event: LoadEvent): void => {
    if (event.event === 'warning' || event.event === 'retry') {
      out.stderr(`doc-kitty-mcp: ${event.event}: ${event.message ?? event.ref ?? event.path}`);
    }
  };

  try {
    const snapshot = await loadSnapshot(resolved.source, { logger });
    await (serve ?? defaultSurface)(snapshot, resolved.config);
    return 0;
  } catch (error) {
    if (isDocKittyMcpError(error)) {
      out.stderr(`doc-kitty-mcp: ${error.code}: ${error.message}`);
      if (error.cause !== undefined) {
        out.stderr(`doc-kitty-mcp:   caused by: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`);
      }
      return 2;
    }
    out.stderr(`doc-kitty-mcp: launch failed: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
}

const defaultSurface: ServerSurface = (snapshot, config) => {
  defaultIo().stderr(
    `doc-kitty-mcp: snapshot ready: ${snapshot.pages.length} pages, ${snapshot.sections.length} sections, ` +
      `contract ${snapshot.contractVersion}, build ${snapshot.buildId ?? '(legacy, none)'}, ` +
      `site ${config.siteSlug}${snapshot.pagesGated ? ', pages links gated' : ''} - ` +
      `no server surface injected; the binary entry injects WP03's stdio server, so an embedding caller ` +
      `reaching this default is not serving MCP - exiting 0`,
  );
};

interface ConfigArgs {
  site?: string;
  dir?: string;
  linkBase?: string;
  resourceThreshold?: string;
}

function parseArgs(argv: readonly string[]): ConfigArgs {
  const args: ConfigArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const readValue = (): string => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError(`option ${arg} needs a value`);
      }
      i += 1;
      return value;
    };
    switch (arg) {
      case '--help':
      case '-h':
        throw new HelpRequested();
      case '--site':
        args.site = readValue();
        break;
      case '--dir':
        args.dir = readValue();
        break;
      case '--link-base':
        args.linkBase = readValue();
        break;
      case '--resource-threshold':
        args.resourceThreshold = readValue();
        break;
      default:
        throw new UsageError(`unknown option '${arg}'`);
    }
  }
  if (args.site !== undefined && args.dir !== undefined) {
    throw new UsageError('give exactly one of --site or --dir, not both');
  }
  if (args.site === undefined && args.dir === undefined) {
    throw new UsageError('one of --site or --dir is required');
  }
  if (args.linkBase !== undefined && args.dir === undefined) {
    throw new UsageError('--link-base applies to --dir input only (with --site the deployed origin is served as-is)');
  }
  return args;
}

function resolveSource(args: ConfigArgs): { source: CorpusSource; config: LaunchConfiguration } {
  const threshold = parseThreshold(args.resourceThreshold);
  if (args.dir !== undefined) {
    const dir = path.resolve(args.dir);
    let stat;
    try {
      stat = statSync(dir);
    } catch {
      throw new UsageError(`--dir '${args.dir}': directory does not exist`);
    }
    if (!stat.isDirectory()) {
      throw new UsageError(`--dir '${args.dir}': not a directory`);
    }
    const options = args.linkBase === undefined ? {} : { linkBase: args.linkBase };
    const source = new FsCorpusSource(dir, options);
    return {
      source,
      config: {
        source: { kind: 'fs', dir },
        ...(args.linkBase === undefined ? {} : { linkBase: args.linkBase }),
        resourceListingThreshold: threshold,
        siteSlug: siteSlugFor(dir),
      },
    };
  }
  let url: URL;
  try {
    url = new URL(args.site!);
  } catch {
    throw new UsageError(`--site '${args.site}': not a URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UsageError(`--site '${args.site}': http/https only`);
  }
  const source = new HttpCorpusSource(args.site!);
  return {
    source,
    config: {
      source: { kind: 'https', url: args.site! },
      resourceListingThreshold: threshold,
      siteSlug: siteSlugFor(args.site!),
    },
  };
}

function parseThreshold(raw: string | undefined): number {
  if (raw === undefined) return 1000;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new UsageError(`--resource-threshold '${raw}': expected an integer >= 1`);
  }
  return value;
}

function defaultIo(): CliIo {
  return {
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  };
}

function isDirectRun(): boolean {
  const invokedAs = process.argv[1];
  if (invokedAs === undefined) return false;
  try {
    // Compare REALPATHS on both sides (WP06 lane-crossing fix, strictly
    // required by T025; this file is WP02-owned). Node realpaths the ESM main
    // module behind import.meta.url by default but keeps the verbatim
    // invocation string in argv[1]: a launch through a package-manager `.bin`
    // shim (the normal consumer form - npm/npx/pnpm all symlink or wrap bins)
    // therefore carries a SYMLINK path in argv[1] and silently never ran the
    // cli. Resolving both sides makes the guard true for the shimmed path and
    // keeps it false for in-process imports (argv[1] is then vitest's own
    // worker entry, a different realpath either way).
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(invokedAs);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  void run(process.argv.slice(2), undefined, serveSnapshot).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`doc-kitty-mcp: launch failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    },
  );
}
