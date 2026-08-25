# Contract: diagram metadata transform (remark parse + rehype figure)

**Modules**: `src/lib/remark/diagram-meta.ts` (+ `diagram-meta.internal.ts` pure helpers),
`src/lib/rehype/diagram-figure.ts`. Registered by `defineDocKittyIntegrations({ diagrams:
true })` into the markdown pipeline (remark before the fence transform; rehype after).

## remark plugin — per `code` node with `lang === 'mermaid'`

1. **Parse** the leading metadata block: lines matching `^%%\s+(title|description|attribution|source):\s*(.+)$`,
   stopping at the first non-`%%`, non-blank line. Never match `%%{` (the init directive).
   Unknown `%% key:` lines are left in place (ordinary comments).
2. **Strip** the matched metadata lines from the code value.
3. **Inject** accessibility statements into the code value, **after the diagram-type
   declaration line** (skip a leading `%%{ init }%%` directive and/or a `---` YAML frontmatter
   block to find it):
   - `accTitle: <title || description>`  ← the accessible **name** (fallback to description)
   - `accDescr: <description>`           ← the accessible **description** (omit if no description)
4. **Stash** `{ title, description, attribution, source }` on `file.data.dkDiagrams[<node key>]`
   for the rehype pass.

## rehype plugin — per `<pre class="mermaid">`

Read the matching caption fields off `file.data` and wrap:

```html
<figure class="dk-diagram" role="group">
  <pre class="mermaid">…source (accTitle/accDescr injected)…</pre>
  <figcaption class="dk-diagram__caption">
    <span class="dk-diagram__desc">{description}</span>
    <span class="dk-diagram__attr">{attribution}</span>  <!-- links to {source} if present -->
  </figcaption>
</figure>
```

- Omit `<figcaption>` (or emit an empty-safe figure) when no `description`/`attribution`.
- The figure sits inside the searchable content region; the inner SVG is not `aria-hidden`.

## Unit-test matrix (vitest, Astro-free — `diagram-meta.internal`)

field parse (all four) · unknown-key passthrough · `%%{ init }%%` NOT matched as metadata ·
strip removes only metadata lines · **accTitle fallback to description when title absent** ·
accDescr omitted when no description · injection **after the type-declaration line** ·
**injection with a leading `%%{ init }%%`** (after the declaration, not the init) ·
**injection with leading `---` frontmatter** · figure shape with/without each field ·
guaranteed types: **flowchart / sequence / class**.
