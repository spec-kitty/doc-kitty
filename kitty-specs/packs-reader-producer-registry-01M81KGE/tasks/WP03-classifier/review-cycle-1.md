---
affected_files: []
cycle_number: 1
mission_slug: packs-reader-producer-registry-01M81KGE
reproduction_command:
reviewed_at: '2026-11-22T13:35:40Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP03
---

# WP03 review feedback (cycle 1): claude::reviewer-renata

Verdict: **changes requested**. One blocking finding: a divergence from the
charter's reference classifier. The rest holds up.

## Blocking

### B1. The step-4 lower-case exception disagrees with the charter's classifier on one path class

`classify.mjs` returns `unmodelled` whenever any `files`, `retired` or `payloads`
glob, lower-cased, matches the lower-cased path:

```js
if ([...files, ...retired, ...payloads].some((rule) => rule.lower.test(lowerPath))) return { expect: 'unmodelled' };
```

The charter's `PackFileKind` (service/packs/.../infra/storage/PackFileKind.java
@ 69ec326, `ignored()` + `classifyFolded()`) classifies the folded path with the
full step-1/step-2 precedence: files, then exclusions, then retired, with the
retired-beats-files rule, then payloads. It skips `ignored` only when that folded
result is mapped or retired. When an **exclusion** wins the folded classification,
Java goes on to `ignored`. doc-kitty does not, because it never asks whether an
exclusion would have decided first.

The class this hits, with the vendored file-kinds.yaml: a case variant of a
README under mission templates.

| path | charter (Java) | doc-kitty |
|---|---|---|
| `core/missions/plan/Templates/README.md` | excluded, `**/*.md` | unmodelled |
| `core/Missions/a/templates/x/README.md` | excluded, `**/*.md` | unmodelled |

In lower case the exclusion `*/missions/*/templates/**/README.md` decides before
the payload `*/missions/*/templates/**/*`. So no `files`/`retired`/`payloads` rule
"would take" the path (the header's wording), and the `ignored` fallback excludes
it. doc-kitty would refuse such a file as unmodelled, while the charter service
leaves it alone.

How I found it: I ported the Java algorithm to JS. The port passes all 76 vendored
cases, which shows it is faithful. I then diffed it against `classify` over 18,495
paths generated from every rule glob, with case variants. There are 276 divergences,
all in this one class. Nothing else differs: the `**/` regex (`(?:.+/)?` in Java,
`(?:[^/]+/)*` here) only diverges on empty segments, and a walker never produces those.

Fix (small): run the folded classification with the same steps 1 and 2 as the
exact one, and return `unmodelled` only when that folded result is `mapped` or
`retired`. When it is `excluded` (or nothing), consult `ignored`. Payloads still
count for the exception, but only when no files/exclusions/retired rule decides
the folded path first. A tidy way: factor the step 1-2 logic into one function that
takes the regex to use (`regex` or `lower`) and the path, as Java's
`classify(path, glob)` does, and call it twice.

Add unit tests beside the conformance block (not in the vendored file):
- `core/missions/plan/Templates/README.md` → excluded under `**/*.md`
- `core/toolguides/a.guide.MD` → still unmodelled (the conformance case)

Consider asking the charter to add a conformance case for this class (#559), so
that every implementation is held to it.

## Non-blocking

1. Case-count floor: `>= 70` against 76 is fine as a truncation guard, because
   WP02's lock test already pins the file's bytes. A sharper check that survives a
   re-sync: assert `cases.length` equals the number of `- {path:` entries in the raw
   text, so a parse that drops entries fails while a contract refresh does not.
2. The red commit failed because the module did not exist, not against a stub
   returning `unmodelled` as T012 described. That is acceptable as red, but note it.

## Verified (no action)

- The test reads the vendored `contract/conformance/classifier-cases.yaml` directly
  with `yaml`, with no transcribed copy. That file is lock-verified by WP02.
- All 76 cases pass, matching expect, rule, kind, schema and content_form exactly.
  Every files/exclusions/retired/payloads/ignored rule decides at least one case.
- Precedence step 1 (f && r && !e → retired; f; e; r) and the step-3 root variant
  match Java. The two risk paths are right: `core/PACK.yaml` is retired under
  `*/pack.yaml`, and `core/docs/NOTES.MD` is excluded.
- `ignored` case-insensitivity: Java uses `CASE_INSENSITIVE`, which is ASCII-only.
  JS non-unicode `i` refuses non-ASCII to ASCII folding. With ASCII globs the two agree.
- Every payload rule declares `content_form`, as Java requires, so the `'bytes'`
  default never applies.
- Red first (5d05d36 fails because the module is missing). The test is unchanged
  from red to green. Fast vitest 194 files, 4132 tests, green. Lint and typecheck clean.
