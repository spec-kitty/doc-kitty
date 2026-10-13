# Mission Specification: Generated pages and relative links hold up for consumers

**Mission Branch**: `fix/generated-page-and-link-integrity`
**Created**: 2026-10-13
**Status**: Draft
**Input**: GitHub issues #122, #129 and #131 on `spec-kitty/doc-kitty`, a code review of the three defects on `main` at `27358fe`, and the owner's decisions recorded under "Decisions already made".

## Summary

Three defects break an adopter's site without failing its build. Each was found
while building or adopting the toolkit, and each is still present on `main`.

- **#122**: when the configured Gherkin sources hold no feature files, the
  generator deletes every behaviour page it generated earlier and only warns.
- **#129**: the glossary generator writes its hub and context pages under a
  file name that the default settings do not treat as a section index, so the
  glossary's own links and every term link lead to missing pages.
- **#131**: ordinary relative Markdown links between pages (`../adr/0001-x.md`)
  are published unchanged and lead to missing pages, while the source link
  check passes them.

After this mission, each of the three either works or stops the build with a
message that says what to do. The target release is 0.3.0.

## Decisions already made

The owner settled these before the spec was written. They are not open.

| Topic | Decision |
|---|---|
| #122 behaviour | Stop the build when the sources are empty and generated pages exist. Offer an explicit opt-out for a site that is retiring its specs. |
| #122 scope of "empty" | The whole configured source set is empty. One empty source among several keeps today's warning. |
| #129 file name | Use `index` when the site lists it as an index name; otherwise use the site's first index name. |
| #129 stale files | Remove generated glossary pages left under another index name, recognised by where they are and what kind of page they are. No new ownership stamp on glossary pages. |
| #131 behaviour | Rewrite relative Markdown links to page routes when the site is built. |
| #131 gate | The source link check has two modes. A root is strict when the strict flag is given, and always for the example site's root. On a strict root a relative Markdown link to a file inside the tree is accepted only when the build would turn it into a published page, and the other build-only cases are reported: a file that is not a page, a path that leaves the docs root and comes back, a file outside the tree, a malformed escape, a folder with no index page, a bare link with no extension, and a link to a draft page when drafts are not published. On any other root the check reads the folder as files, as 0.2.0 did: a link passes when the file or folder it names exists, and reference-style definitions are checked too. |
| #131 stale links | A page's rewritten links must not go stale when another page is renamed or changes draft state. |
| Consumer proof | The consumer proof site moves to the default index name. The example site keeps covering a site with several index names. |
| #131 record | A new ADR amends ADR-0037. ADR-0037 itself is not edited. |
| Boundary | One mission. The #131 work comes last and can be cut without undoing the rest. |
| Version | 0.3.0, because #122 stops a build that passed before. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A missing spec checkout stops the build (Priority: P1)

An adopter keeps their `.feature` files in a git submodule. A CI job checks the
site out without initialising the submodule, so the source directory exists but
is empty. Today the build passes, the whole Behaviour section disappears from
the published site, and only a log warning shows it. The adopter wants the
build to stop and say why.

**Why this priority**: it is silent loss of published pages on a routine CI
mistake, and nothing in the result tells the adopter it happened.

**Independent Test**: with generated behaviour pages present, empty the
configured sources and build. The build stops, no page is removed, and the
message names the cause and the two ways out.

**Acceptance Scenarios**:

1. **Given** generated behaviour pages exist and every configured source holds no feature files, **When** the site is built, **Then** the build stops, every generated page is still on disk, and the message names the source directories, the number of pages that would be removed, the likely cause, and how to proceed.
2. **Given** the same state, **When** the page generator is run from the command line in write mode, **Then** it exits with a failure and the same message.
3. **Given** the same state and the opt-out is set, **When** the site is built, **Then** the pages are removed with a warning, as happens today.
4. **Given** no generated pages exist and the sources are empty, **When** the site is built, **Then** the build passes with a warning and creates nothing.
5. **Given** two configured sources, one empty and one holding feature files, **When** the site is built, **Then** the build passes and pages are generated from the non-empty source.
6. **Given** generated pages exist and the sources are empty, **When** the generator's check mode is run, **Then** it exits with a failure and lists every generated page as out of date, as it does today, whether or not the opt-out is set.
7. **Given** the opt-out is set to something other than true or false, **When** the site is built, **Then** the build stops and names the setting.
8. **Given** the opt-out is given only as the command-line flag, **When** the generator is run in write mode on empty sources, **Then** the pages are removed with a warning and the exit status is success.

