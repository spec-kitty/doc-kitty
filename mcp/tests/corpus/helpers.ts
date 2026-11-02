/** Test helpers: fixture locations, IO capture, load-event collection. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CliIo } from '../../src/cli.js';
import type { LoadEvent } from '../../src/corpus/source.js';

export const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function fixture(name: string): string {
  return path.join(FIXTURES, name);
}

export interface CapturedIo extends CliIo {
  out: string[];
  err: string[];
}

export function captureIo(): CapturedIo {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  };
}

export interface Collected {
  events: LoadEvent[];
  logger: (event: LoadEvent) => void;
}

export function collectEvents(): Collected {
  const events: LoadEvent[] = [];
  return { events, logger: (event) => events.push(event) };
}

export function ofKind(events: LoadEvent[], kind: LoadEvent['event']): LoadEvent[] {
  return events.filter((e) => e.event === kind);
}
