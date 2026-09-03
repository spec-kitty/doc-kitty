# Contract — redirect-coverage gate (`check-redirect-coverage.mjs`)

A bare-Node CLI gate. No Astro build context; deterministic.

## Invocation

```
node src/scripts/check-redirect-coverage.mjs <baseline-file> <dist-dir> [--redirects <map>]
```

- `<baseline-file>`: committed list of pre-change URLs that must keep resolving (E-04).
- `<dist-dir>`: the built static output.
- `--redirects`: the redirect map source (defaults to the Astro-emitted map / `_redirects` in `<dist-dir>`).

## Behaviour

- For each baselined URL, compute a verdict per E-07:
  - live page at the URL ⇒ `covered`.
  - redirect exists ⇒ follow the target chain; `covered` iff it terminates at a live page; else `uncovered` (dead/looping target).
  - otherwise ⇒ `uncovered`.
- **Exit 0** iff every URL is `covered`. **Exit non-zero** otherwise, printing each `uncovered` URL and, for a dead redirect, the failing target.
- No network; resolution is against `<dist-dir>` only. Idempotent across runs (NFR-002).

## Guarantees

- Adds no Astro build step; completes within a few seconds of the `doc-sanity` budget.
- A redirect to a 404 is reported as `uncovered` (the B1 defect is closed by construction).

## Verification

- `redirect-coverage.test.ts`: pass case, uncovered-URL fail case, dead-target fail case, chain-resolution case.
- Wired into CI alongside the existing sanity gates.
