---
section: Added
---

- **A version switcher on every OpenAPI page, and an archive input (#259).**
  Before, the pages did not link to their siblings. Now every page carries a
  dropdown of all versions, marking the current one and unreleased ones, as
  plain links that work without scripts; from an operation page it targets the
  same operation in the other version when it exists there. A new
  `openapi.archive` option (`glob` + `labelPattern`) turns matched files, such
  as tagged releases, into versions with labels derived from the file names.
