---
affected_files: []
cycle_number: 5
mission_slug: tom-annex-export-01M84YDP
reproduction_command: spec-kitty agent tasks move-task WP05 --to approved --mission tom-annex-export-01M84YDP --agent claude::reviewer-renata
reviewed_at: '2026-11-24T16:36:58Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP05
---

Approved by claude::reviewer-renata: approval:WP05

# WP05 review cycle 5: APPROVE

Reviewer: claude::reviewer-renata. Lane head reviewed: 1fb8f356. The code is in 12d69b0b. 1fb8f356 is the review flow's coord→lane auto-rebase merge. `git diff 12d69b0b 1fb8f356 -- . ':!kitty-specs'` is empty.

Both cycle-4 blockers are fixed. N1 and N2 are implemented. The remaining findings below are latent with the shipped schema and do not block.

## Verified fixed

1. **Blocker 1 (prototype-named keys).**
   - `required` and `properties` now use `Object.hasOwn`, and so does `$defs` lookup in `resolve()`.
   - A gate-level test builds the input from `JSON.parse` text. It covers `constructor` and `__proto__`, at the top level and at `/scopes/system/0/evidence/0`.
   - The direct suite covers all five keys named in cycle 4, plus `required` on an inherited key.
2. **Blocker 2 (keyword coverage).** The new `src/tests/tom-annex-schema-check.test.ts` gives a valid and an invalid case per keyword, plus throw cases. Each of the 11 cycle-4 survivors is now killed (see the sweep below).
3. **N1 (whole-schema walk).** `assertImplemented` runs before use. Each of these throws:
   - an unknown keyword off the instance path, under `properties` or `$defs`;
   - a keyword beside `$ref`;
   - an unresolvable `$ref`;
   - a cyclic `$ref`.

   A chained `$ref` resolves. Three small test gaps remain (finding 1 below).
4. **N2 (`pattern` and `minLength`).** `pattern` is compiled with the `u` flag, and `minLength` counts code points. Ajv agrees on every unicode probe (see the differential).
5. **Design decision: keep the in-repo validator rather than add Ajv. The reasoning holds.**
   - `src/package.json` (`@spec-kitty/doc-toolkit`, publishable) has `files` that include `lib` and `scripts`.
   - The chain is `scripts/assert-build-artifacts.mjs` → `lib/tom-annex/verify.mjs` → `lib/tom-annex/schema-check.mjs`.
   - So Ajv would have to be a runtime `dependency` of the toolkit. A devDependency would break the shipped script for adopters.
   - One nuance: the gate is not a `bin` entry, so adopters reach it by path. That does not change the conclusion.

## Differential against Ajv 8.17.1

Ajv was installed in a scratch directory only, using `ajv/dist/2020`. There were 184 comparisons in all.

**Against the shipped schema: 145 documents, 0 disagreements.**
- The 39 cycle-4 documents, including the 6 earlier disagreements, which now agree.
- 81 prototype-key documents: 9 keys at 9 levels. The keys are `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `__proto__`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString` and `__defineGetter__`. The levels are:
  - top, `catalog`, `scopes` and a scope entry;
  - an evidence ref, a framework and `uncovered`;
  - `generated`;
  - a `verified` item, which is an open object, so both validators accept it.
- 25 more documents:
  - unicode in `id`, `notice`, `format_version` and `generated.*`;
  - integer vs number in real fields;
  - nested `$ref` paths (organisation → `measureEntry` → `nature`/`evidenceRef`);
  - null entries;
  - a non-object root.

**Inline schemas: 39 cases, 16 disagreements. Each one is listed below.**

- **Ajv is wrong and schema-check is right (3).**
  - `required: ["constructor"]` on `{}`: Ajv accepts the inherited key.
  - `$ref: "#/$defs/__proto__"` and `$ref: "#/$defs/constructor"` with no such def: Ajv validates against the prototype member. schema-check throws "unresolvable".
- **schema-check deliberately fails loud by throwing (6).** These are refusals, not silent drift:
  - `$ref` with a `~1` escape;
  - `$ref` with a percent-encoded name;
  - `items: true`;
  - a boolean subschema under `properties`;
  - `maxLength`;
  - `$comment`.
