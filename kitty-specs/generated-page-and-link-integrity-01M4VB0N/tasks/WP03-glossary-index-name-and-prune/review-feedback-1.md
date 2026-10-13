# WP03 review feedback (cycle 1) — changes requested

Reviewer: reviewer-renata (claude). Commit reviewed: `fdbb903`.

The core of the package is sound: target-name rule, stop-before-write, prune-after-write,
key-set recognition, config pass-through, byte neutrality (regenerating the example's
glossary with `['README','index']` diffs empty against the committed `example/docs/glossary/**`),
and all six revert mutations go red. One hole lets the generator delete and write
OUTSIDE its positions, so the package cannot be approved yet.

## MAJOR-1 — an index name with a path separator moves the write and the prune out of `glossary/` (authored pages deleted)

Where: `src/lib/glossary/generate.ts:265-275` (target paths built from the unvalidated name),
`:340` (`indexFilesIn(join(t.path, '..'), names)`), and `src/lib/config.ts:1679`
(`if (gherkinOpts) validateIndexBasenames(...)` — the check runs only when Gherkin is on).

Reproduction (glossary-only site, one context `Shipping`, `indexBasename: '../x'`):

- `docs/index.md` authored with `title, description, kind: Hub, doc_status` (an ordinary
  root hub page) is DELETED. It is not at `glossary/<name>.md` (condition 1 broken).
- `docs/glossary/index.md` with `kind: Glossary` + the five context keys is DELETED. It
  sits at the hub position with the context kind (conditions 1 and 3 broken), because the
  context target `glossary/shipping/../x.md` makes the prune scan `glossary/`.
- The hub is written to `docs/x.md`, outside `glossary/`.

WP02 added `validateIndexBasenames` for exactly this reason ("an entry with a path
separator or a leading `.` could name a file outside it"); the glossary generator has the
same exposure and no guard.

Required change (both parts):

1. Reject such names before anything is written or removed when the glossary is active.
   Either run the same validation for the glossary path in `config.ts` (not only
   `if (gherkinOpts)`), or validate inside `generateGlossaryPages` before building
   `targets` (preferable: the generator is then safe for every caller). Mind the error
   prefix: `validateIndexBasenames` says `[dk-gherkin]`; the message an adopter sees for a
   glossary-only site should not name Gherkin.
2. Make the prune independent of the name: scan the known directories
   (`glossaryDir` for the hub, `join(glossaryDir, slug)` for each context) instead of
   `join(t.path, '..')`, so condition 1 holds by construction.

Add one test through `generateGlossaryPages`: with an index name containing `/` (or `..`),
the call throws and a seeded tree (including a four-key `kind: Hub` page at the docs root)
is unchanged. It must go red without the fix.

## MINOR-2 — a symlink at a target path is written through

Where: `generate.ts:280-290` (`existsSync` follows links).
A symlink at `glossary/README.md` whose target (anywhere on disk) has the generator's keys
is overwritten in place; a dangling symlink there passes the stop (existsSync is false) and
the write creates the file at the link's destination outside the docs tree. Content loss
stays inside the accepted bound, and the old code also wrote through links, so this is not
blocking. Suggested: `lstatSync` the target and treat a symbolic link as "not a generated
page" (stop). Optional in this cycle; say so in the hand-off if you leave it.

## MINOR-3 — the keep-warning does not say what to do

Where: `generate.ts:345-348`.
"keeping X: it looks like a generated Hub page but carries different frontmatter fields, so
it is treated as authored" is true but leaves the adopter with two index files in one
folder and no instruction. Add the action, e.g. "Delete it if it is a leftover from an
earlier build, or rename it; two index files in one folder collide."

## MINOR-4 — test economy

Where: `src/tests/glossary-generate.test.ts`, "does not stop on its own earlier output".
`glossary-codegen-guard.test.ts` "re-running over the SAME dir rewrites identical bytes"
already runs the generator twice over one directory and goes red for the same revert
(condition 2 applied in the stop). Drop the new test, or keep it and state in the hand-off
what it catches that the guard test does not.
Also consider adding `['home']` → `home.md` as a row of the existing `it.each` (the only
row that proves "the site's FIRST index name" rather than the default); no new test.

## Notes (no change required)

- `generate.ts:207` comment typo "Conditions 3".
- Pages left under a name that is no longer a site index name (`README.md` after switching
  to `'index'`; `home.md` after dropping `home`) are not pruned. That follows FR-008 as
  written; mention it in the hand-off so the ADR can record it.
- `['Readme']` after a default-name build leaves `README.md` beside `Readme.md` on a
  case-sensitive file system (the chosen name is excluded case-insensitively). Follows T014.
- The fourth `warn` parameter is fine: it is how the Astro logger is reached.
