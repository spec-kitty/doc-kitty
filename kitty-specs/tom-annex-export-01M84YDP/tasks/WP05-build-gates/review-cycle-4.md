---
affected_files: []
cycle_number: 4
mission_slug: tom-annex-export-01M84YDP
reproduction_command:
reviewed_at: '2026-11-24T07:37:16Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP05
---

# WP05 review cycle 4: REJECT

Reviewer: claude::reviewer-renata. Lane head reviewed: f425d53. The code is in af7f3b1, and `git diff af7f3b1 f425d53 -- . ':!kitty-specs'` is empty. The review flow's auto-rebase then added 876ea42d, which touches only `status.json` and `status.events.jsonl`.

The cycle-3 blocker is fixed. The new schema layer, `schema-check.mjs`, has two problems. It implements `additionalProperties: false` wrongly, and almost none of its keyword logic is pinned by a test. Both are cheap to fix.

## Blocking

**Issue 1: a key named like an `Object.prototype` member gets past `additionalProperties: false`, and so does `__proto__`.**

The bug is in `check()`:

```js
const properties = s.properties ?? {};
for (const [key, child] of Object.entries(obj)) {
  if (key in properties) check(child, properties[key], root, `${at}/${key}`, out);
  else if (s.additionalProperties === false) out.push(`${where}: unknown key "${key}"`);
}
```

- `key in properties` also looks up the prototype chain.
- For a key such as `constructor`, `toString`, `valueOf`, `hasOwnProperty` or `__proto__`, the test is true. The key then counts as declared, and the value is checked against `Object`, `Object.prototype.toString` and so on.
- `Object.keys()` of those functions is empty, so nothing is reported.
- `JSON.parse` creates each of these as an own key, including `__proto__`.

I compared verdicts with Ajv 8.17.1 (`ajv/dist/2020`, installed in a scratch directory, not the repo) on 39 documents derived from the good fixture. There were 6 disagreements, and all 6 are this bug. In each one, schema-check says the document is valid and Ajv rejects it:

| Edit to the good index | schema-check | Ajv |
|---|---|---|
| top-level `"constructor": 1` | valid | invalid |
| top-level `"toString": "x"` | valid | invalid |
| top-level `"__proto__": {"a": 1}` | valid | invalid |
| `scopes.system[0].hasOwnProperty = 1` | valid | invalid |
| `scopes.system[0].evidence[0].valueOf = 1` | valid | invalid |
| `catalog.constructor = "x"` | valid | invalid |

None of these affects SC-001 accounting, because the explicit checks do not read these keys. The module doc says this layer "closes the whole class of shape holes (an unknown key, …)". The keys above are exactly that class. The built file is also what consumers validate against the shipped schema, so the gate passes files that a standard validator rejects.

`required` has the same flaw in principle: `!(key in obj)` would count an inherited key as present. No required key is a prototype name today, so it is latent. Fix it anyway.

**Fix:**
- Use `Object.hasOwn(properties, key)` for the property lookup.
- Use `Object.hasOwn(obj, key)` for `required`.
- Add a negative case, red first. Use `JSON.parse` text, so that `__proto__` is an own key. The case should cover at least `constructor` and `__proto__`, at the top level and inside an evidence ref.

**Issue 2: most of the schema layer's keyword logic is not tested.** 11 of 13 keyword mutations survive.

I mutated `schema-check.mjs` one keyword at a time and ran `assert-build-artifacts-tom-annex.test.ts` and `tom-annex-core.test.ts`.

- Killed: the `type` check, and recursion into `properties`.
- Survived: everything else.
  - `additionalProperties: false` disabled;
  - `const` disabled;
  - `enum` disabled;
  - `pattern` disabled;
  - `minLength` disabled;
  - `minItems` disabled;
  - `items` not descended;
  - `required` disabled;
  - `$ref` not resolved;
  - the unknown-keyword throw disabled;
  - integer no longer accepted for `number`.

The only test that reaches this layer is `catalog.default: "yes"`, which is a `type` case. The other schema-detectable edits in the suite are already reported by an explicit check, and the tests match the explicit message, so the schema layer could do nothing and every test would stay green. In particular, nothing shows that the module throws on an unimplemented keyword, which is its stated safeguard against drift.

**Fix:** add a direct unit test of `schemaProblems`. Pass small inline schemas through its second parameter, which already exists for this.
- Give one valid and one invalid instance for each implemented keyword.
- Cover `additionalProperties: false` together with `properties`.
- Cover a `$ref` into `$defs`.
- Check that an unresolvable `$ref` and an unimplemented keyword (for example `maxLength`) each throw.

