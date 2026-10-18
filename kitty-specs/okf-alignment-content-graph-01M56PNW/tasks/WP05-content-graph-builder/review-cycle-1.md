---
affected_files: []
cycle_number: 1
mission_slug: okf-alignment-content-graph-01M56PNW
reproduction_command:
reviewed_at: '2026-10-18T06:15:15Z'
reviewer_agent: claude
wp_id: WP05
---

# WP05 review: changes requested

## Blocker: built graph does not validate against contracts/content-graph.schema.json
I validated example/dist/api/content-graph.json (77 nodes, 119 edges) with ajv draft-2020. There are 10 errors, all at `/nodes/N/authors/0`: the `actor` pattern fails because `pageNode` passes `authors: data.authors` through unchanged, so raw emails (`stijn@sddevelopment.be`) end up in the graph. data-model.md:13 says emails are accepted with a warning and rewritten to `human:<local-part>` on output.

Fix:
- Normalise `authors` in `pageNode` (src/lib/docs-index.ts ~L265) through the vocabulary-core actor owner (`parseActor` in src/lib/vocabulary-core.mjs) so an email becomes `human:<local-part>`. Do not copy that logic into a second implementation.
- Add a test with a page whose author is an email. The graph node must carry `human:<local>`.
- Add a test that validates a built or fixture graph against the contract schema. Today no test fails on this violation, so the conformance claim was never checked.

## Checked and OK
- Every non-author field validates.
- Nodes are sorted by code unit. Edge ids are `source|rel|target`. `schema` and `okf_version` are present.
- Node kinds: page/persona/catalog/resource. Rels: in-section/audience/cites/related/derived-from. No glossary or body edges.
- No draft nodes and 0 dangling edges. The final filter drops edges into drafts.
- `derived-from` resolves `sources[].resource` to a page id or to a `resource:` node.
- `npm pack --dry-run` includes the new route, injected entrypoint, integration and .d.ts files. The exports entry is present.
- The design choices (section index to parent index, README bundle ids, resource:/catalog: ids) are acceptable.
