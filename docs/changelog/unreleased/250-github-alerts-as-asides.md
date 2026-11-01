---
section: Added
---

- **GitHub alert blockquotes render as Starlight asides (#250).** Before, a
  `> [!NOTE]` blockquote rendered as a plain quote that started with a literal
  `[!NOTE]`, and converting it to `:::note` broke the page on GitHub. Now, with
  the new `githubAlerts: true` option, a top-level blockquote that opens with
  `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` or `[!CAUTION]` renders as
  the matching native aside: note, tip, note titled "Important", caution titled
  "Warning" and danger titled "Caution". They share the theme and accessible
  name of `:::note` and the Markua callouts. A plain quote, an unknown
  `[!X]` marker and a deck page are unchanged. Off by default, so existing
  sites render as before. See
  [ADR-0068](docs/adr/0068-github-alerts-as-starlight-asides.md).
