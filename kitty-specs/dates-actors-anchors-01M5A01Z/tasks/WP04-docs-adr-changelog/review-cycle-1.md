---
affected_files: []
cycle_number: 1
mission_slug: dates-actors-anchors-01M5A01Z
reproduction_command:
reviewed_at: '2026-10-19T12:44:06Z'
reviewer_agent: claude
wp_id: WP04
---

# WP04 review feedback (reviewer-renata), cycle 1

Verdict: changes requested. Gates are green: frontmatter, links, Vale (0 issues) and markdownlint. The one markdownlint hit, MD038 at CHANGELOG.md:269, was already there before this WP (merge-base line 242), and CI's markdownlint step does not cover CHANGELOG.md. The OKF, RSS and agent-API claims match `generator-stamp.mjs` and `okf-export/core.mjs`. The Decision section is untouched. Entry lengths are 889 and 643 characters. The defects below are claims the code does not support, plus required content that is missing.

## Blocking

1. **docs/architecture/metadata-model.md:340.** The page gives `18/10/2026` as an accepted example. The code rejects it. `normaliseInstant("18/10/2026")` returns `null`, because the shape check passes but `Date` cannot parse month 18. The gate reports "`stale_after`: not a date". Use an example that is accepted, such as `1/2/24` (from FR-007). The shape rule is also not enough by itself: `Date` must parse the value too. Say so in this page and in ADR-0059 line ~233 ("A value passes when ...").

2. **docs/architecture/metadata-model.md:342.** The page says "Each form except a UTC instant draws an advisory warning". That is false. A YAML date draws no warning, because `normaliseInstant` reports `dateOnly: false` for a `Date`. A date-only `stale_after`, `generated.at` or `verified[].at` also draws none: the gate warns on date-only values only for `updated` (`validate-frontmatter.mjs` ~330). I checked this with `stale_after: 2026-10-19`, both quoted and unquoted, and the gate gave no warning. State which forms warn.

3. **CHANGELOG.md:11-13.** The lead says "the build now rejects what the frontmatter gate already could not read". That is false. On the merge-base (58f7eca), the gate accepted `updated: 1`, `"1"`, `"2024"` and `20241001`, with only a `nonIso` warning. I ran the merge-base `validate-frontmatter.mjs` and all four passed. Both the build and the gate now reject these values. Fix the lead and the "Before, the Astro build accepted ..." sentence. Readers need to know that the gate is stricter too, because that is what breaks their CI.

4. **docs/architecture/generators.md.** T014 and FR-005 ("generators.md (stamps)") ask for this page to say that a scaffold stamp is provenance-only and never the export's last-change instant. The page never mentions the scaffold. The only edit is to the RSS bullet.

5. **ADR-0059 lines 220-222 (rationale).** T013 asks for the reason there are two rules. RSS `<pubDate>` is when the author last said the page changed. OKF `generated.at` is the producing tool's last content change (OKF §5, §5.2). "Ask different questions" names neither question, so a reader cannot see why one precedence would break a contract. State both meanings, cite §5 and §5.2, and say that the scaffold stamp is provenance, not a content change.

## Non-blocking

- The ADR `updated` was not bumped. This matches repo convention. None of the six earlier implementation-note commits to ADRs bumped it: 37a7e40, eb9ea73, 39fd94d, b22df06, 68bf61b and 37df83b. Not a defect.
- T015 asked for a link to the ADR-0059 note in the #226 entry. Neither entry has one.
- gherkin-pages.md:424 links to the export guide. T014 asked for a link to the ADR note.
