@billing
Feature: Checkout
  Customers pay for the items in their basket.

  Background:
    Given a basket with 2 items

  Scenario: Paying by card
    When the customer pays by card
    Then the order is confirmed

  Scenario Outline: Applying a discount code
    When the customer applies the code "<code>"
    Then the total is <total>

    Examples:
      | code    | total |
      | SAVE10  | 18.00 |
      | EXPIRED | 20.00 |

  Rule: Gift cards cover part of the total

    @flaky
    Example: Paying with a gift card
      When the customer pays with a gift card
      Then the order is confirmed
