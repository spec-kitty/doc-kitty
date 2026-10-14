# Gherkin test-suite inventory (issue #156, DIRECTIVE_041 KEEP / RETIRE / SPLIT-BY-KIND)

Read-only analysis of `src/tests/gherkin-*.test.ts` (17 files, 406 `it`/`it.each` rows) against
`src/lib/gherkin/*.mjs`, `src/lib/remark/gherkin-fence.ts`, `src/lib/config.ts` (gherkin hooks) and
`src/scripts/generate-feature-pages.mjs`. `tests/a11y/gherkin.spec.ts` and
`tests/consumption/scripts/assert-consumer-gherkin.mjs` are KEEP by mandate and are only cited where they
also cover something.

**Rule applied.** A RETIRE names a surviving test (`file:line`) that turns red on the same source break, and the
source line/branch both guard. A test that looks alike but asserts something the survivor does not is KEEP
(or MERGE). When unsure: KEEP, with the reason given. `it.each` = one row. Line numbers are the `it(` line.

## Layer legend

| Tag | Entry point |
|-----|-------------|
| PARSE | `parse.mjs` `parseGherkin` / `formatProblem` / `describeParseError` |
| FRAG | `fragment.mjs` `parseFragment` |
| SELECT | `select.mjs` `selectScenarios` |
| VIEW | `view.mjs` `featureView`, `resolveLevels`, `summaryText`, `titleOf`, ... |
| RENDER | `render.mjs` `renderFeatureBody` / escapers / `warnDuplicates` (generated-page + agent Markdown emitter) |
| MDAST | `mdast.mjs` `featureMdast` (in-page emitter), optionally through `mdast-util-to-hast` |
| RESOLVE | `include.mjs` `resolveInclude` (trust boundary) |
| STAGE-u | `gherkinFence` remark plugin on a bare unified run (remark-parse + gfm + directive) |
| STAGE-A | `gherkinFence` inside Astro's real content-entry renderer (`getRenderFunction`: smartypants, Expressive Code, rehypeHeadingIds) with the `defineDocKittyIntegrations` plugin stack. In-process, no build. |
| STAGE-site | `defineDocKittyIntegrations` remark stack on unified + Starlight's real `remarkDirectivesRestoration` |
| SINK | `errors.mjs` fatal sink |
| CORE | `feature-core.mjs` (tags to frontmatter) |
| LOAD | `load.mjs` `loadFeatures` |
| GEN | `generate.mjs` `generateFeaturePages` / `planFeaturePages` / `diffFeaturePages` / `scanOutputDir` |
| OPTS | `options.mjs` |
| HOOK | `config.ts` `doc-kitty:gherkin` `astro:config:setup` / `defineDocKittyIntegrations` |
| CLI | spawned `src/scripts/generate-feature-pages.mjs` (exit code + stdout/stderr) |
| MDPROC | Astro's `createMarkdownProcessor` (in-process) + `scenarioRecords` |
| BUILD | **real `astro build` / `astro sync`** in `example/.dk-test-gherkin-fence/` (slow; `build` vitest project) |

---

