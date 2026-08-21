---
title: Authoring a document
description: Create a page that satisfies the Common Docs — Kitty Variation.
status: active
updated: 2026-08-21
type: Guide
tags: [authoring, workflow]
related:
  - context/convention
---

# Authoring a document

1. **Pick the section.** Choose the Common Docs section the page belongs to
   (`context`, `architecture`, `guides`, …). A directory's landing page is its
   `README.md`.

2. **Scaffold it** with compliant frontmatter:

   ```sh
   node src/scripts/new-doc.mjs guides/deployment --title "Deployment"
   ```

   `type` is inferred from the path; override with `--type`. Use `--section` for
   a section `README.md`.

3. **Fill in metadata.** Required: `title`, `description`, `status`, `updated`,
   `type`. Add optional fields (`tags`, `related`, `authors`, `agent`, …) only
   when there's a real value. See [the convention](../context/convention.md).

4. **Validate:**

   ```sh
   node src/scripts/validate-frontmatter.mjs docs
   ```

   CI runs the same gate.

5. **Preview** with `pnpm --filter example dev` and confirm the page renders
   where you expect (a `README.md` maps to its directory route).
