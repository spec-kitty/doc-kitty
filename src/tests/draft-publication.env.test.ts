/**
 * #115 FR-010: the draft-publication setting reads env files from Vite's `envDir`
 * for the active `--mode`. One table over the pure resolvers; the build hook and
 * the gates are proven in `draft-publication.test.ts`.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { activeMode, resolveDraftPublication, resolveEnvSource } from '../lib/draft-publication.mjs';

const tmp = mkdtempSync(path.join(tmpdir(), 'dk-env-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A site root with the given files (paths relative to it). */
function site(name: string, files: Record<string, string>): string {
  const root = path.join(tmp, name);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  mkdirSync(root, { recursive: true });
  return root;
}

const OFF = 'DK_PUBLISH_DRAFTS=off\n';
const ON = 'DK_PUBLISH_DRAFTS=on\n';

type Row = {
  name: string;
  files: Record<string, string>;
  argv: string[];
  command?: string;
  envDir?: string | false;
  env?: Record<string, string>;
  expected: { mode: string; publish: boolean; source: string } | { throws: string };
};

const ROWS: Row[] = [
  { name: 'no flags: .env at the root, production (unchanged)', files: { '.env': OFF }, argv: [], expected: { mode: 'production', publish: false, source: 'env file' } },
  { name: 'dev command defaults to development', files: { '.env.development': OFF }, argv: [], command: 'dev', expected: { mode: 'development', publish: false, source: 'env file' } },
  { name: '--mode staging picks .env.staging', files: { '.env': OFF, '.env.staging': ON }, argv: ['--mode', 'staging'], expected: { mode: 'staging', publish: true, source: 'env file' } },
  { name: '--mode=staging picks .env.staging', files: { '.env': OFF, '.env.staging': ON }, argv: ['--mode=staging'], expected: { mode: 'staging', publish: true, source: 'env file' } },
  { name: '--mode local is rejected', files: {}, argv: ['--mode', 'local'], expected: { throws: '[dk-drafts]' } },
  { name: 'relative envDir resolves against the root', files: { 'env/.env.staging': ON, '.env.staging': OFF }, argv: ['--mode', 'staging'], envDir: 'env', expected: { mode: 'staging', publish: true, source: 'env file' } },
  { name: 'envDir false reads no env files', files: { '.env': OFF }, argv: [], envDir: false, expected: { mode: 'production', publish: true, source: 'default' } },
  { name: 'the process environment still wins over files', files: { 'env/.env': OFF }, argv: [], envDir: 'env', env: { DK_PUBLISH_DRAFTS: 'on' }, expected: { mode: 'production', publish: true, source: 'process environment' } },
];

describe('activeMode, resolveEnvSource and the env-file reader', () => {
  it.each(ROWS)('$name', ({ name, files, argv, command, envDir, env, expected }) => {
    const root = site(name.replace(/\W+/g, '-'), files);
    if ('throws' in expected) {
      expect(() => activeMode({ argv, command })).toThrow(expected.throws);
      return;
    }
    const mode = activeMode({ argv, command });
    expect(mode).toBe(expected.mode);
    expect(resolveEnvSource({ root, envDir })).toBe(
      envDir === false ? null : path.resolve(root, envDir ?? '.'),
    );
    expect(resolveDraftPublication(root, mode, env ?? {}, envDir)).toEqual({
      publish: expected.publish,
      source: expected.source,
    });
  });
});