---

### User Story 2 - The glossary works on default settings (Priority: P1)

An adopter turns the glossary on and leaves the index file name at its default.
Today the toolkit treats the glossary hub as an ordinary page at an unexpected
address: links it builds to the hub point there, the hub lists no contexts, and
the sidebar does not treat it as the glossary's index. The adopter wants the
glossary to work without knowing that a setting matters.

**Why this priority**: a headline feature is broken for every adopter who has
not copied one line from the example site's configuration.

**Independent Test**: generate a glossary for a site on the default index name
and derive the routes. The hub is the glossary section's index and each context
is at the address term links point to.

**Acceptance Scenarios**:

1. **Given** a site with the glossary on and the default index name, **When** the glossary pages are generated, **Then** the hub is the index of the glossary section and each context page is the index of its own folder.
2. **Given** that site, **When** a reader follows a term link or a link from the hub to a context, **Then** the page exists.
3. **Given** a site that lists `index` among its index names, **When** the glossary pages are generated, **Then** the files are byte-identical to what the current release writes.
4. **Given** a site upgraded from the current release with generated glossary pages left under the old file name, **When** the glossary pages are generated, **Then** the old generated files are removed and each glossary page exists once.
5. **Given** an authored page inside the glossary folder that is not a generated hub or context page, **When** the glossary pages are generated, **Then** that page is left alone.
6. **Given** an authored page sits at the exact place a generated hub or context page must be written, **When** the glossary pages are generated, **Then** the build stops, names the file, and changes nothing.
7. **Given** a page under another index name that looks like a hub or context page but does not carry exactly the fields the generator writes, **When** the glossary pages are generated, **Then** the page is kept and a warning names it.

---

### User Story 3 - Relative Markdown links work on the published site (Priority: P2)

An adopter writes links between pages the way they read on GitHub and in an
editor: `[Domain](./domain.md)`, `[ADR-0001](../adr/0001-x.md#status)`. Today
the site builds, every such link is broken once published, and the quick source
check reports nothing. The only workaround is to rewrite each link as a site
route, which then no longer works when the same file is read on GitHub.

**Why this priority**: it blocks natural authoring and was hit on the first
real adoption (61 links rewritten by hand). It ranks below the first two
because a workaround exists.

**Independent Test**: build a consumer tree, served under a base path, whose
pages link to each other in both forms. Every link resolves, and the built-link
gate passes.

**Acceptance Scenarios**:

1. **Given** a page that contains `[x](../adr/0001-x.md#status)` on a site with a base path, **When** the site is built, **Then** the link points at `/<base>/adr/0001-x/#status` and the built-link gate passes.
2. **Given** a link whose target is a section's index file, **When** the site is built, **Then** the link points at that section's route.
3. **Given** a link written as a site route, **When** the site is built, **Then** it behaves exactly as it does today.
4. **Given** a relative link to a file that is not a page, **When** the site is built, **Then** the link is left as written and the built-link gate still reports it.
5. **Given** the same relative link on an index page and on an ordinary page in the same folder, **When** the site is built, **Then** both point at the same target page.
6. **Given** a built site, **When** a linked page is renamed or becomes an unpublished draft and the site is built again without clearing anything, **Then** every page that links to it shows the new state: the new address, or the link as written.

---

### User Story 4 - The quick link check agrees with the build (Priority: P2)

An adopter runs the fast source checks before building. Today the source check
passes links that the built site then fails on. The adopter wants one answer:
a link the source check accepts is a link that works when published.

**Why this priority**: it is what makes Story 3 safe to rely on. Without it the
fast gate keeps giving a wrong green.

**Independent Test**: run the strict source check on a tree with one relative link to
a page, one to a draft, and one to a file that is not a page. It accepts the
first and reports the other two.

**Acceptance Scenarios**:

