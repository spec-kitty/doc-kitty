@shipping
Feature: Book a consignment
  As a shipper
  I want to book space on a sailing
  So that my cargo moves

  Bookings are confirmed against free capacity.

  Background:
    Given a sailing "NLRTM to GBFXT" with free capacity

  @smoke
  Scenario: Book space on a sailing
    When I book a consignment of 2 TEU
    Then the booking is confirmed

  Scenario Outline: Book <n> boxes
    When I book <n> boxes

    @happy
    Examples: Small
      | n |
      | 1 |
      | 2 |

    @edge
    Examples: Large
      | n   |
      | 999 |

  @refunds
  Rule: Refunds
    Background:
      Given a paid booking

    Scenario: Refund in full
      When I cancel with the note:
        """gherkin
        Feature: Not included
          Scenario: Nested
            Given nothing
        """
      Then I am refunded in full
