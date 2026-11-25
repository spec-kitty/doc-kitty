---
title: Diagram contrast fixture
description: Build-time diagrams with long labels, author-set fills and an ArchiMate view, so the browser checks can prove labels fit and stay readable in both themes.
doc_status: draft
updated: 2026-11-21T00:00:00Z
type: Architecture
kind: Reference
tags: [architecture, diagrams, plantuml, fixture]
related:
  - architecture/diagram-demonstrator
  - architecture/plantuml-demonstrator
---

# Diagram contrast fixture

This page is a test fixture, kept as a draft so it is built for the browser
checks and never published. Its diagrams use the shapes that broke on a
consumer site: long labels, colours set by the author, and an ArchiMate view.
The checks measure each label and edge here in the light and the dark theme.

## Long labels

Every label below is long enough to wrap or to fill its box. A label must fit
inside its box: none may be cut off.

```mermaid
%% title: Long-label container view
%% description: A producer ecosystem feeds a status reducer and a consumer site; every node and edge carries a long label.
flowchart LR
  subgraph core[Spec Kitty open core and its producer ecosystem]
    cli[Command line interface for mission authors]
    reducer[status.reducer.materialize_snapshot over the event log]
  end
  site[Consumer documentation site built with the toolkit]
  agent[Agent reading the discovery surfaces]
  cli -->|appends lifecycle events to the log| reducer
  reducer -->|materializes the snapshot that consumers read| site
  site -.->|publishes llms.txt and the JSON agent API| agent
```

The next diagram sets its own font and size in an init directive, as many
hand-written diagrams do. Its labels must fit too.

```mermaid
%%{init: {'theme':'base','themeVariables': {'fontFamily': 'Trebuchet MS, Verdana, Arial, sans-serif', 'fontSize': '14px'}}}%%
%% title: Long labels with an author font
%% description: The same producer and consumer chain, drawn with a font and size the author set in an init directive.
flowchart LR
  subgraph open[Spec Kitty open core and its producer ecosystem]
    events[Command line interface that appends lifecycle events]
    snapshot[status.reducer.materialize_snapshot folded by the reducer]
  end
  docs[Consumer documentation site built with the toolkit]
  events -->|appends events| snapshot
  snapshot -->|folded by the reducer and consumed by the site| docs
```

The next diagram asks for a serif font. A serif font is narrower than the
toolkit's label font, so a box measured in it would be too small for the label.
It has a single edge, which an SVG optimizer could otherwise restyle.

```mermaid
%%{init: {'themeVariables': {'fontFamily': 'serif'}}}%%
%% title: Long labels with a serif author font
%% description: Two long labels in a diagram that asks for a serif font.
flowchart LR
  serifA[Wonderfully long label]
  serifB[A second long label]
  serifA --> serifB
```

## Author-set colours

The author sets each node's fill here. Two nodes set only a fill, so the
toolkit picks the label colour. One sets both a fill and a label colour, and
the author's choice stands. One fill is see-through, so the page shows through
it and its label follows the theme. The last edge carries an author-set colour.

```mermaid
%% title: Author-set node colours
%% description: Four nodes with author-set fills, one of them see-through, and one edge with an author-set colour.
flowchart LR
  pale[Pale fill, no label colour]
  deep[Deep fill, no label colour]
  both[Deep fill with a white label]
  faded[See-through fill, no label colour]
  pale --> deep
  deep --> both
  both --> pale
  classDef paleFill fill:#ffffcc,stroke:#999933
  classDef deepFill fill:#1168bd,stroke:#0b4884
  classDef bothSet fill:#1d6b3a,stroke:#124526,color:#ffffff
  classDef seeThrough fill:#1168bd,fill-opacity:0.6,stroke:#0b4884
  class pale paleFill
  class deep deepFill
  class both bothSet
  class faded seeThrough
  linkStyle 2 stroke:#d9731a,stroke-width:2px
```

## Author-set edge colours

This diagram sets its edge colour in an init directive, as one consumer diagram
does, and two edges set their own colour, one pale and one mid-grey. A dark edge
colour vanishes on the dark page, a pale one on the light page, and a mid-grey
one fades on whichever surface is closest to it in brightness. Each edge keeps the author's colour
where it is readable, and takes the theme's edge colour where it is not.

```mermaid
%%{init: {'themeVariables': {'lineColor': '#0a0721'}}}%%
%% title: Author-set edge colours
%% description: A producer writes to a queue that a reader drains into a store; the edges carry colours the author set.
flowchart LR
  producer[Producer] --> queue[Queue]
  queue --> reader[Reader]
  reader --> store[Store]
  store -.-> producer
  linkStyle 2 stroke:#f5f5f5,stroke-width:2px
  linkStyle 3 stroke:#949494,stroke-width:2px
```

## ArchiMate view

ArchiMate colours each element by its layer: business elements are pale
yellow, application elements pale blue and technology elements pale green.
Those fills stay the same in both themes, so their labels must stay dark.

```plantuml
' title: Gate distribution (ArchiMate)
' description: An operator uses a built-in pack, which serves the gate definitions that run on the operator machine.
archimate #Business "Operator" as op <<business-actor>>
archimate #Application "built-in pack (trusted by position)" as pack <<application-component>>
archimate #Technology "Operator machine" as machine <<technology-node>>
archimate #Technology "Deterministic governed checks" as checks <<technology-system-software>>
op --> pack : uses
pack --> checks : serves
checks --> machine : runs on
```
