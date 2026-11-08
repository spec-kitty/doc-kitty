---
section: Added
---

- **`openapi.llmsOperations` lists operations in `llms.txt` (#258).** Before,
  `llms.txt` carried only one line per version. Now, when you opt in with
  `llmsOperations: true`, each version's raw document line is followed by one
  indented line per operation, `  - METHOD /path: summary`. The option is off
  by default, so an opting-out site's `llms.txt` is unchanged. Released
  operation pages are also individual search results now, findable by summary,
  method and path.