- **Silent divergence (4), latent.** The shipped schema uses none of these forms. See finding 2.
  - `additionalProperties: {type: "string"}` (schema form) is ignored. schema-check says valid; Ajv says invalid.
  - `items: false` is ignored. schema-check says valid; Ajv says invalid.
  - `const: {a: 1}` and `enum: [[1]]` are compared by identity, so a matching value is rejected. schema-check says invalid; Ajv says valid.
- **Malformed schema values are not refused (3), latent.** Ajv fails to compile each of these; schema-check does not throw:
  - `type: "strng"`;
  - `minLength: "2"`;
  - `required: "ab"`, which iterates characters.

Agreement on the probes the brief asked for:
- unicode `pattern` cases: `^.$` and `^..$` on an astral character, `\p{L}`, a `[😀]` class, `\u{1F600}`, `\w`/`\d` on non-ASCII, and `\-`, which is invalid under `u` and both reject;
- `minLength` on an astral character, a combining sequence and lone surrogates;
- integer vs number: `3.0` is an integer, `3.5` and `1e300`, and a `[integer, string]` type list;
- a nested `$ref` chain a→b→c, and a `$ref` to an array whose items are a `$ref`.

All of these agree.

## Mutation sweep over `schema-check.mjs`

There were 36 mutants. The sweep ran three test files: the new schema-check suite, `assert-build-artifacts-tom-annex.test.ts` and `tom-annex-core.test.ts`.

**Killed: 30.** Every cycle-4 mutant is among them:
- `additionalProperties`, `const`, `enum`, `pattern`, `minLength`, `minItems`;
- `items`, `required`;
- `$ref` not resolved;
- the unknown-keyword throw;
- integer as number.

Also killed:
- `pattern` without `u`, and `minLength` in code units;
- `<=` boundaries for `minLength` and `minItems`;
- `in` instead of `hasOwn`, in both places;
- one-hop `$ref`, an unresolvable `$ref` made silent, and the beside-`$ref` throw;
- the walk skipping `$defs` or `properties`, and `assertImplemented` never called;
- the type-list and `typeOf` mutants;
- `$id` dropped, and `maxLength` admitted.

Disabling the cycle check is killed only by a hang, because the test loops forever.

**Survived: 6.** Three are real test gaps (finding 1). Three are equivalent or policy mutants:
- removing the early return after a type mismatch only adds messages;
- treating arrays as objects is guarded by `type` in every real schema;
- admitting `$comment` as an annotation is a policy choice.

## Findings (non-blocking)

1. **Three N1 paths are implemented but not pinned by a test.** Each mutation survived:
   - The `hasOwn` guard in `resolve()`: `$ref: "#/$defs/constructor"` with no such def would otherwise "resolve" to `Object`.
   - The walk descending into `items`. This is cycle-4 N1's "under the `items` of an empty array" case.
   - The walk resolving `$ref` off the instance path. An unresolvable or cyclic `$ref` that no instance reaches would then go unnoticed.

   Each needs a one-line test.
2. **The "cannot drift silently" claim does not cover a known keyword in a form it does not implement.**
   - `additionalProperties` as a schema and `items: false` are both ignored silently.
   - `const` and `enum` with object or array values use identity comparison.
   - Malformed keyword values are not refused: `type` typos, a non-number `minLength`, a non-array `required`.

   The shipped schema uses none of these today. The cheap fix is to have the walk check value shapes too: `additionalProperties` must be `false` or `true`; `items` an object; `const` and `enum` scalars only; `type` from the seven names; `minLength` and `minItems` integers; `required` an array of strings.
3. **N3 (carried over, owned by WP06).** The gate fixture has no `generated` field.

## Surface

- The WP05 range `daccab22..12d69b0b` (excluding kitty-specs) is 9 files: the 8 already reviewed plus `src/tests/tom-annex-schema-check.test.ts`.
- The fix commit touches only `schema-check.mjs` and the two tests. There are no stray changes.

## Gates on lane-e (1fb8f356)

- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0.
- Full `pnpm test`: exit 0.
  - src: 238 files, 4620 of 4620 passed.
  - mcp: 23 files, 181 of 181 passed.
- There were no failures, so the flake allowance was not needed.
- The glossary side effects (#448) were stashed, not committed.
