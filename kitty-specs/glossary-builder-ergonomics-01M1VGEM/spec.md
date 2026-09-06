# Mission Specification: Glossary builder ergonomics (#83)

**Mission Branch**: `feat/glossary-builder-ergonomics`
**Created**: 2026-09-06
**Status**: Draft
**Input**: User description: "Issue #83 — consolidate the three equivalent
glossary link-text concatenators into one exported helper, tighten the
`as unknown as` casts at the two shared-builder call sites, and fix the
contract wording nit. Behaviour-preserving cleanup deferred from the #77/#79
pre-PR adversarial squad."

This mission is **DISCIPLINED_REFACTORING**, not a feature. It closes the
code-ergonomics follow-ups the #77/#78/#79 pre-PR squad (paula-patterns,
reviewer-renata, debugger-debbie) filed as issue #83. None of them is a
correctness risk today; the value is removing a standing DRY hazard and
restoring the one compile-time regression check the double-casts disable.
Every change lives inside the **glossary bounded context** and its tests. The
built corpus must be **byte-identical** before and after.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A maintainer edits the glossary link text derivation in ONE place (Priority: P1)

After #79 the codebase carries three equivalent "concatenate the text of a
node's subtree" functions: `textOf` in `src/lib/glossary/link-node.ts` (feeds
the `aria-label` visible text), `textContent` in
`src/lib/remark/glossary-autolink.internal.ts` (feeds the links-used surface
and the per-section already-linked seed), and `textOf` in
`src/lib/remark/glossary-term.ts` (feeds `:term` warnings, the suppress form
and the fallback label). They cannot drift *today* because the `aria-label`
and the used-list surface are each computed over the same node's `children`,
but nothing structural stops a future edit to one of them from silently
desynchronising the accessible name from the recorded surface. This story
consolidates them into one exported helper in the glossary lib and routes all
three call sites through it.

**Why this priority**: it is the substantive DRY hazard the squad flagged and
the reason the issue exists. It touches all three modules, so it is sequenced
first; the cast tightening rides on the same files.

**Independent Test**: exactly one text-concatenation helper is defined under
`src/lib/glossary/` and `src/lib/remark/glossary-*`; the other two definitions
are gone; the full unit suite (including both parity guards and the two
per-builder goldens) is green; the rebuilt corpus is byte-identical.

**Acceptance Scenarios**:

1. **Given** the three call sites (aria-label composition, links-used surface +
   section seed, `:term` label/warning text), **When** the code is searched
   for a subtree-text concatenator, **Then** exactly one definition exists, it
   is exported from the glossary lib, and all three call sites import it.
2. **Given** an auto-linked term and a `:term` link for the same surface,
   **When** the cross-emitter parity test runs, **Then** both emitters still
   produce an identical `hProperties` bag and href (the consolidation changed
   no output).
3. **Given** a `:term` with rich label children (emphasis / nested), **When**
   the shared builder composes the `aria-label`, **Then** it is still the
   plain concatenated text followed by `, glossary term` (existing unit test
   stays green unmodified).
4. **Given** the demonstrator site, **When** it is rebuilt after the change,
   **Then** every file under `example/dist` has the same content hash as a
   build from the pre-change tree.

---

### User Story 2 - The compiler checks the shared builder's return shape at both call sites (Priority: P2)

Both callers of the shared builder launder its return value through
`as unknown as MdNode` / `as unknown as MdastNode`. The runtime shape is
correct (parity + golden guards backstop it) but the double-cast disables the
one compile-time check that the builder still returns something the callers'
tree walkers can hold. This story makes the builder's return type genuinely
assignable to both callers' local node interfaces so that no `unknown` cast is
needed — **without** adding `@types/mdast`.

**Why this priority**: restores a real (if small) compile-time regression net
at zero runtime cost; it is the second finding in the issue.

**Independent Test**: `grep -n "as unknown as" ` over the two remark modules
returns nothing; `tsc --noEmit -p src/tsconfig.json` reports no new errors
versus the pre-change baseline (the baseline carries pre-existing, unrelated
errors in other test files); CI's typecheck stays green.

**Acceptance Scenarios**:

