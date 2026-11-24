---
section: Added
---

- **Operating-model templates and a Role kind (#402).** Before, the stub tools
  wrote pages with frontmatter and a TODO body only, and an accountable function
  had no page kind. Now `new-doc --template <id>` writes one of twelve
  operating-model templates, and `scaffold --preset operating-model` writes the
  set with an `operating-model/` section index. Each template holds headings and
  authoring prompts only, and presets its `tom_classification` measures at
  organisation scope. Neither tool overwrites an existing file. A new `Role`
  kind records an accountable function and requires `role` and
  `responsibilities`. The `operating-model` section is opt-in, through a
  documented `sections.yaml` entry. Two runs without a template also change:
  `new-doc` refuses a `--title` with a control character (exit 2), and
  `scaffold` no longer takes a flag's value, such as `--index-basename index`,
  as its base folder. See
  [ADR-0085](docs/adr/0085-role-kind.md) and
  [Documenting your operating model](docs/guides/operating-model.md).
