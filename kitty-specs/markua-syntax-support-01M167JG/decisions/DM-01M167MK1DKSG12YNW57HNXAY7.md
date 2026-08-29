# Decision Moment `01M167MK1DKSG12YNW57HNXAY7`

- **Mission:** `markua-syntax-support-01M167JG`
- **Origin flow:** `specify`
- **Slot key:** `specify.icons.support-depth`
- **Input key:** `icon_support_depth`
- **Status:** `resolved`
- **Created:** `2026-08-29T07:44:38.445361+00:00`
- **Resolved:** `2026-08-29T08:05:48.665318+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Icons ({icon: fa-name} on callouts): full curated Font Awesome to Starlight name map now, a minimal seed map plus graceful drop for unmapped names, or defer icons entirely to a follow-up?

## Options

- Minimal seed map + graceful drop
- Full curated map now
- Defer icons to follow-up
- Other

## Final answer

Ship a minimal curated Font Awesome to Starlight seed map (common names only); unmapped fa- names drop the icon (callout still renders) and emit a build-time warning. The map is designed to grow later.

## Rationale

_(none)_

## Change log

- `2026-08-29T07:44:38.445361+00:00` — opened
- `2026-08-29T08:05:48.665318+00:00` — resolved (final_answer="Ship a minimal curated Font Awesome to Starlight seed map (common names only); unmapped fa- names drop the icon (callout still renders) and emit a build-time warning. The map is designed to grow later.")
