// Presentations hub instructional banner + how-to (WP06 T027 — finding E2).
//
// SC-004 / FR-006 / FR-007 ask that first-time readers get on-page guidance to
// operate and export the web-hosted decks: a purpose banner plus a "How to use"
// section covering vertical-slide navigation, the reveal hotkeys, and PDF export.
// That guidance is authored as hub BODY content in
// `example/docs/presentations/README.md` (plan IC-05), so it lands inside
// `<main data-pagefind-body>` and is indexed + accessible for free.
//
// This is the cheap DOM guard so the criterion is not purely manual (squad E2):
// it navigates to the presentations hub and asserts the banner and its three
// topics are present. It is a lightweight CONTENT assertion only — no axe scan
// (the presentations hub is not in `AXE_PAGES`, and this WP does not change that).
//
// Non-vacuity (F5): the assertions bind to DISTINCTIVE PHRASES the banner + how-to
// uniquely author — never bare tokens like "Esc" / "S" / "print" that hub chrome,
// the sidebar, or a deck title could satisfy vacuously. If the authored copy in
// the README changes, these strings must change with it to stay non-vacuous.
import { test, expect } from '@playwright/test';
// `BASE` is imported READ-ONLY — WP05 owns routes.ts. There is no presentations-hub
// constant to reuse yet, so the literal `/presentations/` route is composed here;
// importing BASE is not owning routes.ts.
import { BASE } from './routes';

const HUB = `${BASE}/presentations/`;

// The distinctive phrases the banner + how-to uniquely author (kept in sync with
// example/docs/presentations/README.md):
//   • the banner's purpose sentence — a substring only the banner carries;
//   • the vertical-navigation phrase;
//   • the speaker-notes phrase (the `S` hotkey topic, phrased not tokenised);
//   • the literal "Background graphics" — the PDF-export print setting.
const BANNER_PHRASE = 'web-hosted reveal.js decks';
const VERTICAL_NAV_PHRASE = 'stacked vertically';
const SPEAKER_NOTES_PHRASE = 'speaker-notes view';
const BACKGROUND_GRAPHICS_PHRASE = 'Background graphics';

// Colour-mode-independent: the guidance is static body copy, identical in light and
// dark, so a plain navigation (no mode seeding) is sufficient in both projects.
test.describe('Presentations hub — instructional banner + how-to (FR-006/FR-007)', () => {
  test('the hub renders the purpose banner and all three how-to topics', async ({
    page,
  }) => {
    await page.goto(HUB, { waitUntil: 'domcontentloaded' });

    // The guidance lives in the indexed, accessible hub body.
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // FR-006 — the purpose banner explaining what the hosted decks are.
    await expect(
      main,
      'the instructional banner states the decks are web-hosted reveal.js decks',
    ).toContainText(BANNER_PHRASE);

    // FR-007 — vertical-slide navigation.
    await expect(
      main,
      'the how-to explains vertical-slide navigation',
    ).toContainText(VERTICAL_NAV_PHRASE);

    // FR-007 — the reveal hotkeys, keyed on the speaker-notes (`S`) topic by phrase.
    await expect(
      main,
      'the how-to documents the speaker-notes hotkey view',
    ).toContainText(SPEAKER_NOTES_PHRASE);

    // FR-007 — PDF export via the print dialog, keyed on the "Background graphics"
    // setting (the load-bearing, easily-missed print option).
    await expect(
      main,
      'the how-to documents enabling Background graphics for PDF export',
    ).toContainText(BACKGROUND_GRAPHICS_PHRASE);
  });
});
