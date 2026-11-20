---
section: Changed
---

- **CI prints the example's PDFs, and the deploy publishes them (#396, #397).**
  Before, nothing built or checked a PDF. Now an advisory `pdf` lane prints the
  example's PDFs from the drafts-off build, then checks them and proves two
  prints are identical. The deploy on `main` publishes them at `/pdf/`. The lane
  is not part of `ci-ok` yet. See [Activating and operating CI/CD](docs/ops/ci-cd.md).
