---
affected_files: []
cycle_number: 2
mission_slug: dates-actors-anchors-01M5A01Z
reproduction_command:
reviewed_at: '2026-10-19T12:47:50Z'
reviewer_agent: claude
wp_id: WP04
---

# WP04 review feedback (reviewer-renata), cycle 2

Cycle 1's five blocking defects and the ADR-link nit are fixed, and I checked each against the code. `1/2/24` and `10/18/2026` are accepted and `18/10/2026` is rejected. The gate change is stated correctly. The changelog entries are 1085 and 769 characters. The gates pass: frontmatter, links, Vale (0 issues) and markdownlint (only the old MD038). No file modes changed.

One new inaccuracy remains. It is my fault: my cycle-1 note said "A YAML date draws no warning". That holds for `stale_after` and stamp `at` only.

## Blocking

1. **docs/architecture/metadata-model.md:351-354.** The page says "A YAML date draws no warning". For `updated` that is false. `restoreDateOnlyScalars` (`validate-frontmatter.mjs` ~373) puts a bare `updated: 2026-10-19` back to its string form, so it does draw the date-only warning. I checked: both the unquoted and the quoted value warn. Line 35 of the same page says so too. Here is what is true:
   - A YAML timestamp with a time draws no warning.
   - A date-only value warns on `updated`, whether quoted or a bare YAML date.
   - A date-only value draws no warning on `stale_after`, `generated.at` or `verified[].at`.

   Also drop "because it is the one field that asks for a full instant". The page's own first line says every instant field is a UTC `YYYY-MM-DDTHH:MM:SSZ`, and the code gives no such reason. State the behaviour without a reason.

Nothing else needs to change.
