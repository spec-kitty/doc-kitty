# Decision Moment `01M854WKCFKXRYKQAK0XYRCVZK`

- **Mission:** `large-hubs-paged-hub-listing-01M84WYV`
- **Origin flow:** `specify`
- **Slot key:** `specify.listing.page-size`
- **Input key:** `page_size`
- **Status:** `resolved`
- **Created:** `2026-11-23T21:27:13.551498+00:00`
- **Resolved:** `2026-11-23T22:27:39.474455+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

How many children per listing page, and which hubs are paged?

## Options

- Page size = the hub resolved sidebar child cap; only hubs over their cap are paged
- Separate page-size setting (hub/section/site), default 50; only hubs over their cap are paged
- Separate page-size setting; every hub over its page size is paged, regardless of the cap
- Other

## Final answer

B: separate page-size setting at hub/section/site, default 50, resolved most specific first like the cap; only hubs over their sidebar child cap are paged. Operator decision relayed by the dispatcher (session_01E5wJU9WQgVdyyBRFbVHcGL, verbatim '342 -> B'); to be reconfirmed first-hand in the Intent Summary playback.

## Rationale

_(none)_

## Change log

- `2026-11-23T21:27:13.551498+00:00` - opened
- `2026-11-23T22:27:39.474455+00:00` - resolved (final_answer="B: separate page-size setting at hub/section/site, default 50, resolved most specific first like the cap; only hubs over their sidebar child cap are paged. Operator decision relayed by the dispatcher (session_01E5wJU9WQgVdyyBRFbVHcGL, verbatim '342 -> B'); to be reconfirmed first-hand in the Intent Summary playback.")
