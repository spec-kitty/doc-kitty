# Data model

- **LinkContext** (`links.mjs`) gains two fields:
  - `pageId: string`, the linking node's id. It is used for `.md` resolution.
  - `ids: Set<string>`, the ids of exported page and persona nodes.
- The meaning of `siteUrl` is unchanged: origin plus base. It is now composed in `exportOkfBundle`.
- **Agent page payload:** `source` changes from a site-relative path to an absolute URL. It equals `_links.self.href`.
