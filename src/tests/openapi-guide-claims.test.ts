/**
 * The OpenAPI reference guide (#260) must not drift from what the publisher
 * actually writes: the raw document's bytes are the input's own for a
 * single-file source, the bundle's for a multi-file source, and the
 * original's for Swagger 2.0 (the guide's own §4a). The early claims — the
 * intro, the input list and the addresses table — must carry that
 * qualification too, not an unqualified "byte for byte" (pre-PR review
 * fold F7): a reader who stops at the intro would otherwise expect the
 * root file's bytes back from a multi-file definition.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GUIDE = fileURLToPath(new URL('../../docs/guides/openapi-reference.md', import.meta.url));
const guide = readFileSync(GUIDE, 'utf8');

describe('openapi guide byte-identity claims (#260)', () => {
  it('qualifies the published bytes by source kind in the intro', () => {
    expect(guide).toContain('a single-file input\nbyte for byte, a multi-file input as the bundle the build makes of it');
  });

  it('names the input shape as a root file plus the files its relative $refs reach', () => {
    expect(guide).toContain('a local root file plus the files its relative `$ref`s\nreach');
    expect(guide).not.toContain('a local folder of files');
  });

  it('qualifies the raw document row of the addresses table by source kind', () => {
    expect(guide).toContain('byte-identical to a single-file input, the bundle of a multi-file input');
    expect(guide).not.toContain('byte-identical to the input.');
  });
});
