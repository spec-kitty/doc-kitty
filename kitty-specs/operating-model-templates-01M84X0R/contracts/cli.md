# CLI contract: stub-tool templates and the operating-model preset

## `dockitty-new-doc` (`src/scripts/new-doc.mjs`)

```
new-doc --template <id> [slug] [--title "T"] [--type T] [--base docs]
```

| Case | Result | Exit |
|---|---|---|
| Known id, target missing | Writes `<base>/<slug or record path>.md` from the template, then prints `✓ created … (type: …, kind: …)` | 0 |
| Known id, target exists | Writes nothing and prints `✖ refusing to overwrite existing file: …`. The file is byte-identical | 1 |
| Unknown id | Writes nothing, prints the error and the known ids | 2 |
| `--template` with `--kind` or `--section` | Writes nothing, prints the conflict | 2 |
| No `--template` | Behaviour unchanged (FR-014) | as today |

## `dockitty-scaffold` (`src/scripts/scaffold.mjs`)

```
scaffold [base] --preset operating-model [--index-basename N] [--astro-config P]
```

| Case | Result | Exit |
|---|---|---|
| Empty tree | Writes the section index plus the 12 template pages (13 files), then prints `✓ scaffolded 13 file(s) under <base>/` | 0 |
| Some files exist | Skips them, leaving them byte-identical, writes the rest and prints `(skipped N existing file(s))` | 0 |
| Unknown preset | Writes nothing, prints the known presets | 2 |
| `--preset` with `--sections` | Writes nothing, prints the conflict | 2 |
| No `--preset` | Behaviour unchanged (C-005) | as today |

## Library surface (`src/lib/operating-model-templates.mjs`)

- `OPERATING_MODEL_TEMPLATES`: the frozen records.
- `templateById(id)`: returns the record, or `undefined`.
- `renderTemplatePage(record, { title, type, now })`: returns the page text. It is pure apart from reading the body file.
