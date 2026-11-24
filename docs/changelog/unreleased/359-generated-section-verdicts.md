---
section: Documentation
---

- **ADR-0087's drift gate names two more cases (#359).** An `unowned` verdict
  reports an expected output page whose ownership stamp was deleted or mistyped,
  which used to read as an authored page. A producer may also report a verdict
  of its own, such as the missions pages' leak check, with exit 1 and the same
  output line.
