# Research — Diagram markup + component-CSS delivery

Consolidated from a completed research delegate + a 4-lens as-is adversarial squad (architect-alphonso, debugger-debbie, paula-patterns, researcher-robbie), all read-only against the running branded build. Each decision below survived independent scrutiny; convergence noted.

## D1 — Fix #59 at the remark seam by retyping the node off `code`

- **Decision**: In `mermaidFenceTransform` (`src/lib/config.ts` ~:406), change the mdast node's `type` away from `code` (e.g. `dkMermaid`) while keeping the `hName:'pre'` / `hProperties{class:mermaid}` / `hChildren` projection. The unknown-node handler in `mdast-util-to-hast@13.2.1` then emits a **single** `<pre class="mermaid">` with no wrapping `<pre>`. Leave `src/lib/rehype/diagram-figure.ts` unchanged.
- **Rationale**: The `code` handler (`handlers/code.js:43,46`) applies `data.*` to the inner `<code>` and then *unconditionally* wraps it in its own `<pre>` — so any `hName` on a `code` node double-wraps. Verified against the installed source. This is the codebase's own established correct pattern (`markuaSpan`, `deckSection` already use custom types). Retyping also *strengthens* the deliberate Shiki/expressive-code sidestep (a non-`code` node can't be claimed as a code block). `diagramMeta` runs before the retype (pinned order), so it still keys on the `code`/`mermaid` node.
- **Alternatives considered**: (a) move conversion to a rehype pass — rejected: re-opens the Shiki-timing problem the remark approach avoids; (c) unwrap the stray `<pre>` in `diagram-figure.ts` — rejected as a downstream symptom patch that leaves malformed hast for any consumer skipping the rehype pass. Kept as **fallback only** if a downstream remark consumer chokes on the custom type.
- **Convergence**: architect + patterns + researcher all independently recommend the retype; researcher verified the unknown-handler path emits a single element.

## D2 — #59 is a single-site defect; no whack-a-field cleanup

- **Decision**: Fix only the mermaid site; keep the `.reveal … pre:not(.mermaid)` code-card rule (`dk-reveal-theme.css:158`) and the `DeckLayout` code-block `tabindex` loop (~:216-220).
- **Rationale**: `config.ts:406` is the ONLY `hName`-on-`code` projection (the other 5 sites target single-element/custom-type handlers and are correct). The `:not(.mermaid)` guard and the `tabindex` loop are legitimate for **real** code blocks; they merely stop *accidentally* matching the stray `<pre>` post-fix. Deleting them would regress real code-block styling/a11y.
- **Alternatives considered**: treating the CSS/JS guards as removable duct-tape — explicitly refuted by the patterns lens (self-corrected against its own dedup bias).

## D3 — Deliver component CSS via a standalone sheet that survives brand slot-0 replacement (#60 + #68)

- **Decision**: Author `.dk-diagram*` and relocate `.dk-callout*` into a **standalone** component stylesheet, added as its **own** `customCss` entry (not slot 0) AND linked explicitly by `DeckLayout`. Do not fold into `theme.css`.
- **Rationale (empirically confirmed on the branded example)**: `config.ts:670-671` replaces `customCss` slot 0 (static `theme.css`) with a **tokens-only** generated sheet (`theme.ts:15-21`) when a theme is active. The branded `markua-showcase` docs page renders 26 `.dk-callout` elements but links **no** sheet containing `.dk-callout` rules (they live only in `theme.DNJ8VAxc.css`, linked exclusively by decks) → callouts ship unstyled today (#68). A sheet in `customCss[1..]` survives the slot-0 swap and bundles into branded docs; the deck needs its own `<link>` because out-of-frame decks get no global injection (ADR-0022 D4/D5).
- **Alternatives considered**: fold into `theme.css` (P1) — refuted: would be dropped under branding exactly like `.dk-callout`. Co-locate in `dk-reveal-theme.css` — rejected: route-isolated to decks, never reaches docs.
- **Follow-through**: the no-theme default-path `customCss` shape invariant (`theme-merge.test.ts`) must be updated deliberately (NFR-004).

## D4 — Caption typography uses general text tokens, not `--dk-diagram-*`

- **Decision**: `.dk-diagram__caption`/`__desc`/`__attr` use `--dk-color-text-*` / `--dk-text-*` (+ explicit `white-space: normal` and non-monospace `font-family` to override the deck cascade). No separate dark block (semantic tokens flip by mode).
- **Rationale**: the six `--dk-diagram-*` tokens are Mermaid **graph colors** (node fill/border/edge) consumed by the render client's `themeVariables`, not caption typography. Mixing them would misfire.

## D5 — Verification closes a mutation-dead zone

- **Decision**: Add (1) a build-artifact assert that no `<pre>` wraps `figure.dk-diagram`, across all **3** diagram pages (deck, `architecture/overview`, `architecture/diagram-demonstrator`); (2) a pipeline-level unit running the real `diagramMeta → mermaidFenceTransform → mdast-util-to-hast → diagramFigure` chain (today's unit hand-builds the fixture and is blind); (3) a CSS-delivery assert that a branded docs page ships `.dk-callout` AND `.dk-diagram` rules; (4) a Playwright computed-style check on **both** the docs and deck shells (caption not monospace, `white-space` normal, no code-card).
- **Rationale**: all 7 existing diagram gates match *inside* `<figure>` and none check CSS delivery, so both defects are in a mutation-dead zone (debugger lens, confirmed 6/6 double-wraps). Each new gate must be shown red on the re-introduced defect.
- **Constraints**: do NOT re-enable #31's deferred internal-node-geometry asserts (C-004); `architecture/overview` (currently in no lane) must be covered.

## D6 — Add a deck fixture with a diagram; document the ownership seam

- **Decision**: Publish an example deck containing a Mermaid diagram (no deck exercises the deck diagram CSS path today), and add a short ADR making the remark→rehype→CSS figure-ownership contract explicit (the three layers' comments currently each name a different owner).
- **Rationale**: without a deck fixture the deck CSS path stays unverified; the ADR prevents the ownership ambiguity that produced #59/#60 from recurring.

## Supply-chain

No dependency added, upgraded, or removed. Supply-chain install-safety review is N/A for this mission (zero dependency delta) — recorded here explicitly rather than left silent.
