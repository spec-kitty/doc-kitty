---
section: Added
---

- **Each published page links its JSON, OKF and Atom versions, in the footer and the `<head>`.** A draft, a page outside the docs collection, or a page with `agent: { discoverable: false }` has none: that opt-out also hides the links (its `source` link stays, as that is for reading the file). Only the links go: the page's JSON, Atom and OKF files are still built and served. Set `repository: { provider, repo, branch, siteDir }` to add a `source` link to the page's file on GitHub, GitLab or Bitbucket; a generated page has none, and self-hosted instances are not supported. The links are pills under the spec-kitty theme and plain links without it.
