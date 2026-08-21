---
title: What Doc Kitty solves for
description: "The four outcomes Doc Kitty is built for: structure, maintainability, agent interoperability, and flexibility."
status: active
updated: 2026-08-21
type: Context
tags: [motivation, goals]
---

# What Doc Kitty solves for

Doc Kitty exists to make docs-next-to-code work. It is built for four outcomes.
Each one answers a way that docs-next-to-code otherwise fails (see [why docs
rot](./problem.md)).

## Structure

Documentation has a predictable, browsable shape. Sections follow a known order,
so a reader always knows where a topic lives and an author always knows where a
new page goes. Section landing pages teach and then link, rather than listing
filenames. Readers meet context before detail.

## Maintainability

Docs stay correct next to the code. They live in the repo, reviewed and versioned
with the change that prompted them. Metadata makes staleness visible: a lifecycle
status and an `updated` date let tooling flag pages that have drifted. The tree is
curated, not a wiki, so stale pages are updated or removed instead of
accumulating.

## Agent interoperability

The site is one an AI agent can discover and browse. Doc Kitty generates a
sitemap, an RSS feed, an `llms.txt` index, and a JSON agent-API from the same
metadata that serves human readers. This is discovery, not retrieval: a crawlable
map of the corpus, not a vector index to host. See [agent-first
documentation](./agent-first.md).

## Flexibility

Structure and browsability are the two things docs-next-to-code most often lacks,
so flexibility here means adapting to a project without a rewrite. Point the
toolkit at an existing tree and it renders. Metadata-first design lets new page
kinds and output surfaces slot in. The canonical structure is the supported
default; a project can adapt it where it must, within the limits set in
[ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md).

## How the four hold together

Structure makes browsing easy. Metadata makes maintenance and agent discovery
possible. Flexibility keeps the other three from ossifying as the project grows.
