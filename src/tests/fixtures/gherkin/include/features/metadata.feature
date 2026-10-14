@dk:context=billing @billing
Feature: Invoice a consignment
  Invoices follow departure.

  @dk:status=draft @smoke
  Scenario: Invoice on departure
    Given a departed sailing
    Then an invoice is sent

  @nightly
  Rule: Credit notes
    Scenario Outline: Credit <n> lines
      Given an invoice with <n> lines

      @edge @dk:x=y
      Examples:
        | n |
        | 1 |
