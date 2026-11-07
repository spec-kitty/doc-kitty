---
affected_files: []
cycle_number: 2
mission_slug: page-chrome-01M6PBR7
reproduction_command:
reviewed_at: '2026-11-06T09:28:32Z'
reviewer_agent: claude:claude-opus-5-5:reviewer-renata
wp_id: WP01
---

# WP01 review: changes requested

Everything else in WP01 passes (see "Not blocking"). One requirement failure and two things that follow from it need fixing. The fix is small.

## Issue 1 [HIGH]: the agent index still links llms and sitemap when detection says they are not served (FR-002)

`src/lib/routes/agent-index.ts:156-157` emits `_links.llms` and `_links.sitemap` unconditionally. FR-002 says the footer, head and agent index read one result "so that they can't disagree". data-model.md says "a link to a surface renders only if its field is true". T005 names only four links, but the requirement outranks that list.

Reproduced with real fixture builds through `buildChromeFixture`:

- `options: { site: null }`: the surfaces report `sitemap: false`, no `sitemap-index.xml` is built, and `_links.sitemap` is `http://localhost:4321/doc-kitty/sitemap-index.xml`.
- `files: { 'src/pages/llms.txt.ts': null }`: the surfaces report `llms: false`, no `llms.txt` is built, and `_links.llms` is `https://spec-kitty.github.io/doc-kitty/llms.txt`.

WP09 will drop the sitemap link from the footer on a no-site build, so the footer and the index would disagree in the same build, which is what FR-002 rules out. `pnpm assert:artifacts` also fails on a dangling `_links` href, per `docs/guides/consumer-setup.md:366-372`, so such a site is told to turn off a link that has no off switch.

Fix:

1. In `agent-index.ts`, gate both on `surfaces?.llms ?? true` and `surfaces?.sitemap ?? true`, so the `undefined` path keeps today's output.
2. In `src/lib/contract.ts:124-125`, make `llms` and `sitemap` optional in `IndexLinks`. This is a recorded out-of-map edit. `mcp/src/corpus/source.ts:231-232` validates only `self` and `scenarios`, so MCP is not affected. `agent-links.test.ts:48` runs on the example, which serves both, so it stays green.
3. Update the docblock at `agent-index.ts:26-27`, which says both are "always linked".
4. Add assertions to `served-surfaces-build.test.ts`: the no-site build has no `_links.sitemap` and the with-site build has it; a build with `llms.txt.ts` deleted has no `_links.llms` and the stock build has it. Add a unit case for the `undefined` path.

## Issue 2 [MEDIUM]: the changelog fragment overclaims

`docs/changelog/unreleased/290-served-surfaces.md:5` says "The agent index no longer names a surface the site does not mount". Issue 1 shows that is false today. Fixing Issue 1 makes the headline true. Then extend the body, which lists only `rss`, `bibliography`, `scenarios` and `self`, to name `llms` and `sitemap`, including that `sitemap` depends on `site`.

## Issue 3 [MEDIUM]: the consumer guide still teaches the old behaviour

`docs/guides/consumer-setup.md:328-331` says these links are "on by default because the worked example mounts them" and "turn its link off or it points at a 404". Line 341 says a site without the per-page route "must pass `links: { pages: false }`". Line 374 repeats "The usual fix is to turn off the link". After this WP all of that is wrong for standard paths. WP10 T039 adds options and limits but does not name this passage, and this commit already edits this file, so fix it here: detection is the default, and `links` is the override for a route at a non-standard path.

## Not blocking

- `src/lib/integrations/served-surfaces.ts:9`: the comment is true but incomplete. In a real `astro build` the logged order is routes:resolved, config:done, routes:resolved (again, from content sync's temp server), build:start. Consider saying so. Consequently, removing the `config:done` publish fails only the unit test, and `served-surfaces-build.test.ts` stays green. Keep the publish: it is what makes a build without content sync correct.
- `data-model.md` says `contentGraph: true`, while the code has `boolean` as T003 asks. Correct the data model in WP10 or when this mission's docs are finalised.

Do not change: the `titleIsIndex: false` with `indexLabel` handling, the unknown-key rejection, the two edited tests, or the `pageAtom` detection. Those all passed review.
