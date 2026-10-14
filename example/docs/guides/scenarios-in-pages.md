---
title: Scenarios in pages
description: Gherkin in an ordinary page — a gherkin code fence or an included .feature file renders as headings, step lists and tables instead of a code block.
doc_status: active
updated: 2026-10-14
type: Guide
kind: Reference
tags: [gherkin, scenarios, showcase, fixture]
related:
  - behaviour/shipping/book-consignment
---

# Scenarios in pages

A `gherkin` code fence on any docs page renders as a structured scenario: a
heading for the feature and for each scenario, the steps as a list with each
keyword in bold, data tables as real tables and doc strings as code blocks. It is
the same rendering a generated behaviour page uses, so the
[behaviour section](/behaviour/) and a guide that quotes a scenario look alike.

A `::gherkin` directive does the same for a `.feature` file that already lives in
the repository; see [Include a feature file](#include-a-feature-file). An included
file also shows each scenario's last test result; see
[Results from the test run](#results-from-the-test-run).

The site turns it on with the `gherkin` option. This page is also the coverage
fixture the accessibility lane scans in light and dark mode.

## A whole feature

A fence that holds a complete feature renders its title, narrative and every
scenario. The headings nest one level under the section the fence sits in.

```gherkin
@init
Feature: Initialise a project
  As a developer starting a new repository
  I want one command to set up the project's governance files
  So that every agent works from the same charter and templates

  Background:
    Given an empty Git repository

  Scenario: Initialise with the default mission
    When the developer runs "init" in the repository
    Then a ".kittify" directory is created
    And the default mission templates are copied into it

  Scenario: Refuse to initialise twice
    Given the repository has already been initialised
    When the developer runs "init" in the repository
    Then the command stops with "already initialised"
    And no file in ".kittify" is changed
```

## Steps on their own

A fence may hold only steps. They render as a step list with no heading, for prose
that walks through one flow.

```gherkin
Given a sailing from Rotterdam to Felixstowe with 40 TEU remaining
When the shipper books a consignment of 12 TEU onto the sailing
Then the booking is confirmed
And the sailing has 28 TEU remaining
```

## Rules, outlines and arguments

Rules, backgrounds, scenario outlines with their examples, data tables, doc
strings and tags all render.

```gherkin
@shipping
Feature: Declare customs for a consignment

  Rule: A declaration lists every line of the consignment

    Background:
      Given a confirmed booking for consignment C-100

    @smoke
    Scenario: Declare a consignment with two lines
      Given the consignment holds these lines:
        | sku | description    | value |
        | A-1 | Garden chairs  | 400   |
        | B-2 | Patio umbrella | 150   |
      When the shipper submits the declaration
      Then the declaration is accepted with this summary:
        """json
        { "lines": 2, "total": 550, "currency": "EUR" }
        """

    Scenario Outline: Hold a declaration over the duty threshold
      Given a consignment declared at <value> EUR
      When the shipper submits the declaration
      Then the declaration is <outcome>

      @edge
      Examples: Around the threshold
        | value | outcome          |
        | 150   | accepted         |
        | 151   | held for review  |
```

## Inside an aside

A fence inside an aside, a list item or a quote renders its headings as
paragraphs with a heading role, so they keep the outline of the container and stay
out of the "On this page" list.

:::note[A scenario in a note]

```gherkin
Scenario: Track a consignment in transit
  Given a consignment loaded on the sailing to Felixstowe
  When the shipper opens the tracking page
  Then the consignment shows as "in transit"
```

:::

## Gherkin as source

Add `raw` to the fence's info string to show Gherkin as a code block, for example
when the point is the syntax itself.

```gherkin raw
# A comment is kept in a raw fence.
Scenario: Show the source
  Given a fence with the info string "gherkin raw"
  Then it renders as a code block
```

## Include a feature file

A `::gherkin` directive on a line of its own renders a `.feature` file from the
repository in place, so the page shows the scenarios the test suite runs instead
of a pasted copy. It renders like a fence, plus a line that names the source
file. Comments in the file are not shown.

```md wrap
::gherkin{src="scenarios/init/init.feature"}
::gherkin{src="features/shipping/declare-customs.feature" scenario="Hold a declaration lodged after the cut-off"}
::gherkin{src="features/shipping/book-consignment.feature" tags="@smoke @edge"}
```

`src` is relative to the project root and must sit inside one of the site's
`includeRoots`. `scenario` picks one scenario by its exact name, and `tags` keeps
every scenario or example row that carries any of the listed tags. A path, name or
tag that matches nothing stops the build.

### A whole file

This is Spec Kitty's own specification of `spec-kitty init`, copied into this site
with its source commit recorded in a comment.

::gherkin{src="scenarios/init/init.feature"}

### One scenario by name

::gherkin{src="features/shipping/declare-customs.feature" scenario="Hold a declaration lodged after the cut-off"}

### Scenarios by tag

`@smoke @edge` keeps the scenario tagged `@smoke` and, from the outline, only the
`@edge` examples.

::gherkin{src="features/shipping/book-consignment.feature" tags="@smoke @edge"}

## Results from the test run

This site sets `gherkin.results` to the Cucumber report its tests write
(`reports/cucumber.ndjson`). Every scenario included from a `.feature` file then
shows its result after its heading, an outline's Examples table gains a `Result`
column, and a whole file gets a results line with the date of the run. The
[generated behaviour pages](/behaviour/) show the same results. A fence shows
none: it has no file the report could name.

The result is the word on the badge; the colour and the symbol only repeat it.

| Badge | Meaning |
| --- | --- |
| Passed | The scenario ran and every step passed |
| Passed on retry | It failed, ran again and passed |
| Failed | A step or hook failed |
| Pending | A step is marked as not finished yet |
| Undefined | A step has no automation yet |
| Ambiguous | More than one step definition matches a step |
| Skipped | Its steps were skipped |
| Not run | The run did not include it |

When the report was made from another version of a file, its scenarios show no
result, and the file's results line says so, rather than putting a result on the
wrong scenario.

### A file with a step not automated yet

::gherkin{src="features/shipping/declare-customs.feature"}
