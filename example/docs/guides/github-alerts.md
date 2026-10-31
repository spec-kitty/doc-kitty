---
title: GitHub alerts
description: GitHub alert blockquotes (> [!NOTE] and friends) rendered as Starlight asides, with the cases that stay plain blockquotes.
doc_status: active
updated: 2026-10-31T00:00:00Z
type: Guide
kind: Reference
tags: [github-alerts, asides, fixture, showcase]
glossary_autolink: false
---
<!-- markdownlint-disable MD028 -->
<!-- Adjacent alerts are separate blockquotes split by a blank line, as on GitHub;
     MD028 flags that blank line. -->

# GitHub alerts

This site sets `githubAlerts: true`, so a blockquote that opens with one of
GitHub's five alert markers renders as the matching Starlight aside. The same
file reads correctly on GitHub, which renders the markers itself. This page is
also the fixture the accessibility lane scans in light and dark mode.

## The five alert types

> [!NOTE]
> Useful information that readers should know, even when skimming.

> [!TIP]
> Helpful advice for doing things better or more easily.

> [!IMPORTANT]
> Key information readers need to achieve their goal.

> [!WARNING]
> Urgent info that needs immediate attention to avoid problems.

> [!CAUTION]
> Advises about risks or negative outcomes of certain actions.

## An alert with several blocks

> [!TIP]
> An alert body can hold more than one paragraph.
>
> - a list item
> - and [a link](/guides/getting-started/)

## Left as blockquotes

A plain blockquote is unchanged:

> A plain quotation, with no marker.

An unknown marker is not a GitHub alert type, so it stays a blockquote:

> [!DANGER]
> GitHub has no DANGER alert, so neither does this site.

A marker followed by text on the same line is not an alert on GitHub either:

> [!NOTE] This line keeps its literal marker.
