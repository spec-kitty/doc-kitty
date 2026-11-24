---
section: Changed
---

- **`dockitty-export-okf` carries the evidence index, and its conformance check
  resolves links to non-Markdown files (#401).** Before, the export ignored a
  `tom-annex.json` beside the content graph, and the on-disk conformance check
  registered only Markdown files, so a bundle page that linked to another file
  in the bundle read as a broken link. Now the export copies `tom-annex.json`
  into the bundle with a root-index entry, and stops with an error if that file
  is not a `doc-kitty/tom-annex` index. The check registers every file in the
  bundle, so a link to a file that is there resolves. A site with classified
  pages also gains `tomAnnex` in its `api/index.json` links, which changes a
  pinned link set.