1. **Given** the builder's exported return type, **When** a caller assigns it
   directly to its local `MdNode` / `MdastNode` typed variable, **Then**
   TypeScript accepts it with no cast, or at most a single non-`unknown`
   cast (`as MdNode`).
2. **Given** a future edit that changes the type of a field the callers
   also declare (e.g. `url: number`, `children: string[]`), **When** the
   project is typechecked, **Then** the compiler reports the break at the
   call sites (the check is live again). Removing an optional-in-caller
   field such as `url` would not error, since the callers declare it
   optional; what the check restores is field-type compatibility.
3. **Given** the change, **When** `package.json` is inspected, **Then** no
   dependency was added, upgraded or removed (no `@types/mdast`).

---

### User Story 3 - The shared-builder contract says something true about assignability (Priority: P3)

`kitty-specs/glossary-a11y-followups-01M1V8Y9/contracts/shared-link-node.md`
states the return type is "assignable to both callers' local `MdNode` /
`MdastNode` interfaces". With the pre-#83 types that was false (a double-cast
was required). Story 2 makes it true; this story updates the wording so the
contract records the mechanism (a `type` alias, whose implicit string index
signature makes it assignable) and the fact that no cast is needed.

**Why this priority**: documentation fidelity (DIRECTIVE_010); cheap once
Story 2 lands.

**Independent Test**: the contract's assignability sentence matches the
post-change types, and cites #83.

**Acceptance Scenarios**:

1. **Given** the updated contract, **When** it is read beside the code,
   **Then** its assignability statement is accurate for the shipped types.

---

### User Story 4 - Two test docstrings/assertions say exactly what they prove (Priority: P4, optional)

Two low-severity test nits from the same squad:

- `caretLeftProperty(...)` in `tests/a11y/glossary.spec.ts` is asserted
  `!== ''`, which accepts any non-empty value (including `0px`); it proves
  `setProperty` ran, not that the caret offset is sane (debugger-debbie A4).
- The live parity `toEqual` in `glossary-link-node-parity.test.ts` is, post
  extraction, a **re-fork guard** (it fails if either emitter stops delegating
  to the shared builder); the literal `aria-label` assertion and the goldens
  are what catch an aria-label drop. The docstring still describes the
  pre-extraction world ("each build the glossary link node from their own
  inline builder"). (debugger-debbie B1)

**Why this priority**: optional, cheap, and both improve the honesty of the
guards. Include only if they do not perturb the gates.

**Independent Test**: the a11y suite still passes in both colour modes with
the tighter caret assertion; the parity suite passes with the corrected
docstring.

**Acceptance Scenarios**:

1. **Given** an opened popover in either placement, **When** the caret offset
   property is read alongside the anchor's and popover's rects, **Then** it is
   a `px` length that lies within the positioning code's clamp band
   (8px to popover width minus 8px) and tracks the anchor's horizontal centre
   (or the nearest clamp edge) within 1px, rather than merely non-empty.
2. **Given** the parity test file, **When** its header docstring is read,
   **Then** it describes the guard as a re-fork guard over the one shared
   builder and names the literal assertion + goldens as the aria-label net.

---

### Edge Cases

- **Text node with a non-string `value`**: not producible by mdast, but the
  three concatenators disagree on paper (`value ?? ''` versus a
  `typeof value === 'string'` check). The consolidated helper uses the strict
  string check; for every real mdast input the output is identical.
- **Text node with `children`**: mdast text nodes are leaves. The
  visit-based `textContent` would also have descended into such children; the
  recursive `textOf` variants would not. Irrelevant for real input; the
  consolidated helper treats `text` as a leaf, which is what both `textOf`
  variants (the aria-label and the `:term` label) already did.
- **`GlossaryLinkNode` as a `type` alias instead of an `interface`**: a
  type alias gets TypeScript's implicit string index signature, which makes
  it assignable to the callers' index-signatured interfaces. An explicit
  `[key: string]: unknown` on an interface would also work but would turn
  off excess-property checking on the builder's own return literal (a
  squad-verified cost); the alias keeps that check. The runtime object is
  unchanged either way.
