# Contract — nightly smoke flow

**Triggers**: `schedule` (nightly cron) + `workflow_dispatch`. Base repo only.

## Gate
1. Read newest **successful** `github-pages` deployment SHA (Deployments API).
2. Read `smoke/last-run` git ref (missing ⇒ treat as changed).
3. If live SHA == marker → exit early, run nothing.
4. Else run the suite, then set the marker ← live SHA (`contents: write`, must not
   retrigger workflows).

## Suite (against the live URL)
| Check | Tool | Threshold |
|---|---|---|
| Broken links | lychee | 0 dead links (internal + external) |
| SEO + a11y subset + rendering integrity | Lighthouse CI | per-category min score in `lighthouserc.json`; console errors / failed requests fail best-practices |

Perf / Core-Web-Vitals is **not** an M0 gate.

## Reporting
- Always: Step Summary + uploaded artifacts (Lighthouse HTML, link report).
- On any threshold failure: open/update a tracking GitHub issue.
- Never blocks a merge.

## Acceptance (maps to spec)
- FR-016, FR-017, FR-018, FR-019, FR-021, C-007, C-009, NFR-005;
  US4.1 (no-op on unchanged), US4.2 (run+update), US4.3 (clean → no issue),
  US4.4 (fail → issue), US4.5 (first run), US4.6 (manual applies gate).
