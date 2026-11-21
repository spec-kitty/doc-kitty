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

## Author-set colours

The author sets each node's fill here. Two nodes set only a fill, so the
toolkit picks the label colour. One sets both a fill and a label colour, and
the author's choice stands. The last edge carries an author-set colour.

```mermaid
%% title: Author-set node colours
%% description: Three nodes with author-set fills and one edge with an author-set colour.
flowchart LR
  pale[Pale fill, no label colour]
  deep[Deep fill, no label colour]
  both[Deep fill with a white label]
  pale --> deep
  deep --> both
  both --> pale
  classDef paleFill fill:#ffffcc,stroke:#999933
  classDef deepFill fill:#1168bd,stroke:#0b4884
  classDef bothSet fill:#1d6b3a,stroke:#124526,color:#ffffff
  class pale paleFill
  class deep deepFill
  class both bothSet
  linkStyle 2 stroke:#d9731a,stroke-width:2px
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
