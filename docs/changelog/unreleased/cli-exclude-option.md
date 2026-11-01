---
section: Added
---

- **The link and frontmatter checks can leave a folder out.** Before, a folder
  of files that are not pages, such as changelog fragments in a repository's own
  `docs/`, could only be left out through a built site's `exclude` option. Now
  `dockitty-check-links` and `dockitty-validate-frontmatter` take
  `--exclude <folder>`, once per folder. The folder must exist inside one of the
  roots, or the command exits with status 2. See
  [ADR-0072](docs/adr/0072-parallel-landing-without-shared-files.md).
