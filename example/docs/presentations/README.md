---
title: Presentations
description: The overview hub for published slide decks — the in-frame entry point that links each deck's out-of-frame reveal.js view and its print or PDF export.
doc_status: active
updated: 2026-08-24
type: Presentation
kind: Hub
authors:
  - stijn@sddevelopment.be
---

Slide decks live outside the documentation frame: a `kind: Presentation` page
renders as a chrome-free reveal.js deck rather than a Starlight article. This
overview is the in-frame entry point — it stays in the sidebar, while the decks
themselves are suppressed from the sidebar so a reader is never ejected
out-of-frame without a signal.

The published decks are derived from the content collection at build time
(no hand-kept manifest): every published `kind: Presentation` page is listed
automatically below, each with its `?print-pdf` export link, and drafts are
omitted exactly as they are from the sitemap, RSS, and the agent index. Opening a
deck shows its slides; the `?print-pdf` export folds reveal's print rules into its
core stylesheet, so no separate export page is built.

:::note[Using these slide decks]
These are web-hosted reveal.js decks. Open a deck to present it in your browser,
navigate the slides with the keyboard, and export it to PDF from the browser's
print dialog. The "How to use" steps below cover all three.
:::

## How to use

### Navigate the slides

- **Right / Left** (or **Space**) move between the top-level slides.
- Some slides are **stacked vertically** — use **Down / Up** to move within a
  stack, and **Right / Left** to jump to the next top-level slide.
- Press **Esc** for the slide overview, then arrow to any slide and **Enter** to
  open it.

### Handy hotkeys

- **Esc** — slide overview (a zoomed-out grid of every slide).
- **S** — speaker-notes view: opens a separate window with your notes, a timer,
  and the upcoming slide.
- **F** — fullscreen.
- **Arrows / Space** — navigate, as above.

### Export a deck to PDF

1. From a deck — or via the **Print / PDF export** link listed for it on this hub
   — open the deck's `?print-pdf` view.
2. Open your browser's **Print** dialog (Ctrl/Cmd + P) and choose **Save as PDF**
   as the destination.
3. Enable **Background graphics** so the deck's colours and styling are included
   in the exported file; without it the slides print on a plain white background.
