---
title: CI/CD pipeline
description: "Path-scoped CI lanes for tests, doc sanity checks, and example-site deployment that keep the repo green."
doc_status: draft
updated: 2026-08-22
type: Feature
kind: Feature
moscow:
  level: Must
  rationale: The harness every feature lands on and the stated primary concern of the roadmap.
tags: [ci-cd, delivery]
related:
  - architecture/ci-cd-pipeline
  - adr/0007-ci-cd-path-scoped-lanes
---

# CI/CD pipeline

Mission M0. A path-efficient pipeline that runs tests, doc sanity checks, and the
example-site deployment, and shapes every feature's definition of done.

Scope: MVP.

Design: [CI/CD pipeline](../../architecture/ci-cd-pipeline.md) and
[ADR-0007](../../adr/0007-ci-cd-path-scoped-lanes.md).
