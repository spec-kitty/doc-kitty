The frozen site of the page-chrome suites (WP11). `harness.mjs` copies it to
`example/.dk-test-chrome/<key>/` and builds it, so ordinary edits to `example/docs`
cannot break a golden. An edit here changes the goldens: treat it as one.

  guides/                             a hub with children
  guides/getting-started              a non-hub page with all four metadata blocks
  guides/authoring/                   a nested section whose index is relabelled
  guides/authoring/advanced/deep-page the deep page of the sidebar golden
  guides/empty-hub/                   a hub with no children
  guides/undated                      no `updated`: the build accepts it, the feed leaves it out
  reference/notes/                    a group with no index page
  reference/generated-page            a page with a generated stamp
  adr/template                        a draft; serve-dist.mjs reads it as its draft sentinel

Pages here are test input: no gate runs over them, and `undated.md` would fail the
frontmatter gate on purpose.