1. **Given** a relative Markdown link that the build would rewrite to a published page, **When** the source check runs on a strict root, **Then** it accepts the link.
2. **Given** a relative Markdown link to a file that is not a published page, **When** the source check runs on a strict root, **Then** it reports the link and says why.
3. **Given** a consumer tree outside the example site, **When** the adopter asks for the strict check, **Then** it is held to the rules the example site is held to: the build's resolution rule applies, and links to files that are not pages, paths that leave the docs root and come back, links to files outside the docs tree, malformed escapes, folder links with no index page, bare relative links with no extension, and links to unpublished draft pages are reported.
4. **Given** a site with its own index names, **When** the source check runs, **Then** it uses those names, not a fixed list.
5. **Given** a consumer tree and no strict flag, **When** the source check runs, **Then** it reads the folder as files: a link or reference-style definition passes when the file or folder it names exists, a missing target is reported, and nothing else is.

### Edge Cases

- "Empty" has one meaning throughout: the whole configured source set yields no feature. A file that parses but declares no feature yields none. A file that fails to parse is a separate, existing failure and stays one.
- A source set that holds only draft or `@wip` features is not empty: those features still get pages, so nothing is lost.
- Starting the local preview server on empty sources with generated pages present stops the same way as a build.
- A site that removes the Gherkin option entirely keeps its pages frozen; that stays.
- A site whose index names put `README` first and also list `index` keeps `index` for glossary pages.
- A glossary context removed from the source: its stale page is out of scope here (see Out of scope).
- A relative link with a query string keeps it; a fragment is kept after the route.
- A link to an `.mdx` page is treated like a link to an `.md` page.
- A link whose path is URL-encoded is decoded before it is matched; matching is case-sensitive.
- A link that leaves the docs tree is left as written.
- A file or folder whose name starts with `.` has no route, as the site's loader does not load it, so a link to it is left as written.
- A link to a draft page when drafts are not published is left as written, so the gate reports it.
- Where a folder holds two index-named files, the site publishes one as the folder's index and the other as an ordinary page. A link to either file points at the address that file is published at.
- Glossary index names are compared without regard to letter case, so a file system that ignores case cannot make the generator remove the page it has just written.
- Reference-style links (`[x][ref]` with a definition elsewhere on the page) are rewritten like inline links.
- Links to images and other assets are not touched.
- A bare relative link with no extension is not rewritten. The built-link gate reports it, and the strict source check reports it.
- Raw HTML anchors inside Markdown are not rewritten (see Out of scope).

## Requirements *(mandatory)*

### Functional Requirements

