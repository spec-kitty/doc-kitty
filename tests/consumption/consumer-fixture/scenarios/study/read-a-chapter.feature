# A behaviour spec the consumer fixture embeds with ::gherkin (gherkin-in-any-page,
# ADR-0051). `scenarios` is the fixture's only include root; it is not a
# generated-pages source, so this file gets no page of its own.
Feature: Read a chapter
  As a rhetoric student
  I want to read a chapter with its glossary to hand
  So that I can follow the argument

  Scenario: Open a chapter from the book index
    Given the book index of book one
    When the student opens "Chapter 1"
    Then the chapter page is shown

  @smoke
  Scenario: Look up a term while reading
    Given the student is reading chapter 1
    When the student hovers over "Dialectic"
    Then the definition is shown
