# Tracer: design-decisions

One entry per finding: `YYYY-MM-DD · actor · <text>`.

---

2026-11-20 · claude · Implementation findings folded into the design: Chromium writes /ID (nodeN) structure ids from a per-process DOM counter, so the post-pass renumbers them in place (order-preserving) for determinism; ARIA headings (role=heading aria-level) and content h1s are demoted with a floor below the page-title level; bookmark titles can lose a space at a line wrap, so the gate compares titles without whitespace; type: Template pages stay out of print documents; printBackground false keeps fills only on print-color-adjust: exact blocks.
