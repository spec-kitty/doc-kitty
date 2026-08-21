---
title: Why docs next to code rot
description: "Docs-next-to-code fails for two reasons: structure too rigid to grow, and contents too hard to browse."
status: active
updated: 2026-08-21
type: Context
tags: [motivation, docs-as-code]
---

# Why docs next to code rot

Keeping documentation in the repo, next to the code, is the right instinct. The
docs are versioned with the code, reviewed in the same pull request, and edited by
the people who changed the behaviour. Teams reach for this and expect the docs to
stay current.

They usually don't. The docs rot, people stop trusting them, and a doc no one
trusts is worse than no doc at all. Two failures cause most of it.

## The structure is too rigid to grow

Many projects start with a flat folder or a fixed template. New topics have no
obvious home, so pages land wherever the author happened to be working. A year
later the folder is a junk drawer: nobody knows where a thing belongs, so nobody
files it, so it never gets written.

## The contents are too hard to browse

A pile of Markdown with no index, no metadata, and no navigation cannot be
browsed, only grepped. A reader who cannot find the page they need assumes it does
not exist. New contributors give up, and so do agents.

## What follows from this

Both failures are about shape, not writing quality. Good prose does not rescue
docs that readers cannot navigate or authors cannot place. Doc Kitty targets the
shape: a clear default structure that stays browsable, and metadata that keeps it
navigable and maintainable. The next page, [what Doc Kitty solves
for](./what-we-solve-for.md), states the outcomes.