The last two columns are for reviewers. **Delivery** says whether a row adds behaviour (`[build]`) or holds existing behaviour in place (`[ratchet]`). **No-op passable?** says whether a change that does nothing would pass the row's check; where it would, the row names the paired row whose check fails without the change.

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Empty sources stop the build | As an adopter, I want the build to stop when my feature sources are empty and generated pages exist, so that a broken checkout cannot delete my Behaviour section. Applies to the site build and to the generator's command-line write mode. No page is removed. | High | Open | [build] | no |
| FR-002 | The message says what to do | As an adopter, I want the failure to name the source directories, the number of pages at risk, the likely cause (a submodule that was not initialised), and both ways out, so that I can fix it without reading the code. | High | Open | [build] | no |
| FR-003 | Opt-out for retiring specs | As an adopter retiring my specs, I want the site setting `gherkin.allowEmpty` and the command-line flag `--allow-empty` to allow an empty source set, so that I can remove the pages on purpose. With either set, pages are removed with a warning. | High | Open | [ratchet] | yes — paired with FR-001 on the same fixture, which stops without it |
| FR-004 | A wrongly typed opt-out is rejected | As an adopter, I want an opt-out that is not true or false to stop the build and name the setting, so that I am not left believing I opted out. Unknown settings are not newly rejected (that is #114). | Medium | Open | [build] | no |
| FR-004a | The setting and the flag stay in step | As a maintainer, I want every generator setting to have a command-line flag and the reverse, checked for this one as for the others, so that the two entry points cannot drift. | Medium | Open | [build] | no |
| FR-005 | Cases that keep today's behaviour | As an adopter, I want the new failure to fire only where pages would be lost. A first run with no pages passes with a warning; a partly empty source set passes; check mode on empty sources with pages present fails and lists the pages, with or without the opt-out. | High | Open | [ratchet] | yes — paired with FR-001 on the same fixture |
| FR-006 | Glossary pages are section indexes on any setting | As an adopter, I want generated glossary pages written under a name my site treats as an index, so that the hub and each context get the expected address. Rule: `index` when the site lists it, otherwise the site's first index name. | High | Open | [build] | no |
| FR-007 | Glossary links resolve on default settings | As a reader, I want term links, hub-to-context links and the hub's list of contexts to work on a site that kept the default index name. | High | Open | [build] | no |
| FR-008 | Stale generated glossary pages are removed, authored pages never | As an adopter upgrading, I want generated glossary pages left under another index name removed, so that no glossary page exists twice. A page is removed only when it is at the hub's place or a current context's place, under one of the site's index names or `index`, is a hub at the top or a context page in a context folder, carries exactly the fields the generator writes, and its bytes are identical to the page the generator has just written for that place. Anything else is kept with a warning: one for a page with the generator's fields and different content, another for a page with the generator's kind and different fields. An authored page, or a symbolic link, at the place a generated page must be written stops the build. So does a symbolic link at the glossary folder or at a context folder. | High | Open | [build] | no |
| FR-009 | Unchanged output where it already worked | As an adopter whose site lists `index`, I want my generated glossary files to stay byte-identical. | High | Open | [ratchet] | yes — paired with FR-006: the same generator on a site that does not list `index` must write a different file name |
| FR-010 | Every part of the toolkit agrees on a page's address | As an adopter, I want the page loader, both generators, the draft handling, the link rewrite and the source check to give the same address for the same file, for any index names I set and where a folder holds two index-named files. Today they disagree in those two cases. The example site and the consumer proof have neither case and their output does not change. If the #131 work is cut, this covers the loader, generators and draft handling only. | High | Open | [build] | no |
| FR-011 | Relative Markdown links become routes at build | As an author, I want a relative link to another page's `.md` or `.mdx` file rewritten to that page's route, with the base path applied, so that the link works on the published site. Inline and reference-style links are covered. The link is resolved from the source file's folder. | High | Open | [build] | no |
| FR-012 | Fragments and queries survive | As an author, I want `#fragment` and `?query` kept on a rewritten link. | Medium | Open | [build] | no |
| FR-013 | Links that cannot be resolved are left alone | As a maintainer, I want a relative link that does not lead to a published page left exactly as written, so that the built-link gate still reports it. Covers files that are not pages, targets outside the docs tree, unpublished drafts, and targets that do not exist (such as the `XXXX-title.md` example in an ADR template). | High | Open | [ratchet] | yes — paired with FR-011 on the same page, where a resolvable link is rewritten |
| FR-014 | Other links are untouched | As an author, I want site-route links, external links, bare relative links and asset links to behave as they do today. | High | Open | [ratchet] | yes — paired with FR-011 on the same page |
| FR-015 | The source check accepts what the build resolves | As an adopter, I want the source check, on a strict root, to accept a relative Markdown link to a file inside the tree exactly when the build would rewrite it to a published page, and otherwise to report it with the reason. On a non-strict root the target passes when the file or folder it names exists, as before. Inline and reference-style links are both checked on both kinds of root; footnote definitions are not links. | High | Open | [build] | no |
| FR-016 | Strict checking for a consumer tree | As an adopter, I want a `--strict` flag on the source check for my own docs tree, so that it is read as a built site, as the example site's root always is. Beyond the build's resolution rule, it then reports a link to a file that is not a published page, a path that leaves the docs root and comes back, a link to an existing file outside the docs tree, a malformed `%` escape, a folder link whose folder has no index page, a bare relative link with no extension and, with drafts not published, a link to a draft page. A folder link is answered from the route table, a `related:` ref is matched against page ids as the build does, and a root-absolute link is checked only for a draft target, its route being left to the built-link gate. Lookup is case-sensitive. Without the flag a root that has an Astro config next to it gets one note suggesting `--strict`; the exit code is unchanged. | Medium | Open | [build] | no |
| FR-017 | The source check honours the site's index names | As an adopter, I want to tell the source check my site's index names with `--index-basename`, so that it does not assume a fixed list. Without the flag it assumes `README` and `index`, as it does today. The guide says this is a third place to keep in step with the site and loader settings. | Medium | Open | [build] | no |
| FR-018 | The decision is recorded | As a maintainer, I want a new ADR that amends ADR-0037 to accept relative Markdown links as an authored form and states the resolution rule, and a second new ADR that records the Gherkin and glossary changes of FR-001 to FR-009 and amends the two ADRs they touch. If the #131 work is cut, only the second ADR is written. | Medium | Open | [build] | no |
| FR-019 | Adopter documentation | As an adopter, I want the consumer-setup guide to describe the new failure and its opt-out (with advice to remove the opt-out once the pages are gone), the glossary file-name rule, both link forms, and the source check's flags; the caveat that says the source check is not strict for a consumer tree is replaced. The changelog classifies each visible change: FR-001, and the glossary pages moving to a new file name with the new stops (an authored file or symbolic link, a symbolic-link folder, a name that is not a plain file name), as Breaking; the source check's `--strict`, `--index-basename` and `--help` flags as Added; reference-style definitions now checked, bad options named before scanning (the exit status was already 2) and the new summary line as Changed; on default settings the hub becoming a recognised section index at `/glossary/`, and stale pages removed, as Fixed. The source check is not Breaking, because a non-strict root changes only by checking reference-style definitions. An "Upgrading from 0.2.0" note says links rewritten as site routes keep working and need no change. If the #131 work is cut, the link and source-check parts are left out. | Medium | Open | [build] | no |
| FR-020 | A consumer proof covers the three fixes | As a maintainer, I want the consumer proof (a small site built from the packaged toolkit, as an adopter would install it) to use the default index name with the glossary on, and to link pages in both forms, so that a regression is caught as an adopter would meet it. If the #131 work is cut, the proof covers the glossary on the default index name only. | Medium | Open | [build] | no |
| FR-021 | Rewritten links never go stale | As an author, I want every page that links to a page I rename, or whose draft state I change, to show the new state on the next build or the next start of the local preview server, with nothing to clear by hand. A rename while the preview server is running shows after a restart. | High | Open | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | No change for pages without relative Markdown links | The example site's built output is byte-identical before and after this mission: 0 differing files. | Compatibility | High | Open |
| NFR-002 | No change to committed example pages | 0 committed files under the example's glossary folder are renamed, added or removed by this mission. | Compatibility | High | Open |
| NFR-003 | Build time | The example site's full build takes no more than 10% longer than on `main`: same machine, diagram cache warm, runs alternated between the two, median of five each. Recorded in the PR as an observation; it is not an automated gate. | Performance | Medium | Open |
| NFR-004 | Deterministic output | Two builds of the same tree produce byte-identical link output: 0 differing files. | Reliability | High | Open |
| NFR-005 | Existing gates stay green | All existing test, link, artifact and accessibility gates pass on the mission's head; no existing gate is weakened or removed. | Quality | High | Open |
| NFR-006 | Test economy | Each new test guards one behaviour in this spec through an existing entry point and fails when its fix is reverted; 0 tests that only pin code shape. | Quality | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Accepted ADRs are not edited | ADR-0037, ADR-0026 and ADR-0046 are amended by new ADRs. No accepted ADR's text is changed. | Governance | High | Open |
| C-002 | One route rule | The link rewrite and the source check use the shared rule from FR-010. Neither carries its own copy of the index-name or route logic. | Technical | High | Open |
| C-003 | No new ownership stamp on glossary pages | Stale glossary pages are recognised by location and page kind. The existing guard that glossary pages carry no generated-by field stays. | Technical | High | Open |
| C-004 | Whole-set emptiness only | FR-001 fires only when the entire configured source set yields no features. | Business | High | Open |
| C-005 | #131 is severable | The work for FR-011 to FR-017 and FR-021 lands after FR-001 to FR-010 and can be dropped without reverting them. If it is dropped, #131 stays open, SC-003 to SC-005 do not apply, and FR-010 and FR-018 to FR-020 shrink as each row states. | Delivery | Medium | Open |
| C-006 | Version | The change ships as 0.3.0. The changelog classes are those in FR-019. | Business | Medium | Open |
| C-007 | Machine-readable page source is unchanged | The agent page API keeps returning links as the author wrote them. | Technical | Medium | Open |

### Key Entities

- **Index name**: a file name a site treats as the index of its folder (default `README`; a site may list several).
- **Route**: the address a docs file is published at, after index names collapse to their folder.
- **Generated page**: a page written by a toolkit generator (Gherkin behaviour pages, glossary hub and context pages), as opposed to an authored page.
- **Relative Markdown link**: a link whose target is another docs file's path ending in `.md` or `.mdx`, written relative to the linking file.
- **Source link check / built-link gate**: the fast check that reads the docs tree, and the check that reads the built site.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With generated behaviour pages present and empty sources, 100% of builds stop and 0 pages are removed, unless the adopter opted out. — [build] · no-op passable: no
- **SC-002**: On a site using the default index name, 100% of glossary term links and hub links lead to an existing page. — [build] · no-op passable: no
- **SC-003**: A consumer site served under a base path, with pages linked in both forms, builds with 0 broken cross-page links reported by the built-link gate. — [build] · no-op passable: no
- **SC-004**: For the consumer proof tree, the strict source link check and the built-link gate report the same set of broken relative Markdown links: 0 accepted by one and rejected by the other. — [build] · no-op passable: no
- **SC-005**: An adopter can write every cross-page link as a relative file path that also works when the file is read on GitHub: 0 links need rewriting as site routes. — [build] · no-op passable: no
- **SC-006**: The example site's published output is unchanged by this mission: 0 differing files. — [ratchet] · no-op passable: yes — paired with SC-002 and SC-003, which fail without the change. The pairing is across two sites, because the example has no relative Markdown link that leads to a page.

## Out of scope

- Raw HTML anchors inside Markdown.
- Rejecting unknown or misspelled Gherkin settings in general (#114 covers that class).
- Removing the page of a glossary context that was deleted from the source.
- Treating an authored page inside the glossary folder as an error.
- Failing when one source among several is empty.
- Guarding a site that does not commit its generated behaviour pages: with no pages on disk the build cannot tell an empty checkout from a first run. The guide already tells adopters to commit them.
- The other open follow-ups, each for its own reason: #112 (needs a display-name decision and moves sidebar baselines), #113, #114, #124, #126, #128, and the remaining Gherkin follow-ups.
- Feeds, `llms.txt` and the agent index: they carry addresses, not page bodies, so they hold no relative links.

## Assumptions

- A site's index names, docs folder, base path and draft setting are all known before pages are rendered, so the route rule can be applied during the build. The grounding pass found these available where the integration is set up.
- The path of the file being rendered is available to the link rewrite. Confirmed by reading the installed framework code, not yet by a run.
- The same rewrite applies to `.mdx` pages. Confirmed the same way; neither the example nor the consumer proof has an `.mdx` page, so the plan must add one test that exercises it.
- The example site contains one relative Markdown link, a template placeholder that leads nowhere, so NFR-001 is achievable.
- Adding a step to the Markdown pipeline moves tests that count or list the pipeline's steps: one if the step joins an existing group, at least four if it is added as a new group. Updating those is expected work, not a weakened gate. The plan chooses the placement that moves fewest.
- The Gherkin hub is written under the site's first index name and the glossary under `index` when listed, so one site can hold both `README.md` and `index.md` hubs. This is intended: it keeps existing glossary output unchanged.

## Risks

- A link's target is renamed or changes draft state between builds, and a cached page keeps the old address. Confirmed by reading the framework's cache rule; FR-021 covers it.
- The consumer proof no longer shows a site with several index names working from the packaged toolkit; only the example site does.
- A docs tree that lives outside the site project, or is reached through a symlink, resolves to a different real path than the one the rewrite compares against.
- The consumer proof's tree and settings change. Its addresses and lockfile are expected to stay the same.
- PR #132 adds entries to the same changelog section; expect a merge of the two at rebase.

## Issue matrix

| Issue | Role | Requirements | Verdict |
|---|---|---|---|
| #122 | Fixed by this mission | FR-001 to FR-005, FR-018 to FR-020 | pending |
| #129 | Fixed by this mission | FR-006 to FR-010, FR-018 to FR-020 | pending |
| #131 | Fixed by this mission, unless cut under C-005 | FR-010 to FR-021 | pending |
