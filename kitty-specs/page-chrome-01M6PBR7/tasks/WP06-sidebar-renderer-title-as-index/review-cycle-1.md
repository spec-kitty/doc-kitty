---
affected_files: []
cycle_number: 1
mission_slug: page-chrome-01M6PBR7
reproduction_command:
reviewed_at: '2026-11-06T11:20:37Z'
reviewer_agent: claude:claude-opus-5-5:reviewer-renata
wp_id: WP06
---

# WP06 review feedback (reviewer-renata), commit a7848ee

Production behaviour held on everything I drove. The rejection is for a test gap that
contradicts the WP's reviewer guidance and the commit's own evidence line, plus two wrong
comments. The fix is small.

**Issue 1 (blocking): the parity test does not reach the badge branches or the top-level link branch.**
The WP says the parity test must go red "if a class or attribute in the copy changes", and the
commit message claims that. The chrome fixture has no sidebar badge and no top-level link, so two
mutants survive `sidebar-renderer-parity.test.ts` and `sidebar-title-as-index-build.test.ts`, both
exit 0, 15 passed:
- In the plain link path of `src/components/sidebar/SidebarSublist.astro:84-88`, `variant="danger" text="MUTANT"` replacing the three badge props.
- At `SidebarSublist.astro:79`, `{ large: !nested }` changed to `{ 'large-mutant': !nested }`.
A Starlight upgrade that changes either branch would also pass unnoticed.

Fix, in `sidebar-renderer-parity.test.ts`: add to `FILES`, for both builds, a top-level page
(`docs/top-level.md`, with `sidebar: { badge: New }`) and a `starlight.routeMiddleware` that sets
`badge` on every link and group, as the `dkIcon` test does. Add the top-level page to `PAGES`, and
add `sl-badge` to the non-vacuity list, plus a check that a top-level link has `class="large`. I
built exactly this variant by hand and stock and copy are byte-equal on the deep page, the non-hub
page and the top-level page, with 18 badges each, so this should go green without a production
change. Rerun both mutants and record that they go red.

**Issue 2 (blocking, small): the title-as-index label's badge is untested.**
`SidebarSublist.astro:55-61` renders `entry.badge ?? indexed.index.badge`, and nothing asserts it.
Add a build assertion in `sidebar-title-as-index-build.test.ts` for both sources: the group's badge
inside `a.dk-group__label`, and the index page's badge when the group has none.

**Issue 3 (fix with the above): the comment at `SidebarSublist.astro:13-16` is false.**
It says `Icon` and `Badge` "come by their own paths, not the `./components` barrel". Line 18 imports
them from that barrel, as T020 asked. I compared the emitted CSS rule by rule: the barrel adds no
user-component CSS or script on the fixture, so the code is fine. Correct the comment to say so.

**Issue 4 (fix or justify): the comment at `SidebarSublist.astro:166-168` says the added rule is needed.**
With `[aria-expanded='true'] .caret` removed, all 23 `sidebar-title-as-index` specs pass, because
unlayered `.dk-disclosure__toggle[aria-expanded='true'] > svg` in `disclosure.css` already rotates
the caret and beats anything in `starlight.core`. T022 asked for the rule, so either keep it and say
it is redundant with `disclosure.css`, or drop it and make the copy's `<style>` identical to the
original, updating ADR-0075's "plus one rule".

**Non-blocking, take if convenient.**
- A consumer-written sidebar with `titleIsIndex` has no test. Through `starlight.sidebar` I found it
  byte-equal to stock, with no error. A build assertion would hold that. A `sidebar` array cannot
  carry the option at all.
- `TitleAsIndexEnhancement.astro:44`: `block-size: 2rem` is the row height at 50rem and up, but the
  label is 36px below that, so the caret sits 2px high on a phone. Cosmetic.
- `noIndexVariant()` claims "no index page below the root" but leaves the generated glossary index,
  which the test removes by hand. It is explained there, so moving it into the harness is optional.

**Not to change.** The carrier and manifest split, parity's body window and normalisation, persister
and restore indices, phone behaviour, RTL, Axe, target size, prev/next and ADR-0075 all held. Keep
the goldens and ADR-0063 untouched.
