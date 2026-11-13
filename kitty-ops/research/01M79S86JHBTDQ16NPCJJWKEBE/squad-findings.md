# Adversarial squad: #328 kitty packs design

Op `01M79S86JHBTDQ16NPCJJWKEBE`, post-plan point-cut, PR #337. Lenses:
architect-alphonso (boundaries), researcher-robbie (facts against the source
repositories), reviewer-renata (whether the slices can be filed). Each delegate
loaded its profile through `spec-kitty agent profile show`.

Verdicts before folding: architect "sound direction, not ready to accept";
researcher "largely accurate, no blockers"; reviewer "not ready to file as-is".
The orchestrator checked every BLOCKER and MAJOR finding against the sources
before folding it.

## Dispositions

| # | Lens | Severity | Finding | Disposition | Where |
|---|---|---|---|---|---|
| 1 | reviewer | BLOCKER | Slice 3 acceptance criteria omit most of `gen_pack_reference.py`'s guarantees | accepted | plan, slice 3 |
| 2 | reviewer | BLOCKER | Migration misses open-packs tests, the Python-only CI job, path filters and authored-page checks | accepted | plan, migration step 3 |
| 3 | reviewer | MAJOR | The URL-parity criterion can be faked | accepted: golden URL set over a mirrored fixture | plan, slice 3 |
| 4 | reviewer | MAJOR | AGENTS.md requirements (tests, docs, fragment, bin, example) missing | accepted | plan, definition of done |
| 5 | reviewer | MAJOR | Slice 2 has no consumer; slice 3 overloaded | changed: slice 2 gains the producer registry and a `dockitty-read-pack` CLI as its consumer; slice 3 keeps generation only | plan, slices 2 and 3 |
| 6 | reviewer | MAJOR | Discovery criteria lack an assertion style | accepted: asserted on built output | plan, slice 3 and definition of done |
| 7 | reviewer | MAJOR | Slice 1 is a merge gate; issue numbering half done; links between slices 3 and 4 | changed: slice 1 is delivered by PR #337 and done on acceptance; slice 3 sends in-pack links to `sourceUrlPrefix`; new issues are filed after approval | plan, slices 1 and 3 |
| 8 | reviewer | MINOR | Vague criteria in slices 5 to 9; no private-pack criterion | accepted | plan, slices 5 to 9 |
| 9 | reviewer | MINOR | No charter-site row; no non-goal for sidecars and the checksum | accepted | plan, non-goals and cross-repo table |
| 10 | reviewer | MINOR | Pin-to-commit criterion | accepted | plan, slice 2 (lock test) |
| 11 | architect | MAJOR | Slug from `pack.yaml` name moves `qa` and `internal` | accepted: the directory is the slug | ADR D4, D6, alternatives |
| 12 | architect | MAJOR | Migration breaks 19 links in `docs/packs/index.md`; old pages collide on route | accepted | plan, migration step 3 |
| 13 | architect | MAJOR | "No extra code" is false: gates are hard-wired to Gherkin; `updated` missing | accepted: producer registry; ADR-0046 decision 4 formally amended; `updated` synthesised | ADR status, D6; plan, slice 2 |
| 14 | architect | MAJOR | Vendoring the YAML does not vendor the Java classifier | accepted: vendor conformance cases; unknown key or form is a warning | ADR D1, negatives, alternatives |
| 15 | architect | MAJOR | Two contract pins can disagree | accepted: `packs.charterLock`, both commits on the page | ADR D2, versioning |
| 16 | architect | MAJOR | Unverified `manifest_hash`; the ADR decided open-packs' checksum policy | accepted: recompute `content_hash`, label unverified; `extraFacts`; open-packs decides its ADRs | ADR D3, D6; plan, non-goals and migration step 4 |
| 17 | architect | MAJOR | Path-escape rule refuses `../packs` | accepted: containment in the repository root | ADR D5 |
| 18 | architect | MINOR | No empty-source guard | accepted: `allowEmpty` | ADR D5; plan, slice 3 |
| 19 | architect | MINOR | Index basename hard-coded | accepted | ADR D6 |
| 20 | architect | MINOR | Fallbacks for description, policy location, inventory source | accepted | ADR D4, D6 |
| 21 | architect | MINOR | ADR-0073 decision 9 is the built-in 404 | accepted | research; ADR alternatives |
| 22 | researcher | MAJOR | "Nothing emits a whole pack tree" overstated (`charter pack assemble`) | accepted | research, core |
| 23 | researcher | MAJOR | Core README use and the built-in fetch from a pinned commit | accepted | research, core |
| 24 | researcher | MINOR | "#248" unverifiable | changed: verified through charter commit e0f4ee1; added issues #241 and #242 and charter #451 | research intro |
| 25 | researcher | MINOR | 404 `pack_not_found` wording | accepted | research |
| 26 | researcher | MINOR | Codec refusal list incomplete | accepted | research |
| 27 | researcher | MINOR | Kinds omit `step-enhancement` and `charter.yaml` | accepted | research table |
| 28 | researcher | MINOR | Case variants are root-level only | accepted | research table |
| 29 | researcher | MINOR | Inventory counts are recursive | accepted | research, open-packs |
| 30 | researcher | MINOR | Core ADR 2026-10-31-1 is Proposed; core pins by commit | accepted | research, core; ADR versioning |

No finding was dropped or deferred.