Then each keyword mutation above should turn a test red. Do not add a validator dependency.

## Non-blocking

- **N1. The "fails loudly on an unknown keyword" guard only covers the schema nodes this instance reaches.** I ran these with inline schemas:
  - An unimplemented keyword is silently ignored in several places:
    - under an optional property the instance does not have, such as `generated`, which the gate's current input lacks;
    - under the `items` of an empty array;
    - in a `$defs` entry that nothing reaches;
    - beside a `$ref`. In 2020-12, sibling keywords of `$ref` apply, but `resolve()` drops them.
  - A chained `$ref` (`a → b`, where `b` is `{type: "string"}`) accepts `5`, because `resolve()` follows only one hop.
  - The shipped schema does none of this today, so all of it is latent. The cheap fix is one static walk of the whole schema at module load: reject unknown keywords, reject keywords beside `$ref`, and resolve `$ref` until it reaches a schema without one. The claim in the doc comment would then hold for every node.
- **N2. Two small differences from 2020-12 semantics, both latent with the shipped schema.**
  - `minLength` counts UTF-16 code units, where JSON Schema counts code points.
  - `pattern` is compiled without the `u` flag. Ajv uses `u`.
  - One line in the doc comment would be enough, or use `[...value].length` and `new RegExp(p, 'u')`.
- **N3 (heads-up for WP06, not a WP05 defect).** WP06 will make `generated` required in the shipped schema. The good fixture in `assert-build-artifacts-tom-annex.test.ts` has no `generated` field, so once WP06 lands, the schema layer will fail that fixture. Whichever WP lands second needs to add `generated` to the fixture.

## Verified fixed

- **Cycle-3 blocker (an unknown scope key).**
  - Both cycle-3 repros now report `unknown scope: vendor`: the same covered measure double-listed under `vendor`, and an uncovered measure under `vendor` citing an unbuilt URL. The schema layer reports both as well.
  - Removing the explicit loop turns the new test red.
- **The schema-only negative case is genuine.** Ajv also rejects `catalog.default: "yes"`. No explicit check in `verify.mjs` reads `catalog.default`. Removing the schema layer turns that test red, and the in-test positive control shows the good index has no schema problem.
- **N1 from cycle 3 (null entries).** A `null` scope entry and a `null` evidence ref are each reported, with no throw. All four mutations (dropping either guard, or silencing either message) are killed.
- **Other keyword verdicts agree with Ajv.** Away from Issue 1, all 33 other documents got the same verdict from both validators:
  - `type`, including string-or-null;
  - `const`, `enum`, `required`, `minItems` and `minLength`;
  - `pattern`. It is unanchored as in JSON Schema, and the schema's own `^…$` anchors behave correctly, for example `x1.2`, `1.2x` and `ok\nX`;
  - `$ref` into `$defs`, and `additionalProperties` on nested objects;
  - `generated` with a valid, null, malformed, numeric or extra-key `at`, or with missing fields;
  - integer vs number: `format_version: 1` is rejected as a non-string, matching Ajv.
- **The annotations `$schema`, `$id`, `title` and `description` are accepted.** An unlisted annotation such as `$comment` throws, which fails loud.
- **The JSON import attribute is portable.**
  - `import … with { type: 'json' }` loads without an ExperimentalWarning on Node 22.23.5. `engines` is `>=22.22.0`, and CI uses Node 22.
  - Vitest, `tsc` and ESLint all accept it.
  - The module is reached only by the gate script (`node`) and the tests, not by the Astro runtime bundle.

## Surface

- The whole WP05 range, `daccab22..f425d53`, excluding kitty-specs, is the 7 files accepted in cycle 3 plus the new `src/lib/tom-annex/schema-check.mjs`. There are no stray changes.
- On the status files, the manual `status.json` resolution in f425d53 lost no event: lane-e at f425d53 holds every event that 43e5e75 held. Two events are on lane-e and have never been on coordination: `01M85J9VP72KT8XPD0AZCVMNXC/D`, from 2026-11-24T01:21, the cycle-1 era. They were already on the lane at 43e5e75, so they predate this cycle. Coordination is authoritative, and the review flow's merge (876ea42d) re-synced `status.json`.

## Gates on lane-e (f425d53)

- `pnpm lint`: exit 0. `pnpm typecheck`: exit 0.
- Full `pnpm test`: exit 0. src: 237 files, 4600 of 4600 tests passed. mcp: 23 files, 181 of 181 tests passed. The `FAILED` lines in the log come from the negative cases of the changelog-page gate tests, which pass. There were no failures, so the flake allowance was not needed.
