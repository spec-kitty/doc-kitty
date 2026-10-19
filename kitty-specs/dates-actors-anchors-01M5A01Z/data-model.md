# Data model: Dates, actors and anchors

No new runtime data. Three rules over existing frontmatter fields.

## Date-shaped value (#227)

Applies to `updated`, `stale_after`, `generated.at` and `verified[].at`.

| Input | Verdict |
| --- | --- |
| YAML date (a `Date`) | accepted (unchanged) |
| ISO-8601 string (date-only, zone-less, `Z`, `±HH:MM`, `±HHMM`, `±HH`, no seconds, rolled-over) | accepted with its existing advisory (unchanged) |
| Non-ISO string with a month name and a number (`"May 1, 2024"`) | accepted, `nonIso` advisory (unchanged) |
| Non-ISO string with three or more numeric groups (`"1/2/24"`) | accepted, `nonIso` advisory (unchanged) |
| Year-month `YYYY-MM` (`"2024-10"`) | accepted, `nonIso` advisory (unchanged) |
| Any other string (`"1"`, `"2024"`, `"1/2"`, `"abc 2024"`, `"2024.5"`) | **rejected** |
| A number (`1`, `20241001`) | **rejected** |

**Invariant**: `normaliseInstant` decides it and returns `null` for a rejected value.
Both validator twins and every reader rely on that.

## "Last changed" precedence (#226)

| Output | Rule | Stamp counted |
| --- | --- | --- |
| RSS `<pubDate>` and feed order | `updated`, else `generated.at` | any stamp (unchanged) |
| OKF export `generated` | ownership stamp's `by`/`at`/`content_hash`, else `{by: first author or export process, at: updated or stamp at}` | ownership producers only (Gherkin, glossary) |
| Agent API | `updated` only, plus the raw `generated` block | n/a (unchanged) |

**Invariant**: the exported `generated.by` and `generated.at` describe the same event.

## Anchor alias (#228)

A dropped body `# Title` leaves an alias `span` with id `title` unless a later heading
slugs to `title`. In that case there is no alias, and exactly one element carries the
id, on the later heading.