- **Callers' interface widening**: if a caller's `MdNode`/`MdastNode` is
  widened instead of the builder type, keep the change confined to the
  glossary modules (no shared `MdastNode` in the deck-split / diagram-meta
  siblings is touched).

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | One exported subtree-text helper | As a maintainer, I want one exported text-concatenation helper in the glossary lib so that the aria-label, the links-used surface and the `:term` label are derived by the same code. | High | Open |
| FR-002 | All three call sites route through it | As a maintainer, I want the three former definitions removed and their callers importing the shared helper so that no second implementation can drift. | High | Open |
| FR-003 | No `unknown` cast at the builder call sites | As a maintainer, I want the shared builder's return type assignable to both callers' local node interfaces so that the compiler again checks the shape at the call sites. | Medium | Open |
| FR-004 | Contract wording matches the types | As a reader of the #77/#79 contract, I want its assignability statement to be true for the shipped types. | Low | Open |
| FR-005 | Caret offset sanity (optional) | As a maintainer, I want the e2e caret-offset check to assert a sane `px` length rather than any non-empty string. | Low | Open |
| FR-006 | Parity docstring accuracy (optional) | As a maintainer, I want the parity test's docstring to describe what the `toEqual` proves post-extraction. | Low | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Byte-identical corpus | A fresh `pnpm build` after the change yields `example/dist` whose every file hashes identically to a fresh build from the pre-change tree (0 differing files), excluding files proven order-nondeterministic across builds of an unchanged tree (item-sorted comparison applies there). | Reliability | High | Open |
| NFR-002 | Full gate suite green | `pnpm test` (serial), `pnpm build`, `validate:docs`/`validate:example`/`validate:adr-index`/`validate:links`, `assert:artifacts`/`assert:no-broken-links`/`assert:markua`, and `test:a11y` pass locally (where the environment allows) and in CI on the branch. | Quality gate | High | Open |
| NFR-003 | Parity guards untouched and green | `glossary-link-node-parity.test.ts` and `glossary-substrate-parity.test.ts` pass with no new exclusion and no assertion weakened. | Correctness | High | Open |
| NFR-004 | No new typecheck errors | `tsc --noEmit -p src/tsconfig.json` reports no error in any glossary or remark module and no increase in the pre-existing baseline count. | Quality gate | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Behaviour-preserving | No `hProperties` key, `aria-label` text, href, class, child node, warning string or links-used entry changes. Any output difference is a defect. | Technical | High | Open |
| C-002 | No new dependency | `@types/mdast` (or any other package) is not added; the hand-rolled structural node types remain (D3 of the #77/#79 plan). | Technical | High | Open |
| C-003 | Glossary bounded context only | Edits are confined to `src/lib/glossary/`, `src/lib/remark/glossary-*`, their unit tests, `tests/a11y/glossary.spec.ts`, and the one contract document. The sibling `MdastNode` interfaces in deck-split / diagram-meta are not touched. | Technical | High | Open |
| C-004 | Shared-builder invariant kept | Both emitters keep delegating to the one shared builder (C-001 of the #77/#79 mission); the helper consolidation must not reintroduce a second builder. | Technical | High | Open |

### Key Entities

- **Subtree-text helper**: the one exported pure function
  `(node) => string` that concatenates the `value` of every `text` node in a
  node's subtree in document order. Lives in the glossary lib beside the
  shared builder.
- **Glossary link node type**: the builder's exported return type; after this
  mission it is a `type` alias (implicit string index signature) so it is
  structurally assignable to both callers' local node interfaces with no
  cast, while keeping excess-property checks on the builder's literal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Definitions of a subtree-text concatenator across
  `src/lib/glossary/` and `src/lib/remark/glossary-*` drop from 3 to 1; all
  three call sites import it.
- **SC-002**: Occurrences of `as unknown as` in
  `glossary-autolink.internal.ts` and `glossary-term.ts` drop from 2 to 0.
- **SC-003**: 0 files under `example/dist` differ between a pre-change and a
  post-change fresh build.
- **SC-004**: The unit test count does not decrease; both parity guards and
  both per-builder goldens pass unmodified in their assertions.
- **SC-005**: The #77/#79 contract's assignability sentence is accurate for
  the shipped types.
