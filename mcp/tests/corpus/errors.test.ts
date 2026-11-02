/**
 * The seven-name error taxonomy (T007, NFR-005, NFR-004): stable `code`
 * fields, Error subclassing, cause passthrough. No other error names may
 * appear in later WPs - these classes are the whole vocabulary.
 */
import { describe, expect, it } from 'vitest';
import {
  BuildIdentityMismatchError,
  DocKittyMcpError,
  MalformedCorpusError,
  PageNotFoundError,
  PagesLinksGatedError,
  UnknownContractMajorError,
  UnreachableEndpointError,
  UnsupportedClientRevisionError,
  isDocKittyMcpError,
} from '../../src/errors.js';
import type { ErrorCode } from '../../src/errors.js';

const CASES: Array<[new (message: string, options?: { cause?: unknown }) => DocKittyMcpError, ErrorCode]> = [
  [UnknownContractMajorError, 'UNKNOWN_CONTRACT_MAJOR'],
  [UnreachableEndpointError, 'UNREACHABLE_ENDPOINT'],
  [MalformedCorpusError, 'MALFORMED_CORPUS'],
  [PagesLinksGatedError, 'PAGES_LINKS_GATED'],
  [BuildIdentityMismatchError, 'BUILD_IDENTITY_MISMATCH'],
  [PageNotFoundError, 'PAGE_NOT_FOUND'],
  [UnsupportedClientRevisionError, 'UNSUPPORTED_CLIENT_REVISION'],
];

describe('error taxonomy', () => {
  it('is exactly the seven specced names', () => {
    expect(CASES.map(([, code]) => code)).toEqual([
      'UNKNOWN_CONTRACT_MAJOR',
      'UNREACHABLE_ENDPOINT',
      'MALFORMED_CORPUS',
      'PAGES_LINKS_GATED',
      'BUILD_IDENTITY_MISMATCH',
      'PAGE_NOT_FOUND',
      'UNSUPPORTED_CLIENT_REVISION',
    ]);
  });

  it.each(CASES.map(([Klass, code]) => [Klass.name, Klass, code] as const))(
    '%s carries its stable code and is an Error',
    (_name, Klass, code) => {
      const error = new Klass('boom');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DocKittyMcpError);
      expect(error.code).toBe(code);
      expect(error.message).toBe('boom');
      expect(isDocKittyMcpError(error)).toBe(true);
    },
  );

  it('carries the cause for diagnostics', () => {
    const cause = new Error('ECONNREFUSED');
    const error = new UnreachableEndpointError('fetch failed after the one documented retry', { cause });
    expect(error.cause).toBe(cause);
  });

  it('isDocKittyMcpError rejects foreign errors', () => {
    expect(isDocKittyMcpError(new Error('x'))).toBe(false);
    expect(isDocKittyMcpError('nope')).toBe(false);
  });
});

describe('normalizeHandshakeError (NFR-004 wiring)', () => {
  it('maps an old-protocol-version handshake rejection to UNSUPPORTED_CLIENT_REVISION', async () => {
    const { normalizeHandshakeError } = await import('../../src/server.js');
    const sdkError = new Error("Client requested unsupported protocol version '2024-11-05'");
    const normalized = normalizeHandshakeError(sdkError);
    expect(normalized).toBeInstanceOf(DocKittyMcpError);
    expect((normalized as DocKittyMcpError).code).toBe('UNSUPPORTED_CLIENT_REVISION');
    expect((normalized as DocKittyMcpError).cause).toBe(sdkError);
  });

  it('passes unrelated connect() failures through unchanged', async () => {
    const { normalizeHandshakeError } = await import('../../src/server.js');
    const unrelated = new Error('EIO stdin closed');
    expect(normalizeHandshakeError(unrelated)).toBe(unrelated);
  });
});
