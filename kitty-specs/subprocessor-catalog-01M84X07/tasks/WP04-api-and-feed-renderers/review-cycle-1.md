---
affected_files: []
cycle_number: 1
mission_slug: subprocessor-catalog-01M84X07
reproduction_command:
reviewed_at: '2026-11-25T08:59:24Z'
reviewer_agent: claude
wp_id: WP04
---

# WP04 review feedback, cycle 1

**Reviewer:** claude::reviewer-renata
**Reviewed:** lane-c at `34e131d2` (range `edb1da28..34e131d2`)
**Verdict:** changes requested. One small test gap is blocking. Everything else passes.

The renderers are correct and match the contracts. The record keys keep their order and absent
optional keys are omitted. `absolute` and `xmlEscape` are reused, not copied. Items keep change
order. Each guid is unique and stable (id, kind and date), and `pubDate` is RFC 822 at midnight UTC.
There is no `lastBuildDate`. The `itemLink` override works, and an already-based path is not
prefixed twice. `xmllint` accepts the feed on hostile input (`]]>`, `&`, quotes, C0 controls,
U+FFFE) and on an empty catalog. The positive control in the byte-stability test is real.

## Gates (re-run by reviewer)

- **Full `pnpm test`.** The src suite passed 4831/4831 tests in 244 files, and mcp passed 181/181. WP04 itself has 15/15.
- **Static checks.** `pnpm lint` and `pnpm typecheck` are clean.

## Mutation probe

I applied 20 mutants to `src/lib/subprocessors-render.ts`, ran the WP04 tests, and restored the file.
19 mutants were killed and 1 survived (M06, below). Killed mutants include: injecting
`lastBuildDate`, a JSON trailing newline, dropping kind or date from the guid, `isPermaLink="true"`,
swapping from/until, an unescaped title or description, ignoring `itemLink`, the location separator,
`count`, reversed items, a `null` optional key, top-level key order, a hard-coded self URL, the home
link, a swapped category, and an inverted record lookup.

## Findings

### F1 (blocking): byte stability is not tested across time zones

- **The mutant.** It changes `new Date(\`${date}T00:00:00Z\`)` to `...T00:00:00` (local time).
- **Why it survives.** The suite runs with process TZ = UTC, which is the case in this container and on
  GitHub runners.
- **When it is caught.** Under `TZ=Europe/Amsterdam` or `TZ=America/New_York` it fails, because
  `pubDate` shifts to 23:00 the previous day or to 05:00. NFR-001 is exactly the property this WP
  exists to pin.
- **It is practical.** T017 asked for "two TZ values if practical". Node honours a runtime change to
  `process.env.TZ`, so it is.

**Fix.** Add to the byte-stability block. I checked that this kills M06 and passes on the clean code:

```ts
it('renders the same bytes in another time zone', () => {
  const utc = both();
  vi.stubEnv('TZ', 'Pacific/Kiritimati'); // UTC+14: a local-time parse moves every pubDate a day
  expect(both()).toEqual(utc);
});
```

`afterEach` already calls `vi.unstubAllEnvs()`.

### F2 (non-blocking, spec touch-up): channel element order differs from the contract example

- **The difference.** `contracts/subprocessors-feed.contract.md` puts `<description>` before
  `<atom:link …/>`, with no space before `/>`. The implementation emits `<atom:link … />` first and
  then `<description>`. This mirrors `src/lib/routes/rss.ts`, and the test pins it.
- **Why it matters.** It is harmless in RSS, but the WP says to follow the contract bytes "exactly",
  and this deviation was not declared.
- **Recommendation.** Keep the code, which matches the precedent, and add this to the contract touch-up
  alongside the trailing newline.

### F3 (non-blocking, concur): trailing-newline deviation is the right call

- **The routes.** Four of five `api/*.json` routes serialise with `JSON.stringify(x, null, 2)` and no
  newline: `agent-index.ts`, `bibliography.ts`, `scenario-index.ts` and `agent-page.ts`. Only
  `content-graph.ts` appends `\n`.
- **Conclusion.** Matching the majority is right, and so is the T015 instruction ("If they use … + '\n',
  do the same"). The contract wording should change, not the code.

### F4 (non-blocking, spec touch-up, outside WP04): ChangeEntry key order disagrees within the spec

- **The disagreement.** The `data-model.md` ChangeEntry table lists `id, kind, date, name`. The API
  contract example and WP02's `subprocessors-core.mjs:308` use `date, kind, id, name`.
- **Why WP04 is unaffected.** WP04 passes the objects through, so the output follows WP02, which
  matches the contract example.
- **Recommendation.** Align the data-model table with the code in the touch-up.

### F5 (nit, no action): pulled-in `astro:content` import

The renderer imports `routes/shared.ts`, which statically imports `astro:content`, so the test needs
`vi.mock`. This follows from the mandated reuse of `absolute` and `xmlEscape`, so it is acceptable as is.

## Scope

- **Files.** The diff touches only the two owned files plus spec-kitty status bookkeeping.
- **Clock and environment.** The renderer does not read the clock. Its only environment access is
  `BASE_URL`, through `withBase` (by design).