## 1. gherkin-parse.test.ts (PARSE / FRAG): view-level unit, KEEP by mandate

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 42 | parseGherkin > returns the document and no errors for valid Gherkin | PARSE | valid source gives document, empty errors/problems | KEEP |
| 49 | parseGherkin > builds fresh ids per call | PARSE | two parses produce identical ids/JSON | KEEP |
| 56 | parseGherkin > returns every error, formatted, instead of throwing | PARSE | bad table gives undefined document plus formatted error and problem | KEEP |
| 66 | parseGherkin > applies the line and column offsets to the formatted error, not to the problem | PARSE | offsets applied to message only | KEEP |
| 73 | parseGherkin > leaves an end-of-file column at 0 | PARSE | EOF error column stays 0 under offsets | KEEP |
| 87 | formatParseProblem/... > reads the location from the message prefix | PARSE | `(3:5):` prefix parsed into line/col/expected | KEEP |
| 99 | ... > omits the location when there is none | PARSE | no location gives `[dk-gherkin] file msg` | KEEP |
| 104 | ... > formatProblem is the same text without the log prefix | PARSE | formatProblem vs formatParseProblem prefix | KEEP (the include stage quotes this text; only unit pin) |
| 118 | parseFragment: complete feature > does not wrap | FRAG | full feature: lineShift 0, synthetic false | KEEP |
| 126 | ... > returns an empty or comment-only body as a document with no feature | FRAG | empty/comment gives no feature, no error | KEEP (the stage's `!view → null` wiring is fence.test:410) |
| 139 | parseFragment: steps only > wraps in a synthetic, untitled Feature and Scenario | FRAG | lineShift 2, synthetic both, step texts | KEEP |
| 150 | ... > keeps AST locations in wrapped coordinates | FRAG | location minus lineShift equals author lines | KEEP |
| 155 | ... > accepts the `* ` keyword and indented steps | FRAG | `*` steps wrap | KEEP |
| 161 | ... > wraps even when a doc string contains a `Feature:` line | FRAG | parser-driven wrap, not a line scan | KEEP |
| 172 | ... > keeps leading comments above the synthetic lines | FRAG | comment line stays 1 | KEEP |
| 179 | ... > reads CRLF line endings | FRAG | CRLF steps-only parses | KEEP |
| 187 | Scenario/Background/Rule w/o Feature > wraps a Scenario in a synthetic Feature only | FRAG | lineShift 1, synthetic.feature only | KEEP |
| 196 | ... > keeps tags above a Scenario on that Scenario | FRAG | tags not hoisted to synthetic Feature | KEEP |
| 204 | ... > wraps a Background with Scenarios, and a Rule | FRAG | Background / Rule fragments wrap | KEEP |
| 217 | real errors > reports an error inside a steps-only fragment at its original line | FRAG | wrapped error line mapped back | KEEP |
| 225 | ... > reports an error after a Scenario-only wrap at its original line | FRAG | line 3 after 1-line shift | KEEP |
| 232 | ... > does not wrap when the first error is not a missing Feature line | FRAG | language / late-table errors not wrapped | KEEP |
| 244 | ... > does not wrap when a bad tag line comes first | FRAG | bad tag gives no wrap | KEEP |
| 250 | ... > does not wrap a dangling tag at end of file | FRAG | `@t` gives EOF error | KEEP |
| 258 | ... > reports tags followed by steps at the step line | FRAG | `@t` + step error at line 2 | KEEP |
| 270 | page lines §1.4 > an unwrapped fence: content line 3 reports page line 43 | FRAG | lineOffset applied, unwrapped | KEEP (fence.test:552 adds Astro body-offset on top; different seam) |
| 277 | ... > a wrapped fence: content line 3 reports page line 43 | FRAG | lineOffset + wrap shift | KEEP |
| 286 | ... > adds the column offset of an indented fence | FRAG | columnOffset applied | KEEP |
| 293 | `# language:` > nl steps get a Functionaliteit and a Voorbeeld | FRAG | localised synthetic keywords | KEEP |
| 305 | ... > an nl Scenario gets a Functionaliteit only | FRAG | nl Scenario wrap | KEEP |
| 312 | ... > English step keywords are not steps in an nl fragment | FRAG | read as description | KEEP |
| 335 | authoring.md fences > has two | docs data | guide holds 2 fences | KEEP (guards the docs, not code) |
| 339 | ... > the metadata-tags example is a complete feature | FRAG on docs | guide fence 1 parses unwrapped | KEEP |
| 346 | ... > the declarative-scenarios example is a steps-only fragment | FRAG on docs | guide fence 2 wraps | KEEP |

## 2. gherkin-select.test.ts (SELECT): view-level unit, KEEP by mandate (one internal duplicate)

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 98 | by name > a top-level scenario keeps the Feature Background and drops every Rule | SELECT | pruned shape + `selected` ref | KEEP |
| 106 | ... > a scenario inside a Rule keeps that Rule and its Background only | SELECT | shape with Rule + Rule bg | KEEP (covers include.test:552) |
| 116 | ... > an outline matched by name keeps all of its Examples blocks | SELECT | both Examples kept | KEEP |
| 126 | ... > matches on the trimmed name, and trims the attribute value | SELECT | trim both sides | KEEP |
| 132 | ... > is case-sensitive and exact: notFound with every name | SELECT | 3 near-miss names give notFound + names | KEEP (include.test:405 pins the message mapping only) |
| 143 | ... > a name used twice is ambiguous with both lines | SELECT | ambiguous + lines | KEEP |
| 163 | ... > a document with no Feature finds nothing | SELECT | notFound/noTagMatch on empty doc | KEEP |
| 171 | by tags > a Feature tag is inherited by every pickle | SELECT | feature tag selects all | KEEP |
| 177 | ... > a Rule tag selects every scenario of that Rule, with its Background | SELECT | rule tag inheritance; `@` optional | KEEP (covers include.test:566) |
| 188 | ... > a tag on one Examples block keeps the outline with that block only | SELECT | exact shape for `@edge` | KEEP (covers select:251; dup of include.test:557 kept there as mutation check 8) |
| 197 | ... > any-of: scenarios matching either tag are kept | SELECT | any-of shape + lines | KEEP |
| 211 | ... > is case-sensitive: @Smoke does not match @smoke | SELECT | noTagMatch exact result | KEEP |
| 220 | ... > an empty tag list matches nothing | SELECT | `[]` gives noTagMatch | KEEP |
| 224 | ... > a tagged outline whose Examples have no rows ... reported on the miss | SELECT | emptyOutlines ref; still selectable by name | KEEP |
| 245 | ... > an outline with no Examples block ... selectable by tag | SELECT | bare outline selectable | KEEP |
| 251 | ... > a Rule left with only its Background is dropped | SELECT | JSON has no `Rule bg` for `@edge` | **RETIRE**: select.test:188 asserts the exact `toEqual` shape for the same `{tags:['@edge']}` call, which would contain `Rule: Refunds` / `Background: Rule bg` if the branch broke. Both guard `select.mjs:163` |
| 258 | combinations > scenario and tags together are a conflict | SELECT | conflict | KEEP (the stage refuses earlier at gherkin-fence.ts:505, so this is the only pin of select's own check) |
| 265 | ... > no selection returns the input document and lists every scenario | SELECT | identity + full list | KEEP |
| 278 | ... > summary counts follow the PRUNED AST | SELECT+VIEW | featureView counts of pruned docs | KEEP |
| 293 | ... > never mutates the input document | SELECT | structuredClone equality | KEEP |

## 3. gherkin-view.test.ts (VIEW, plus RENDER options): view-level unit, KEEP by mandate (one golden duplicate)

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 86 | featureView > reads the Feature header: trimmed keyword/name, title, narrative, collapsed description | VIEW | header fields; description blank-run collapse | KEEP (covers render.test:383) |
| 101 | ... > sorts and de-duplicates tags by code unit | VIEW | `tagNames` on Feature tags | KEEP |
| 105 | ... > displayTags drops only @dk:*; hasMetadataTag finds one at any level | VIEW | filter + deep detection | KEEP |
| 116 | ... > never carries `#` comments | VIEW | no comment/language in JSON | KEEP |
| 122 | ... > lists Backgrounds, scenarios and Rules in document order, with lines | VIEW | children order/lines/rule tags | KEEP |
| 131 | ... > counts rules, scenarios and Examples body rows | VIEW | counts + summaryText plural/singular/empty | KEEP |
| 138 | ... > segments placeholders only in an outline | VIEW | segments + examples view | KEEP |
| 172 | ... > segments a double-quoted argument ... | VIEW | argument segmentation (escapes, empty, nested placeholder) | KEEP |
| 205 | ... > carries data-table cell values and doc strings with a shared code language | VIEW | dataTable rows; docString language | KEEP |
| 234 | ... > falls back to the keyword as written for an unnamed Feature | VIEW | `featureTitle` fallback | KEEP |
| 239 | ... > returns null for a document without a Feature | VIEW | null | KEEP |
| 243 | ... > flags synthetic levels | VIEW | synthetic only on Feature / first scenario | KEEP |
| 254 | ... > titleOf | VIEW | `Keyword: name` / bare keyword | KEEP |
| 264 | resolveLevels > baseLevel %i, header %s (6 rows) | VIEW | level plan table | KEEP |
| 275 | ... > a synthetic Feature has no header | VIEW | synthetic forces header none | KEEP |
| 279 | ... > capLevel/childLevel cap at 6 and floor at 1 | VIEW | cap/floor | KEEP |
| 300 | renderFeatureBody options > defaults: Feature `#`, sections `##`, Rule children `###`, narrative and summary | RENDER | exact default body | **RETIRE**: the byte-goldens at render.test:322 (`scenarios-before-rule`: `##` scenario then `##` Rule with `###` children and summary; `rule-background`: `###` Background in a Rule; `book-consignment`: narrative) go red on the same break. Both guard `render.mjs:530` (`childLevel(levels.section)`) and the header block at render.mjs:507-522. The file header itself says default output is proven by the goldens |
| 326 | ... > baseLevel shifts every heading; header `title` drops narrative and summary | RENDER | agent-Markdown option | KEEP (only pin of RENDER `baseLevel`/`title`) |
| 339 | ... > header `none` ...; levels cap at 6 | RENDER | none + cap | KEEP |
| 353 | ... > synthetic levels render no heading | RENDER | synthetic body | KEEP |
| 360 | ... > `embed` lays tags out as the HTML does | RENDER | embed layout vs page layout | KEEP |
| 413 | ... > `inContainer` renders every heading as a bold line | RENDER | bold-line headings | KEEP |
| 424 | ... > renders a quoted argument as a code span, whatever backticks it holds | RENDER | codeSpan fence length | KEEP |
| 429 | ... > renders a quoted argument in a data-table or Examples cell as a code span | RENDER | cell code spans + `\|` handling | KEEP |
| 455 | ... > a prebuilt `view` is rendered as given | RENDER | `opts.view` honoured | KEEP |
| 461 | ... > warnDuplicates cites lines shifted by lineOffset, per sibling group | RENDER | offset warnings + via renderFeatureBody | KEEP (covers render.test:412) |

## 4. gherkin-mdast.test.ts (MDAST): the in-page emitter's unit pin, KEEP

The owning layer for the dkGherkin subtree shape. Fence and include tests re-check parts of it through the
plugin, but each of those also guards plugin wiring (see §5 and §6), so nothing here is retired.

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 66 | featureMdast > a full feature: header, tags without @dk:*, narrative breaks, description, summary; no comments | MDAST | full sketch incl. `inlineCode "\"NLRTM → GBFXT\""` | KEEP (covers include.test:619) |
| 141 | ... > the narrative is Markdown | MDAST | narrative inline code parsed; bare emit literal | KEEP |
| 175 | ... > a Rule with a Background: levels | MDAST | Rule +1, children +2 | KEEP (covers include.test:552 levels) |
| 215 | ... > Rule tags render after the Rule heading | MDAST | tag paragraph order | KEEP |
| 230 | ... > an outline with tagged Examples | MDAST | placeholders, label, tags, desc, table | KEEP |
| 295 | ... > a data table: GFM table inside the step item | MDAST | nested table, `\n` break, align | KEEP |
| 323 | ... > doc strings: `code` nodes marked as doc strings | MDAST | lang + DOCSTRING_MARK | KEEP |
| 354 | ... > a synthetic Feature and Scenario render no heading | MDAST | no headings | KEEP (fence.test:402 pins the stage passing `synthetic`) |
| 372 | ... > a synthetic Feature alone: no header, scenarios at base level | MDAST | levels + no summary | KEEP |
| 380 | ... > container mode: p[role=heading] carrying its level; no mdast heading remains | MDAST | no `heading` nodes + hName p | KEEP (391 does not assert "no heading remains") |
| 391 | ... > baseLevel %i: Feature, Rule, scenario-in-Rule levels (3 rows) | MDAST | depths and ariaLevels | KEEP |
| 407 | ... > header `none` drops title, tags, narrative ...; `title` keeps only the title | MDAST | header gating at mdast.mjs:387 | KEEP |
| 424 | ... > a tags paragraph holding only @dk:* tags is omitted | MDAST | empty tags paragraph dropped | KEEP |
| 430 | ... > without parseMarkdown a description is one literal paragraph | MDAST | fallback | KEEP |
| 445 | source line > whole file: `Source: <path>`, linked when href is given | MDAST | sourceParagraph | KEEP |
| 459 | ... > selection: `From <Feature title>, <path>` | MDAST | selected lead text | KEEP |
| 470 | ... > no source option, no source line | MDAST | absent | KEEP |
| 475 | ... > never presets a heading id | MDAST | no `id` | KEEP |
| 498 | through mdast-util-to-hast > becomes div.dk-gherkin > h2, ul... | MDAST to hast | element/class set | KEEP |
| 540 | ... > container mode becomes p[role=heading][aria-level] | MDAST to hast | p + ariaLevel | KEEP |

## 5. gherkin-fence.test.ts (STAGE-A, SINK): fence emitter smoke + stage rules

Everything here runs Astro's real Markdown chain in-process (no build). FEATURE_FENCE is rendered 4 times for
4 separate assertions (265, 274, 321, 367).

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 241 | preset off > registers no fence stage when absent or `fences: false` | HOOK | integration name list pinned | KEEP |
| 247 | ... > absent and `fences: false` render the same HTML: a plain code block | STAGE-A | byte-identical HTML, 1 EC block | KEEP |
| 265 | preset on > replaces the fence with div.dk-gherkin, which has NO pre ancestor | STAGE-A | **fence smoke**: one block, no `pre` / EC ancestor | KEEP (the fence smoke) |
| 274 | ... > holds h2/h3 headings, ul > li > strong.dk-gherkin__kw steps and a table | STAGE-A | classes and keywords survive the real rehype chain | **MERGE into 265** (same input; unique: hProperties survive Astro's rehype) |
| 290 | ... > renders the example site's init.feature, pasted into a fence | STAGE-A | real file, comments dropped, 19 steps verbatim | KEEP (real-file regression for #120) |
| 321 | ... > renders exactly one Expressive Code block per doc string | STAGE-A | 2 EC frames, straight quotes | **MERGE into 265** (same input; unique: doc strings go through Expressive Code) |
| 331 | ... > keeps a quoted step argument verbatim in <code> while smartypants still runs | STAGE-A | stage's `smarten` pass | KEEP (only pin of gherkin-fence.ts:592) |
| 343 | ... > keeps a quoted argument in a data-table or Examples cell verbatim | STAGE-A | cell code + smartypants | KEEP |
| 367 | ... > puts the embedded headings in the TOC | STAGE-A | `metadata.headings` | **MERGE into 265** (same input; unique: TOC) |
| 377 | ... > gives two identical fences slugger-unique heading ids | STAGE-A | slug uniqueness, ids in HTML | KEEP |
| 388 | ... > outlines under the nearest preceding root heading (B = d+1, capped) | STAGE-A | collectBlocks baseLevel for fences | KEEP (include.test:600 pins includeBlock's own use of baseLevel) |
| 402 | ... > renders a steps-only fragment with no synthetic headings | STAGE-A | fenceBlock passes `synthetic` (line 440); TOC | KEEP |
| 410 | ... > leaves an empty or comment-only fence a code block | STAGE-A | `!view → null` (line 441) | KEEP |
| 426 | a fence inside a container > inside %s emits p[role=heading] (3 rows) | STAGE-A | inContainer for list/quote/aside | KEEP |
| 451 | leaves alone > a `raw` fence stays a code block | STAGE-A | RAW_META | KEEP (a11y spec also checks raw, but in Playwright) |
| 459 | ... > a generated feature page is unchanged (fence AND include) | STAGE-A | generated guard at gherkin-fence.ts:567 for fences and directives | KEEP (covers include.test:659) |
| 486 | ... > a deck page is unchanged (fences on a slide stay code) | STAGE-A | `fences: !deck` at gherkin-fence.ts:567 | KEEP (covers include.test:652) |
| 552 | errors > throws ONE error naming every broken fence at <page>:<abs line>:<col> | STAGE-A | collect-all + bodyLineOffset + column offset | KEEP (covers include.test:485 collect-all) |
| 565 | ... > records the page in the error sink before throwing, and clears it on a clean render | STAGE-A+SINK | recordFatal before throw (line 606) / clear (line 573) | KEEP (covers include.test:485 sink part) |
| 580 | ... > warns once per block about @dk:* metadata tags, at the fence line | STAGE-A | fence warning wiring (line 458) | KEEP |
| 594 | ... > a fence that holds only %s is fatal (3 rows) | STAGE-A | empty-render guard (line 447) | KEEP |
| 609 | ... > warns when steps follow a real Feature: line with no Scenario: | STAGE-A | descriptionStepLine (line 452) | KEEP (only pin of `descriptionStepLine`) |
| 640 | ... > does not warn on a valid feature whose description opens with a step keyword | STAGE-A | no false positive (nl + en) | KEEP |
| 657 | ... > warns about duplicate scenario names at their page lines (fragments included) | STAGE-A | `lineOffset: line - lineShift` (line 460) | KEEP |
| 678 | without Astro > names the page `<page>` when the file has no path | STAGE-u | displayPath fallback | KEEP |
| 693 | error sink > lists pages in path order | SINK | ordering | KEEP |
| 702 | ... > a later render of a page replaces its record; empty clears | SINK | replace/clear | KEEP |
| 710 | ... > drain empties it; reset empties it | SINK | drain/reset | KEEP |
| 719 | ... > is ONE sink per process (globalThis) | SINK | global symbol | KEEP |
| 726 | ... > formats one aggregate | SINK | formatFatal text | KEEP |

## 6. gherkin-include.test.ts (RESOLVE, STAGE-u, STAGE-site)

The resolver unit tests own reason classification and the many input variants. The 03 §5 table owns the
reason-to-message mapping (`resolveFailureMessage`, gherkin-fence.ts:331). Where a unit test uses the same
single input as a §5 row and asserts nothing extra, the §5 row is a strict superset (it fails if the reason
is wrong *or* the message is wrong), so the unit row is retired. Unit rows with extra variants or boundary
cases stay.

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 130 | resolveInclude: syntax > reads a file inside a root: relPath, absPath, bytes | RESOLVE | ok result fields | **RETIRE**: include.test:521 (`Source: features/shipping.feature`, the relPath, plus the rendered bytes) and include.test:712 (absPath-based source link) go red. Both guard `include.mjs:205`. Medium confidence: a very cheap test, retire only for tidiness |
| 139 | ... > refuses %s (not a .feature file) before touching the filesystem (4 rows) | RESOLVE | notFeature for .txt, dotfile, no ext, `.Feature` | KEEP (4 variants; §5 row 365 has one) |
| 149 | ... > refuses %s before touching the filesystem (8 rows) | RESOLVE | invalid: empty/abs/drive/URL/backslash/NUL | KEEP (variants; §5 row 345 has one) |
| 162 | ... > refuses `../` traversal even when the target exists | RESOLVE | 3 traversal forms give outside | KEEP (variants; §5 row 339 has one) |
| 169 | ... > checks the prefix at a separator boundary | RESOLVE | features-old is not inside features | KEEP (only pin of include-path.mjs:243) |
| 184 | ... > a missing file is notFound inside a root and outside beyond every root | RESOLVE | notFound; outside/nope gives outside (no oracle) | KEEP (2nd assertion is unique; 1st duplicates §5 row 333) |
| 196 | ... > a file over MAX_INCLUDE_BYTES is tooLarge; one at the limit is read | RESOLVE | boundary | KEEP (at-limit boundary unique) |
| 211 | ... > a directory is notFile | RESOLVE | notFile | **RETIRE**: include.test:372 (same fixture `features/folder.feature`, asserts `— not a file`). Both guard `include.mjs:197` |
| 218 | ... > a missing include root is rootMissing for a target under it | RESOLVE | rootMissing + includeRoot | **RETIRE**: include.test:378 first assertion (same `specs/a.feature`, roots `['features','specs']`, message names `specs`). Both guard `include.mjs:177` |
| 226 | ... > a missing include root is skipped for a target outside it | RESOLVE | stale root skipped | **RETIRE**: include.test:378 second assertion (roots `['specs','features']`, shipping include renders). Both guard the `continue` at `include.mjs:178`. Its notFound/outside sub-asserts are the same branches as :184 |
| 245 | symlinks > refuses a symlink inside a root that points outside it | RESOLVE | realpath containment | KEEP |
| 253 | ... > refuses a symlinked directory inside a root that points outside it | RESOLVE | dir link | KEEP |
| 261 | ... > a dangling symlink out of a root is outside (no existence oracle) | RESOLVE | wouldBeRealPath | KEEP |
| 279 | ... > accepts a symlink that stays inside a root, and names the file as written | RESOLVE | relPath as written | KEEP |
| 304 | memo > re-reads an edited file once its mtime moves | RESOLVE | memo invalidation | KEEP |
| 314 | ... > serves the memo while (mtime, size) are unchanged | RESOLVE | memo hit | KEEP |
| 327 | §5 > `src` missing or empty | STAGE-u | `needs src` | KEEP |
| 333 | ... > `src` not found | STAGE-u | message | KEEP (message mapping) |
| 339 | ... > `src` outside includeRoots (../ traversal) | STAGE-u | message lists roots | KEEP |
| 345 | ... > `src` not a relative POSIX path | STAGE-u | message | KEEP |
| 352 | ... > `src` over the include size limit | STAGE-u | `larger than 1 MiB` | KEEP (message; unit 196 owns the boundary) |
| 365 | ... > `src` not a .feature file: refused before it is read | STAGE-u | message, no content leak | KEEP |
| 372 | ... > `src` a directory | STAGE-u | `not a file` | KEEP (covers 211) |
| 378 | ... > a configured include root that does not exist | STAGE-u | rootMissing message + stale root skipped | KEEP (covers 218, 226) |
| 387 | ... > no includeRoots configured | STAGE-u | gherkin-fence.ts:509 | KEEP |
| 393 | ... > the included file fails to parse: its own path, line and column | STAGE-u | parse problem re-reported | KEEP |
| 399 | ... > the included file has no Feature | STAGE-u | `has no Feature` (line 530) | KEEP |
| 405 | ... > `scenario` matches nothing (05 mutation check 7) | STAGE-u | notFound message | KEEP |
| 412 | ... > `scenario` matches several | STAGE-u | ambiguous message | KEEP |
| 418 | ... > `tags` matches nothing | STAGE-u | noTagMatch message; `tags` split; empty | KEEP |
| 427 | ... > `tags` matches only a rowless outline: the hint | STAGE-u | emptyOutlines hint | KEEP |
| 434 | ... > `tags` with %s is a tag expression (5 rows) | STAGE-u | isTagExpression | KEEP |
| 446 | ... > `tags` may name a tag that merely contains an operator word | STAGE-u | no false positive | KEEP |
| 452 | ... > `scenario` and `tags` both set | STAGE-u | bothSetMessage (line 505) | KEEP |
| 458 | ... > an unknown attribute names the allowed set | STAGE-u | unknown attrs | KEEP |
| 467 | ... > the container form and an attempted text-form include name the leaf form | STAGE-u | text/container directive | KEEP |
| 479 | ... > a directive on a deck page | STAGE-u | deck fatal (line 496) | KEEP (deck rejection, once) |
| 485 | ... > reports every broken include on the page, in source order, and records them in the sink | STAGE-u | collect-all + sink, mixed with a good fence | **RETIRE** (medium): fence.test:552 (two errors, source order) and fence.test:565 (recordFatal before throw). One loop serves fences and directives (gherkin-fence.ts:583-607), so no include-specific branch is left. Breaks: `continue`→`break` at line 590; delete line 606 |
| 509 | ... > a `::gherkin` inside a code fence is text | STAGE-u | not expanded | KEEP |
| 521 | include rendering > a whole file: full header and `Source: <path>` | STAGE-u | **include smoke**: replaced in place, headings, header, source | KEEP (the include smoke; covers 130) |
| 544 | ... > `scenario`: no header, the Feature Background kept, `From <title>, <path>` | STAGE-u | header none + selection source line | KEEP |
| 552 | ... > `scenario` inside a Rule keeps the Rule heading and its Background | STAGE-u | heading list | **RETIRE**: select.test:106 (exact pruned shape incl. Rule bg) and mdast.test:175 (Rule/child levels). Breaks: `select.mjs:158` (`if (rc.background) return true;` to `return false;`) reddens select:106 |
| 557 | ... > `tags` keeps only the matching Examples block (05 mutation check 8) | STAGE-u | Examples Large kept, Small gone | KEEP: duplicates select.test:188, but it is the named 05 mutation check 8; retire only if the 05 doc is updated to point at select:188 |
| 566 | ... > `tags` is any-of and follows inheritance | STAGE-u | heading list for `@smoke refunds` | **RETIRE**: select.test:177 (rule-tag inheritance, `@` optional) + select.test:197 (any-of); the stage's split of `tags` is pinned by include.test:418 (`@a or @b`). Break: `select.mjs:111` `const inherited = [...feature.tags];` reddens select:177 |
| 577 | ... > is not recursive: a `gherkin` doc string stays a code block | STAGE-u | DOCSTRING_MARK skip (line 228) | KEEP |
| 586 | ... > links the source path to sourceUrlPrefix + path relative to sourceRoot | STAGE-u | href | **RETIRE**: include.test:712 asserts the same URL built through the real option normalisation (`https://x/blob/features/shipping.feature` with `sourceRoot` = fixture root). Both guard `gherkin-fence.ts:533-538`. Break: line 535 `sourceRoot: path.resolve(root, options.sourceRoot ?? '.')` to `sourceRoot: root` |
| 600 | ... > outlines under the nearest root heading, and in a container uses p[role=heading] | STAGE-u | includeBlock uses `match.baseLevel`/`inContainer` (line 543) | KEEP: coverage in disguise. fence.test:388/426 only prove fenceBlock passes them |
| 619 | ... > keeps a quoted step argument verbatim as inline code | STAGE-u | strong/text/inlineCode/text | **RETIRE**: mdast.test:66 sketch pins the identical node sequence for `Given a sailing "…"`; view.test:172 pins segmentation. Break: `view.mjs:173` `QUOTED_ARGUMENT = /(?!)/g` |
| 631 | ... > drops @dk:* metadata tags silently | STAGE-u | no warning for includes; tags filtered | KEEP (only pin that includes do not warn, line 531) |
| 652 | ... > on a deck page a fence stays code while a directive is fatal | STAGE-u | fence stays code on deck | **RETIRE**: fence.test:486 (deck page: HTML identical to off, 0 blocks). Both guard `gherkin-fence.ts:567` `{ fences: !deck }`. The "directive is fatal" half of the title is :479 |
| 659 | ... > a generated feature page is left alone, directives included | STAGE-u | no container, directive kept | **RETIRE**: fence.test:459 (generated page with an include gives 0 blocks; authored control gives >0). Both guard the `generated?.by === GENERATED_BY ? [] :` ternary at `gherkin-fence.ts:567` |
| 712 | through defineDocKittyIntegrations > the normalised includeRoots / sourceRoot / sourceUrlPrefix reach the plugin | STAGE-site | option wiring + link | KEEP (covers 586) |
| 722 | ... > `gherkin: true` has no include roots: the directive is fatal | STAGE-site | ADR "true = fences only" end to end | KEEP: covered only as a composite (options.test:24 `true → includeRoots []` + :712 wiring + :387 message), with no single named survivor |
| 726 | ... > a bare `:gherkin` in prose is not an include | STAGE-site | restored literal, no error | KEEP |
| 734 | ... > preset off or `fences: false`: Starlight restores the directive to literal text | STAGE-site | byte-equal restore | KEEP |

## 7. gherkin-fence-build.test.ts (BUILD): **real Astro builds**, slow

9 Astro invocations (157: 2 builds; 176: sync + build; 190: 1; 223: 2; 245: 1; 258: 1), each up to 120 s timeout.

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 157 | malformed fence fails build > exits non-zero and names page:line:col, and again when built unchanged | BUILD | exit code, aggregate, cache never a hit | KEEP (only proof of exit code + loader digest) |
| 176 | ... > exits non-zero when `astro sync` rendered the broken page first | BUILD | sync-then-build | KEEP |
| 190 | ... > passes once the fence is fixed, and the page holds the structured scenario | BUILD | exit 0, no `[dk-gherkin]`, div/h2 id/kw in dist HTML | **MERGE into 258**: put the fixed fence and the fixed include on one guide page and build once. The HTML markers are already pinned in-process by fence.test:265/274/377, and the consumer script (KEEP) asserts two `div.dk-gherkin` from a real build. Saves one build |
| 223 | collection NOT on docKittyDocsLoader > exits non-zero, and again when built unchanged | BUILD | data-store deletion fallback | KEEP |
| 245 | bad include fails build > exits non-zero and names the page, line and the reference | BUILD | include error reaches build:done | KEEP (conservative). Candidate only: the include error enters the same `errors` array/sink as fences (157 + include.test:405). 05 DoD names this case explicitly |
| 258 | ... > passes once the scenario exists; selected scenario, source line, agent payload | BUILD | dist HTML + `/api/pages/*.json` splice + no-include page shape | KEEP (only in-repo proof of the agent payload through Astro's data store) |

## 8. gherkin-render.test.ts (RENDER): generated-page emitter; goldens are its smoke

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 308 | goldens > has the expected fixture set | fixtures | 9 fixture names | KEEP |
| 322 | ... > %s renders byte-for-byte (9 rows) | RENDER | **generated-body smoke**: byte goldens, no warnings | KEEP (covers view.test:300) |
| 330 | ... > the worked example fixture is the plan example body | fixtures | golden shape sanity | KEEP (data check on the expected file) |
| 338 | ... > every golden output ends with exactly one newline and has no double blank line | fixtures | golden file hygiene | KEEP (checks the expected files, not code) |
| 352 | structure > returns "" for a document without a Feature | RENDER | render.mjs:501 | KEEP (view:239 only proves `featureView` null) |
| 356 | ... > summary line: singular forms, zero parts omitted | RENDER+VIEW | `1 example row` singular | KEEP (view:131 never hits the singular "example row") |
| 372 | ... > an unnamed Feature/Scenario falls back to the bare keyword | RENDER | `## Scenario` via render.mjs `titled()` | KEEP: coverage in disguise. render uses its own `titled()` (render.mjs:265), not `titleOf` |
| 378 | ... > scenario tags are de-duplicated and code-unit sorted | RENDER+VIEW | scenario-level tags | KEEP: view:101 only covers Feature tags; this one catches `sectionView` dropping `tagNames` (view.mjs:308) |
| 383 | ... > collapses runs of blank lines in descriptions (MD012) | RENDER | `One.\n\nTwo.` | **RETIRE**: view.test:86 asserts the collapsed Feature description (3 blank lines collapsed to 1). Both guard `view.mjs:380` `rest.replace(/\n{3,}/g, '\n\n')`; render.mjs adds no collapse of its own |
| 389 | ... > a step argument on the last step is followed by one blank line only | RENDER | renderSteps spacing | KEEP |
| 394 | ... > placeholders are inline code only in an outline; elsewhere escaped prose | RENDER | `&lt;b&gt;` escape | KEEP |
| 400 | ... > a Gherkin cell newline becomes <br> | RENDER | `<br>` | KEEP |
| 412 | duplicates > warns on a duplicate sibling scenario, naming both lines | RENDER | exact warning via renderFeatureBody | **RETIRE**: view.test:461 (`viaRender` asserts the identical message through `renderFeatureBody({file, warn})`, line 4 / also 2). Both guard `render.mjs:470` |
| 422 | ... > warns within a Rule, but not for the same name under different Rules | RENDER | per-Rule groups | KEEP (view:461 has no within-Rule duplicate) |
| 441 | ... > defaults: no warn sink is fine | RENDER | default no-op warn on a doc WITH duplicates | KEEP (view:300 had no duplicates) |
| 452 | escapers > escapeInline backslashes ... | RENDER | char classes | KEEP |
| 456 | ... > escapeInline entity-encodes < > & | RENDER | entities | KEEP |
| 461 | ... > escapeInline breaks text directives | RENDER | `:` + autolink breaker | KEEP |
| 467 | ... > escapeInline leaves pipes, quotes and plain punctuation alone | RENDER | no over-escape | KEEP |
| 471 | ... > escapeCell also escapes pipes | RENDER | cell | KEEP |
| 476 | ... > escapeHeading ... | RENDER | heading markers | KEEP |
| 489 | ... > fenceFor is max(3, longest backtick run + 1) | RENDER | fence length | KEEP |
| 506 | round-trip (markua off/on) > %s (9 goldens x 2) | RENDER + remark stack | source text survives build remark stack | KEEP |
| 513 | ... > golden outputs contain no link nodes at all | RENDER | no links | KEEP |
| 524 | ... > the round-trip check is not vacuous | test oracle | oracle catches a bad render | KEEP |
| 589 | property > %s markua: 500 random strings survive render → parse | RENDER | property | KEEP |
| 622 | markdownlint > reports 0 issues | lint (spawn) | goldens lint clean | KEEP |
| 656 | autolinks > %j: no link node, text content round-trips (7 rows) | RENDER | autolink neutralised in 3 contexts x 2 stacks | KEEP |
| 680 | ... > a rendered step with a URL, a www host and an email produces no link node | RENDER | end-to-end autolink | KEEP |

## 9. gherkin-scenario-anchors.test.ts (MDPROC: Astro markdown processor in-process, not a build)

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 164 | anchors > the pipeline really does rewrite these headings (non-vacuity) | MDPROC | `{`→`${`, smart quotes, ellipsis | KEEP |
| 173 | ... > a lone scenario named %j resolves to its heading id (20 rows, 20 processor runs) | MDPROC | anchor = slug | KEEP (conservative: 185 covers every name in one feature, but a positional fallback in `scenarioRecords` could pass 185 and still mis-key a lone heading. Candidate for trimming to a few rows if runtime matters) |
| 185 | ... > every scenario outside a rule resolves to its own heading id | MDPROC | positional oracle; duplicate-ish pairs | KEEP |
| 193 | ... > every scenario inside a rule resolves to its own heading id | MDPROC | rule depth | KEEP |
| 225 | generated pages skipped > renders the same HTML and headings with the stage on, and its anchors resolve | MDPROC + STAGE | on==off for a `renderFeatureBody` page with a gherkin doc string; `scenarioRecords` | KEEP (the anchor-resolution part is unique; the skip part overlaps fence.test:459) |
| 241 | ... > non-vacuity: WITHOUT the generated stamp the same body does grow a nested block | MDPROC + STAGE | stage active in this harness | KEEP (non-vacuity of 225's own harness) |

## 10. gherkin-load.test.ts (LOAD)

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 44 | discovery > orders by source index, then code-unit order | LOAD | ordering | KEEP |
| 55 | ... > reports absolute paths, the absolute source dir, and raw bytes | LOAD | fields | KEEP |
| 66 | ... > computes the full lowercase hex sha256 | LOAD | hash | KEEP |
| 75 | ... > skips dot-directories, node_modules and non-.feature files | LOAD | walker filter | KEEP |
| 91 | ... > throws for a missing source directory | LOAD | message (load.mjs:195) | KEEP (covers integration:267, CLI message part) |
| 97 | ... > treats a source that is a file as missing | LOAD | isDirectory check | KEEP |
| 105 | parsing > produces identical documents (and ids) across two loads | LOAD | determinism | KEEP |
| 111 | ... > uses a fresh incrementing id generator per file | LOAD | ids per file | KEEP |
| 128 | ... > honours "# language: nl" | LOAD | i18n | KEEP |
| 144 | ... > warns about and skips documents without a Feature | LOAD | skip + warning | KEEP |
| 158 | ... > does not require a warn callback | LOAD | default warn | KEEP |
| 164 | syntax errors > reports every error in every file in ONE thrown error | LOAD | aggregate file:line:col | KEEP (covers CLI:268 message, integration:250 message) |
| 174 | ... > drops the parser's own (line:col) prefix | LOAD | no double prefix | KEEP |
| 179 | ... > reports an unknown # language as a located error | LOAD | language error | KEEP |
| 216 | walker order > symlinked dir and target de-duplicate to the SAME path in either order | LOAD | readdir-order independence | KEEP |
| 227 | log prefix > load.mjs still exports GHERKIN_LOG_PREFIX | LOAD | export | KEEP |

## 11. gherkin-feature-core.test.ts (CORE)

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 138 | §2 tags > $row (17 rows) | CORE | one row per contract tag row | KEEP |
| 144 | ... > persona without a narrative gets the fixed guidance text | CORE | DEFAULT_GUIDANCE_TEXT | KEEP |
| 149 | ... > unknown @dk: key warns with file:line:col and a did-you-mean | CORE | warning | KEEP |
| 158 | ... > splits on the FIRST "=" | CORE | value parsing | KEEP |
| 163 | ... > multiple @dk:context warns and the first wins | CORE | first wins | KEEP |
| 170 | ... > invalid %s warns and is ignored (7 rows) | CORE | validation | KEEP |
| 187 | ... > accepts priority bounds 0 and 1 | CORE | bounds | KEEP |
| 192 | ... > %s without a value warns (3 rows) | CORE | empty value | KEEP |
| 199 | ... > never throws on junk input | CORE | robustness | KEEP |
| 206 | status precedence > %j → %s (11 rows) | CORE | precedence + fail-closed | KEEP |
| 226 | ... > @wip / @deprecated are consumed, not page tags | CORE | consumed tags | KEEP |
| 236 | extractNarrative > joins with ", " ... | CORE | narrative join | KEEP |
| 245 | ... > does not double a trailing period | CORE | period | KEEP |
| 249 | ... > is undefined without a narrative | CORE | undefined | KEEP |
| 256 | deriveDescription > drops the narrative and takes the first sentence | CORE | rule 1-4 | KEEP |
| 261 | ... > a "." not followed by whitespace does not end the sentence | CORE | sentence split | KEEP |
| 267 | ... > no terminator → the whole collapsed text | CORE | collapse | KEEP |
| 271 | ... > rule 5: narrative-only description | CORE | rule 5 | KEEP |
| 283 | ... > rule 6: empty description → fallback + warning (3 rows) | CORE | rule 6 | KEEP |
| 290 | ... > exactly 180 chars is kept verbatim | CORE | boundary | KEEP |
| 296 | ... > 181 chars is cut at the word boundary | CORE | boundary | KEEP |
| 306 | ... > cuts at the LAST boundary ≤179 | CORE | truncate | KEEP |
| 311 | ... > a single 200-char word is hard-cut | CORE | hard cut | KEEP |
| 318 | ... > a hard cut never splits a surrogate pair | CORE | surrogate | KEEP |
| 323 | ... > truncates the rule-5 narrative too | CORE | truncate narrative | KEEP |
| 338 | resolveAdrRef > resolves a zero-padded number | CORE | hit | KEEP |
| 344 | ... > miss → adr/<NNNN> unchanged | CORE | miss | KEEP |
| 349 | ... > non-numeric input → adr/<input> | CORE | passthrough | KEEP |
| 354 | ... > several matches → the code-unit-first file | CORE | tie-break | KEEP |
| 360 | missionPrefix > reads plans/missions from the real example registry | CORE | registry | KEEP |
| 367 | ... > none (%j) → plans + warning (4 rows) | CORE | fallback | KEEP |
| 373 | ... > missing prefix warning surfaces only when a feature uses @dk:mission | CORE | gated warning | KEEP |
| 462 | worked example > the inline fixture is the example source, byte-for-byte | test data | inline copy hash = aa67f517f6ea | **RETIRE with 467** (it only validates the inline copy used by 467) |
| 467 | ... > parsed with @cucumber/gherkin, serialises to the expected frontmatter exactly | CORE | worked-example frontmatter golden | **RETIRE**: generate.test:210 byte-compares `expected/behaviour/shipping/book-consignment.md`, whose frontmatter is *identical* to `EXPECTED_FRONTMATTER` (verified: same source sha256 `aa67f517f6ea…`, same docsRoot `example/docs`, warnings `[]`). Both guard `feature-core.mjs` `buildFrontmatter`/`serializeFrontmatter` (669-700). Drops ~75 lines of inline fixture |
| 489 | ... > a fully-populated page keeps the fixed §3 key order | CORE | key order incl. updated/autolink/agent | KEEP (golden lacks those keys) |
| 522 | serializeHubFrontmatter > matches the example shipping hub frontmatter exactly | CORE | hub frontmatter | **RETIRE**: generate.test:210 byte-compares `expected/behaviour/README.md` and `shipping/README.md` (same `at: "sha256:a42315ed7700"`), and generate.test:493 asserts `kind: Hub` / `doc_status: active` / `generated` shape on 3 hubs. Both guard `feature-core.mjs:712-723` |
| 566 | import-scan > %s (10 rows) | static | purity allow-lists | KEEP |
| 597 | @dk:status validation > %s is rejected ... treated as a draft (10 rows) | CORE | fail-closed status | KEEP |
| 606 | ... > rejected only for its case suggests lower-case (3 rows) | CORE | did-you-mean | KEEP |
| 618 | ... > (not just a case problem) gets no suggestion (5 rows) | CORE | no suggestion | KEEP |
| 627 | ... > (well-formed) passes through (4 rows) | CORE | custom status | KEEP |
| 633 | ... > serializeFrontmatter quotes a non-slug doc_status (10 rows) | CORE | YAML round-trip | KEEP |
| 641 | ... > a slug-shaped doc_status stays bare | CORE | bare slug | KEEP |
| 648 | unnamed Feature > title and description fall back to the trimmed keyword, with a warning | CORE | fallback | KEEP (generate.test:1010 is the end-to-end twin: different layer, also checks hub link) |
| 663 | ... > defaults to "Feature" when no keyword is supplied | CORE | default | KEEP |

## 12. gherkin-generate.test.ts (GEN): generated-page emitter (owner of planning, ownership, pruning, diff)

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 210 | golden > generates exactly the 3 expected files, byte-identical | LOAD+GEN | **generate smoke**: 3 files byte-identical, result, no warnings | KEEP (covers feature-core:467, :522) |
| 239 | pruning > renaming a source removes the old page, writes the new one, updates hubs, prunes empty dirs | GEN | rename/prune | KEEP |
| 301 | ... > empty sources with generated pages: stops with an actionable error and removes nothing | GEN | FR-002 message, untouched | KEEP |
| 324 | ... > empty sources with allowEmpty: owned leftovers are removed, one warning | GEN | allowEmpty | KEEP |
| 339 | ... > one empty source among several is not an empty source set | GEN | C-004 | KEEP |
| 353 | ... > empty sources with no prior output: one warning, nothing created | GEN | no-op | KEEP |
| 361 | ... > a directory holding only a dotfile is kept when its pages are pruned | GEN | dotfile dir kept | KEEP |
| 388 | ownership > %s → throws naming it; NOTHING is written or deleted (5 rows) | GEN | authored refusal (generate.mjs:536) | KEEP (covers CLI:128, integration:298) |
| 411 | ... > an authored page at the hub route raises only the authored-file error | GEN | single error | KEEP |
| 424 | ... > names EVERY authored file, in code-unit order | GEN | ordering | KEEP |
| 432 | ... > an authored file blocks even the empty-sources cleanup | GEN | check order | KEEP |
| 442 | ... > scanOutputDir: owned by generated.by only; dotfiles ignored | GEN | scan | KEEP |
| 459 | hub basename > hubBasename | GEN | basename choice | KEEP |
| 469 | ... > index.md hubs when indexBasename is ['index','README'] | GEN | index hubs | KEEP |
| 479 | ... > switching the basename replaces the old hubs | GEN | owned hubs pruned | KEEP |
| 493 | nested > a/b/c.feature → hubs at root, a/ and a/b/ | GEN | hub tree + hub frontmatter | KEEP (covers feature-core:522 with 210) |
| 511 | ... > a directory hub lists both feature pages and sub-directory hubs, sorted | GEN | sort | KEEP |
| 525 | ... > a draft feature is generated but never listed in its hub | GEN | draft gating | KEEP |
| 540 | ... > hub generated.at changes when a child is added, not on content change | GEN | hub hash | KEEP |
| 570 | collisions > two sources with the same relative path | GEN | collision | KEEP |
| 583 | ... > two names in ONE source that slug to the same path | GEN | slug collision | KEEP |
| 595 | ... > two DIRECTORY names that slug alike merge | GEN | dir slug collision | KEEP |
| 608 | ... > a feature named like an index basename collides with the hub (4 rows) | GEN | index collision | KEEP |
| 627 | ... > index.feature is rejected even when index is NOT a configured basename | GEN | reserved name | KEEP |
| 640 | ... > a path segment with no slug-able characters is fatal | GEN | slug | KEEP |
| 651 | sources[0].resource > defaults to the path relative to sourceRoot | GEN | resource | KEEP |
| 659 | ... > a different sourceRoot changes the relative path | GEN | sourceRoot | KEEP |
| 665 | ... > sourceUrlPrefix is prepended verbatim | GEN | prefix | KEEP (integration:386 pins config wiring, separate seam) |
| 680 | @dk:mission prefix > example/docs registry → plans/missions/x | GEN | registry | KEEP |
| 687 | ... > a docs root without a registry → plans/x plus a warning | GEN | fallback | KEEP |
| 695 | ... > no @dk:mission tag → no registry warning | GEN | gating | KEEP |
| 702 | diffFeaturePages > clean / changed / stale / added / authored | GEN | all 4 drift kinds | KEEP (owner of classification; covers CLI:222, :233) |
| 735 | ... > a missing output dir → every planned page is added | GEN | missing dir | KEEP |
| 747 | section label > the registry label titles the root hub | GEN | label | KEEP |
| 765 | ... > without a registry entry the section id is humanised; custom id honoured | GEN | humanise | KEEP |
| 772 | ... > the collision message uses the configured section id | GEN | message | KEEP |
| 806 | review #1 > @dk:status=%s: regenerating twice succeeds (7 rows) | GEN+CORE | no lockout | KEEP |
| 820 | ... > planFeaturePages re-parses every planned page and throws an internal error | GEN | self-check | KEEP |
| 841 | review #2 > a feature page and a directory hub on the same route (3 rows) | GEN | route collision | KEEP |
| 860 | ... > a leaf that slugs to `log` is reserved (3 rows) | GEN | log reserved | KEEP |
| 869 | ... > a DIRECTORY named log is fine | GEN | not over-reserved | KEEP |
| 895 | review #4 > charter-only docs root drives mission prefix and hub title | GEN | charter registry | KEEP |
| 910 | review #7 > a directory named %j renders as literal text (4 rows) | GEN | hub escaping | KEEP |
| 935 | ... > a Feature with no description: its name renders as literal text | GEN | hub escaping | KEEP |
| 955 | ... > the hub H1 is heading-escaped | GEN | escapeHeading in hub | KEEP |
| 962 | ... > nested directory titles use the sidebar rule | GEN | humanise parity | KEEP |
| 972 | review #8 > a symlinked .md is classified authored → fatal before any write | GEN | symlink file | KEEP |
| 986 | ... > a symlinked directory is authored too | GEN | symlink dir | KEEP |
| 997 | symlinked section root > fatal before any write | GEN | symlink root | KEEP |
| 1010 | review #5 > unnamed Feature: H1, title and hub entry agree, warns once | GEN | end-to-end fallback | KEEP |
| 1051 | final review #2 > a draft-only directory gets no hub and no link | GEN + lint | draft-only dirs | KEEP |
| 1080 | ... > publishing a draft adds the hub; deleting the drafts prunes | GEN | lifecycle | KEEP |
| 1104 | ... > a section whose features are ALL drafts gets a root hub with intro only | GEN + lint | all-draft | KEEP |
| 1119 | ... > no generated hub ever ends with a blank line | GEN + lint | trailing newline | KEEP |

## 13. gherkin-check-cli.test.ts (CLI): every case spawns node

The CLI owns argument parsing, the `DRIFT_KINDS` print loop (generate-feature-pages.mjs:254), exit codes
and the catch at line 278. Classification is owned by generate.test:702. Throws are owned by GEN/LOAD.

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 112 | write mode > generates the section and reports a summary | CLI | summary line, index-names line, files, 2nd run no-op | KEEP (CLI write-mode smoke) |
| 128 | ... > refuses to write into a section that holds an authored file | CLI | exit 1 + refusal message | **RETIRE**: generate.test:388 (refusal, nothing written; guards `generate.mjs:536`) + check-cli:147 (a write-mode generator throw gives exit 1 with `[dk-gherkin]` on stderr; guards the catch at generate-feature-pages.mjs:278-283) |
| 147 | empty source set > write mode stops (exit 1); --allow-empty alone removes (exit 0) | CLI | flag parse + exit codes | KEEP |
| 162 | ... > --check is unchanged by the flag: exit 1 listing every page as stale | CLI | `stale:` print, flag ignored in check | KEEP (covers :222) |
| 178 | --check > a clean, freshly generated tree → exit 0 with an "in sync" line | CLI | exit 0 path | KEEP |
| 187 | ... > never generated → exit 1 listing every page as `added`, writes nothing | CLI | `added:` print, read-only | KEEP (covers :233) |
| 202 | ... > a .feature edited without regenerating → exit 1 listing the changed page | CLI | `changed:` print, hint, read-only, re-green | KEEP |
| 222 | ... > a removed .feature leaves its owned page stale | CLI | `stale:` + hub `changed:` | **RETIRE**: check-cli:162 (prints `  stale: …`, exit 1; guards `'stale'` in DRIFT_KINDS at line 69) + generate.test:702 (`stale` classification at `generate.mjs:480`; hub `changed` on a child change is the same `changed.push` at line 478 that :702 / :202 cover) |
| 233 | ... > a new .feature not yet generated → listed as `added` | CLI | `added:` for page + new hub; root hub `changed:` | **RETIRE**: check-cli:187 (prints `  added: …`; guards `'added'` in DRIFT_KINDS) + generate.test:702 (`added` at `generate.mjs:477`); new-dir hub planning is generate.test:493 |
| 248 | ... > an authored file inside the generated section → listed as `authored` | CLI | `authored:` print | KEEP (only pin that `'authored'` stays in DRIFT_KINDS) |
| 260 | ... > a missing source directory → exit 1 with the [dk-gherkin] message | CLI | --check catch path | KEEP (covers :268 catch) |
| 268 | ... > a Gherkin syntax error → exit 1 with the path:line:col message | CLI | same catch, loader parse error | **RETIRE**: check-cli:260 (same `catch` at generate-feature-pages.mjs:278 → exit 1) + gherkin-load.test:164 (message format) |
| 279 | ... > a bad invocation (missing --sources) → exit 1 with a usage message | CLI | parseArgs catch | KEEP (options.test:229 pins the rule; this pins the CLI exit) |
| 287 | --help > %s prints the usage block and exits 0 (2 rows) | CLI | help | KEEP |
| 298 | parity > --section %s is rejected and nothing is written (6 rows) | CLI | CLI uses validator; no escape write | KEEP |
| 309 | ... > --index-basename %s is rejected (4 rows) | CLI | `[dk-config]` index validation | KEEP |
| 324 | ... > --section %s is reserved (2 rows) | CLI | reserved message with `--section` | **RETIRE**: options.test:127 (reserved check, guards `options.mjs:194`) + integration.test:477 (`optionName` renders `--section`) + check-cli:298 (a validator throw gives exit 1, nothing written) |

## 14. gherkin-integration.test.ts (HOOK)

The `doc-kitty:gherkin` hook (config.ts:1301-1323) has no try/catch, so any loader or generator throw
propagates. One propagation test is enough. The option rules are owned by `options.mjs` (options.test).

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 135 | config:setup > generates the section pages under docs/behaviour/** by default | HOOK | default section, frontmatter, default resource | KEEP (hook smoke; covers :369) |
| 153 | ... > honours a custom section and indexBasename | HOOK | wiring | KEEP |
| 169 | ... > calls addWatchFile once per source file, in sorted model order | HOOK | addWatchFile | KEEP |
| 188 | ... > logs one [dk-gherkin] info line with the counts, re-run byte-stable | HOOK | info line format | KEEP |
| 207 | ... > prunes a page whose source was deleted on the next run | HOOK | `1 removed` in the log | KEEP: coverage in disguise. :188 only ever logs `0 removed`, so a hard-coded removed count would pass :188 |
| 227 | ... > tolerates a logger without info | HOOK | `typeof logger.info` guard | KEEP |
| 238 | ... > registers NO markdown plugins and injects NO scripts | HOOK | no updateConfig | KEEP |
| 250 | errors > throws [dk-gherkin] file:line:col for a malformed .feature, before writing | HOOK | throw propagates; nothing written | KEEP (covers :267, :298 propagation) |
| 267 | ... > throws [dk-gherkin] for a missing source directory | HOOK | propagation of loader throw | **RETIRE**: integration:250 (hook propagates a loader throw) + gherkin-load.test:91 (message; guards `load.mjs:195`) |
| 276 | ... > stops on an empty source set; gherkin.allowEmpty: true removes them | HOOK | `allowEmpty` pass-through (config.ts:1314) | KEEP |
| 298 | ... > refuses to write into a section holding authored content | HOOK | propagation of generator throw | **RETIRE**: generate.test:388 (guards `generate.mjs:536`) + integration:250 (propagation) |
| 316 | eager validation > rejects %s (3 rows: sources) | HOOK→OPTS | sources rules | **RETIRE**: options.test:204 has the same 3 rows plus `null` with the same message. Eager wiring stays pinned by :324. Guard: `options.mjs:173-177` |
| 324 | ... > rejects a section that is %s (5 rows) | HOOK→OPTS | section shape | KEEP (the only place the section-shape rows are pinned in vitest; also proves eager wiring) |
| 336 | ... > rejects an allowEmpty that is %s (3 rows) | HOOK→OPTS | allowEmpty type | **RETIRE** (or MERGE its rows into options.test:196): options.test:196 third assertion (`'yes'` gives the same message). Guard: `options.mjs:201` |
| 346 | ... > rejects the reserved section %s (2 rows) | HOOK→OPTS | reserved | **RETIRE**: options.test:127 (guards `options.mjs:194`) + integration:471 (`_meta` present in RESERVED_GHERKIN_SECTIONS) |
| 352 | ... > accepts a valid option without touching the filesystem | HOOK | no fs at define time | KEEP |
| 369 | sourceRoot > defaults to paths relative to the site root | HOOK | default sourceRoot = cwd | **RETIRE** (low value): integration:135 line 148 asserts `features/shipping/x.feature` relative to the site root, which goes red if the default changes. Guard: `config.ts:1312` |
| 375 | ... > reports paths relative to sourceRoot: '..' | HOOK | sourceRoot resolved against cwd | KEEP |
| 386 | ... > prepends sourceUrlPrefix | HOOK | prefix pass-through | KEEP |
| 430 | sidebar > warns about the not-yet-generated folder when gherkin is OFF | HOOK | sidebar | KEEP |
| 438 | ... > treats gherkin: true like OFF | HOOK | sidebar | KEEP |
| 446 | ... > emits the group without warning when gherkin is ON | HOOK | generatedIds | KEEP |
| 465 | single-sourced > config.ts validates through options.mjs | static | import, no copy | KEEP |
| 471 | ... > reserved-section default equals _meta + build-generated sections | OPTS | list | KEEP |
| 477 | ... > validateGherkinPages names the option the caller uses | OPTS | optionName | KEEP |
| 488 | ... > validateIndexBasenames rejects whitespace / Log | OPTS | index names | KEEP |

## 15. gherkin-options.test.ts (OPTS): owner of option rules

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 24 | normalisation table > %s (11 rows) | OPTS | normalised shape | KEEP |
| 105 | ... > copies arrays | OPTS | no aliasing | KEEP |
| 115 | ... > accepts exactly the documented keys | OPTS | key list | KEEP |
| 127 | ... > passes reservedSections through to the pages validator | OPTS | reserved + default list | KEEP (covers integration:346, CLI:324) |
| 139 | rejections > refuses %s as the option value (5 rows) | OPTS | top-level shape | KEEP |
| 151 | ... > refuses unknown keys | OPTS | unknown keys | KEEP |
| 158 | ... > refuses a fences value that is %s (3 rows) | OPTS | fences type | KEEP |
| 168 | ... > refuses includeRoots that is %s (12 rows) | OPTS | includeRoots syntax | KEEP |
| 187 | ... > refuses %s without sources (2 rows) | OPTS | section/allowEmpty need sources | KEEP |
| 196 | ... > carries allowEmpty into pages only when true | OPTS | allowEmpty | KEEP (covers integration:336) |
| 204 | ... > runs the pages rules once sources is present (4 rows) | OPTS | sources rules | KEEP (covers integration:316) |
| 215 | ... > checks the source-link keys %s (2 rows) | OPTS | sourceUrlPrefix/sourceRoot | KEEP |
| 229 | validateGherkinPages > requires sources | OPTS | CLI path | KEEP |
| 235 | ... > ignores the in-page keys | OPTS | key filtering | KEEP |

## 16. gherkin-codegen-guard.test.ts (LOAD+GEN): idempotency owner, KEEP

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 125 | codegen guard > is byte-identical across two runs | GEN | determinism | KEEP |
| 145 | ... > re-running over the SAME dir writes nothing and touches no file | GEN | no-op + mtimes | KEEP (owner; the 2nd-run assertions in check-cli:112 and integration:188 duplicate it but also pin their own summary formatting, so leave them) |
| 159 | ... > emits NO timestamp | GEN | content hash only | KEEP |

## 17. gherkin-example.test.ts (repo config parity), KEEP

| Line | describe > it | Layer | Asserts | Verdict |
|------|---------------|-------|---------|---------|
| 93 | validate:features mirrors > the example config turns the gherkin preset on | config text | example option | KEEP |
| 98 | ... > every flag equals the option | CLI parseArgs vs config | parity | KEEP |
| 122 | ... > every gherkin setting has a CLI flag and every flag a setting | CLI/OPTS | FLAG ↔ keys | KEEP |
| 137 | ... > generate:features is the same command without --check | package.json | scripts parity | KEEP |
| 146 | example features > loading and planning example/features raises no warning | LOAD+GEN | example clean | KEEP (note: the header promises a regeneration-clean diff test that no longer exists here; `pnpm validate:features` covers it in CI) |

---

## Focus-pair notes

- **fence vs include vs mdast vs view.** The view and mdast tests own shape. Fence/include tests stay where they
  prove *plugin wiring*: `synthetic` passed (fence:402), `match.baseLevel` used by includeBlock (include:600),
  smartypants pass (fence:331/343), deck and generated guards (fence:459/486), errors and sink. Retired from
  include: pure shape re-checks (552, 566, 619) and guards proven once at fence level (652, 659, 485).
- **parse/select vs fence/include.** select owns pruning. include keeps one row per *message* (§5 table) plus
  557 (05 mutation check 8). Retired: 552, 566.
- **Rejection paths, include-unit vs stage.** Each reason has one unit row (classification, variants) and one §5 row
  (message). Single-input unit rows that the §5 row strictly covers are retired: notFile 211, rootMissing 218,
  root-skip 226. Kept on both sides where the unit has extra variants or a boundary: traversal, invalid,
  notFeature, tooLarge (at-limit), notFound (no-oracle).
  Decks: fence-on-deck once (fence:486), directive-on-deck once (include:479).
- **render vs generate vs scenario-anchors.** These are three different emitters/consumers. render goldens are
  the body smoke, generate:210 the page+hub smoke, anchors the scenario-index consumer. Retired only the render
  rows that view.test pins at the shared walk (383, 412) and view:300, which the goldens pin.
- **check-cli vs generate --check.** generate:702 owns drift classification. The CLI keeps one test per printed
  drift kind (187 added, 202 changed, 162 stale, 248 authored), exit 0 (178) and one throw path (260).
  Retired: 222, 233, 268, 128, 324.
- **Slow tests.** Only `gherkin-fence-build.test.ts` runs real Astro builds (9 invocations). The proposal
  MERGEs 190 into 258 (−1 build); 245 stays (candidate only). `gherkin-fence.test.ts` (Astro content renderer,
  in-process) and `gherkin-scenario-anchors.test.ts` (createMarkdownProcessor, 26+ renders, 20 of them the
  lone-name `it.each`) are the next heaviest. Merging fence 274/321/367 into 265 saves 3 renders.

---

## (1) Per-file summary

| File | Tests (`it` rows) | KEEP | RETIRE | MERGE | Est. lines saved |
|------|------:|-----:|-------:|------:|-----------------:|
| gherkin-parse.test.ts | 34 | 34 | 0 | 0 | 0 |
| gherkin-select.test.ts | 20 | 19 | 1 | 0 | ~4 |
| gherkin-view.test.ts | 26 | 25 | 1 | 0 | ~25 |
| gherkin-mdast.test.ts | 20 | 20 | 0 | 0 | 0 |
| gherkin-fence.test.ts | 30 | 27 | 0 | 3 (into 265) | ~15 (+3 renders) |
| gherkin-include.test.ts | 55 | 44 | 11 | 0 | ~100 |
| gherkin-fence-build.test.ts | 6 | 5 | 0 | 1 (190 into 258) | ~12 (+1 Astro build) |
| gherkin-render.test.ts | 29 | 27 | 2 | 0 | ~15 |
| gherkin-scenario-anchors.test.ts | 6 | 6 | 0 | 0 | 0 |
| gherkin-load.test.ts | 16 | 16 | 0 | 0 | 0 |
| gherkin-feature-core.test.ts | 45 | 42 | 3 | 0 | ~120 (incl. ~75 lines of inline fixture + expected frontmatter) |
| gherkin-generate.test.ts | 54 | 54 | 0 | 0 | 0 |
| gherkin-check-cli.test.ts | 17 | 12 | 5 | 0 | ~50 (5 node spawns) |
| gherkin-integration.test.ts | 26 | 20 | 6 | 0 | ~45 |
| gherkin-options.test.ts | 14 | 14 | 0 | 0 | 0 |
| gherkin-codegen-guard.test.ts | 3 | 3 | 0 | 0 | 0 |
| gherkin-example.test.ts | 5 | 5 | 0 | 0 | 0 |
| **Total** | **406** | **373** | **29** | **4** | **~390** |

(RETIRE count includes feature-core:462, which exists only to validate 467's inline fixture.)

## (2) RETIRE candidates with planted breaks

Plant each break alone and run the named covering test(s). Each must go **red**. Then revert.
Lines are as of this read.

| # | Retire | Covering test(s) that must go red | Planted break (one line) |
|---|--------|----------------------------------|--------------------------|
| 1 | select.test:251 | select.test:188 | `src/lib/gherkin/select.mjs:163` `return child.rule.children.some((rc) => rc.scenario);` to `return true;` |
| 2 | view.test:300 | render.test:322 (`rule-background`, `scenarios-before-rule`) | `src/lib/gherkin/render.mjs:530` `childLevel(levels.section)` to `levels.section` |
| 3 | render.test:383 | view.test:86 | `src/lib/gherkin/view.mjs:380` `description: rest.replace(/\n{3,}/g, '\n\n'),` to `description: rest,` |
| 4 | render.test:412 | view.test:461 | `src/lib/gherkin/render.mjs:470` `if (first === undefined) {` to `if (true) {` |
| 5 | include.test:130 | include.test:521 | `src/lib/gherkin/include.mjs:205` `relPath: toPosix(path.relative(root, absPath))` to `relPath: toPosix(absPath)` |
| 6 | include.test:211 | include.test:372 | `src/lib/gherkin/include.mjs:197` `if (!stat.isFile()) return …` to `if (false) return …` (the read then throws EISDIR, so the message no longer matches) |
| 7 | include.test:218 | include.test:378 (1st assertion) | `src/lib/gherkin/include.mjs:177` `if (isInside(absPath, lexical)) return { ok: false, reason: 'rootMissing', includeRoot };` to `if (false) return …;` |
| 8 | include.test:226 | include.test:378 (2nd assertion) | `src/lib/gherkin/include.mjs:178` `continue;` to `return { ok: false, reason: 'rootMissing', includeRoot };` |
| 9 | include.test:485 | fence.test:552 | `src/lib/remark/gherkin-fence.ts:590` `continue;` (inside `if ('errors' in result)`) to `break;` |
| 9b | (same, sink half) | fence.test:565 | delete `src/lib/remark/gherkin-fence.ts:606` `recordFatal(page, errors);` |
| 10 | include.test:552 | select.test:106 | `src/lib/gherkin/select.mjs:158` `if (rc.background) return true;` to `if (rc.background) return false;` |
| 11 | include.test:566 | select.test:177 | `src/lib/gherkin/select.mjs:111` `const inherited = [...feature.tags, ...rule.tags];` to `const inherited = [...feature.tags];` |
| 12 | include.test:586 | include.test:712 | `src/lib/remark/gherkin-fence.ts:535` `sourceRoot: path.resolve(root, options.sourceRoot ?? '.'),` to `sourceRoot: root,` |
| 13 | include.test:619 | mdast.test:66, view.test:172 | `src/lib/gherkin/view.mjs:173` `const QUOTED_ARGUMENT = /"(?:[^"\\\n]|\\.)*"/g;` to `const QUOTED_ARGUMENT = /(?!)/g;` |
| 14 | include.test:652 | fence.test:486 | `src/lib/remark/gherkin-fence.ts:567` `collectBlocks(tree, { fences: !deck })` to `collectBlocks(tree, { fences: true })` |
| 15 | include.test:659 | fence.test:459 | `src/lib/remark/gherkin-fence.ts:567` `const blocks = generated?.by === GENERATED_BY ? [] : collectBlocks(…)` to `const blocks = collectBlocks(…)` |
| 16 | feature-core.test:462 + :467 | generate.test:210 | `src/lib/gherkin/feature-core.mjs:673` `` `kind: ${fields.kind ?? 'Specification'}` `` to `` `kind: ${'Spec'}` `` |
| 17 | feature-core.test:522 | generate.test:210, generate.test:493 | `src/lib/gherkin/feature-core.mjs:717` `'kind: Hub',` to `'kind: Index',` |
| 18 | check-cli:128 | generate.test:388 | `src/lib/gherkin/generate.mjs:536` `if (authored.length > 0) {` to `if (false) {` |
| 18b | (CLI half) | check-cli:147 | `src/scripts/generate-feature-pages.mjs:282` `return 1;` (in the last `catch`) to `return 0;` |
| 19 | check-cli:222 | generate.test:702, check-cli:162 | `src/lib/gherkin/generate.mjs:480` `const stale = owned.filter((rel) => !plan.has(rel));` to `const stale = [];` |
| 20 | check-cli:233 | generate.test:702, generate.test:735 | `src/lib/gherkin/generate.mjs:477` `if (!existsSync(abs)) added.push(rel);` to `if (false) added.push(rel);` |
| 20b | (print half of 19/20) | check-cli:162 / check-cli:187 | `src/scripts/generate-feature-pages.mjs:69` drop `'stale'` (or `'added'`) from `DRIFT_KINDS` |
| 21 | check-cli:268 | check-cli:260 | same as 18b (`return 1;` to `return 0;` at generate-feature-pages.mjs:282) |
| 21b | (message half) | gherkin-load.test:164 | `src/lib/gherkin/load.mjs:222` `parseGherkin(bytes, { display })` to `parseGherkin(bytes, { display: 'x' })` (wrong path in the message) |
| 22 | check-cli:324 | options.test:127 | `src/lib/gherkin/options.mjs:194` `if (reservedSections.includes(section)) {` to `if (false) {` |
| 23 | integration:267 | gherkin-load.test:91 | `src/lib/gherkin/load.mjs:195` `if (!isDir) {` to `if (false) {` |
| 24 | integration:298 | generate.test:388 | same as 18 (`generate.mjs:536`) |
| 25 | integration:316 | options.test:204 | `src/lib/gherkin/options.mjs:175` delete `sources.length === 0 \|\|` |
| 26 | integration:336 | options.test:196 | `src/lib/gherkin/options.mjs:201` `typeof allowEmpty !== 'boolean'` to `false` |
| 27 | integration:346 | options.test:127 | same as 22 (`options.mjs:194`) |
| 28 | integration:369 | integration:135 | `src/lib/config.ts:1312` `sourceRoot: path.resolve(root, opts.sourceRoot),` to `sourceRoot: path.resolve(root, opts.sources[0]),` |

**MERGEs (no coverage loss, just fewer renders/builds):** fence.test 274 + 321 + 367 into 265 (one
FEATURE_FENCE render, all assertions). fence-build 190 into 258 (one guide page with the fixed fence *and*
the fixed include, one build, assert both blocks plus the agent payload).

**Conservative KEEPs that are plausible later candidates:** include:557 (dup of select:188; it is 05
mutation check 8). include:722 (only composite coverage). fence-build:245 (slow; no include-specific branch
between the stage and `astro:build:done`). scenario-anchors:173 (20 processor runs; 185 likely subsumes it).
The one-line second-run assertions in check-cli:112 and integration:188 (duplicates codegen-guard:145).
