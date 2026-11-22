---
affected_files: []
cycle_number: 1
mission_slug: packs-reader-producer-registry-01M81KGE
reproduction_command:
reviewed_at: '2026-11-22T13:53:04Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP04
---

# WP04 review feedback (cycle 1): claude::reviewer-renata

Verdict: **changes requested**. Two blocking findings, both small and both in
code that reads content from another repository. The rest is solid: it reads the
real corpus clean, and the hash recipe matches the charter exactly.

## Blocking

### B1. Manifest verification reads through a symlinked directory, and can verify content outside the pack

`walkPack` reports a symlink and does not follow it. Manifest verification checks
only the **last** path component (`lstatSync(abs).isSymbolicLink()`), so a
manifest path under a symlinked directory is read through the link.

Reproduced:
- Take `beta`, move `directives/b.directive.yaml` to a directory outside the pack,
  replace `directives/` with a symlink to it, and add a manifest listing
  `directives/b.directive.yaml` with that file's hash.
- `readPack` gives `manifest.verified === true` and `inventory.source === 'manifest'`
  (`directive: [b]`), with only a `symlink` problem on `directives`.
- The page would state as fact that the pack holds a verified directive whose bytes
  live outside it.

WP02 refuses symlinks in a snapshot outright. Here the reader should not let one
count towards verification.

Fix: before hashing a manifest entry, refuse it when any component of its path
below the pack root is a symlink. Either walk the components with `lstatSync`, or
compare `realpathSync(abs)` with `path.join(realpathSync(root), rel)`. Treat such
an entry as not held: `manifest-missing-file`, or a dedicated code, and
`verified = false`. Add a robustness test with a symlinked directory that holds a
manifest-listed file.

### B2. Foreign YAML instantiates objects through explicit tags

`yaml` resolves its "known tags" by default, in every schema, including
`failsafe`. A README frontmatter, `pack.yaml`, `policy.yaml`, a preset, an artefact
file or a charter lock can therefore create:
- `!!binary` → `Buffer`
- `!!set` → `Set`
- `!!timestamp` → `Date`
- `!!omap` → `Map`

Verified on `parsePackDocument('---\nx: !!binary aGk=\n---\n')`: the frontmatter
holds a Buffer, and JSON then renders it as `{"type":"Buffer","data":[...]}`. A Set
renders as `{}`. Nothing executes (`!!js/function` stays a string, `---js` is never
frontmatter, `__proto__` stays an own key, and alias bombs are refused), but the
model should hold plain data only. That is the point of avoiding gray-matter.

Fix: pass `{ resolveKnownTags: false, logLevel: 'error' }` to every `parseYaml`
(in `readme.mjs` and in `readYaml`, keeping `schema: 'failsafe'` for the
manifest). I checked that this keeps those four as plain strings, arrays and
objects. `logLevel: 'error'` also stops `yaml` from printing a `YAMLWarning` to
stderr for every unknown tag in a foreign file. Add a README test with `!!binary`
and `!!set` in the frontmatter that asserts plain values.

Same change: anchor the frontmatter's closing `---` to the start of a line. Today
`\n?---` lets a line *ending* in `---` close the block:
`---\ntitle: a ---\nb: 2\n---\n# Real\n` gives frontmatter `{title: 'a'}`, a section
"b: 2" and a spurious `readme-ambiguous-heading`. Use
`/^---[ \t]*\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)/` and treat an undefined group as
empty. I checked it: the mid-line case closes at the real delimiter, and
`---\n---`, `---\na: 1\n---` and `---\na: 1\n---\n` still parse. The split stays
linear: 1 MB of unclosed or dash-heavy input takes about 2 ms in the regex.

## Non-blocking

1. Unquoted numbers in `pack.yaml`: `schema_version: 1.0` reads as `1`, giving a
   warning that says "schema_version 1". `pack_version: 1.10` silently becomes
   `version: "1.1"`. The charter's schema types both as strings, so such a pack is
   already off-contract. Still, reading the descriptor with
   `schema: 'failsafe'`, as the manifest is read, would show what the author wrote
   and keep the warning truthful.
2. The charter lock is read with the default schema. A commit of digits and one
   `e` would read as a number and give `charter-lock-unreadable`. That is
   vanishingly rare; failsafe fixes it for free.
3. The open-packs corpus smoke test is not part of this WP's commits. It is T022's
   (`packs-open-packs.corpus.ts`, `packs-corpus` project), so do not claim it here.
   I ran the corpus myself (below).
4. Deviation from T014: frontmatter is split by regex and parsed with `yaml`
   instead of gray-matter. That is the right call for foreign content; record it in
   the WP06 docs or ADR notes.

## Verified (no action)

- Hash recipe: `packContentHash` equals the charter's `PackManifests.lf` + SHA-256
  (every CR to LF, an LF after a CR dropped). There were 0 mismatches over 20,000
  random byte strings rich in CR and LF. It also matches the
  `pack-manifest.schema.json` description.
- Unquoted all-digit hashes read as strings (failsafe), and delta's test pins this.
- Open-packs corpus at 0be738a (cloned and run locally): 19 packs, 0 throws,
  19/19 manifests verified, about 400 ms in total. Problems:
  1 `manifest-unknown-kind` (`routing_catalog`, expected) and 1 `unmodelled`.
- The CRLF fixture is stored CRLF with `attr/-text`.
- Red first: 5298b84 fails because the modules are missing. Tests and fixtures are
  unchanged from red to green.
- WP tests 25/25. Fast vitest 196 files, 4159 tests, green. Lint and typecheck clean.
