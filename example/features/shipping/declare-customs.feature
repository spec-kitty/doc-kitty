# language: en
@dk:persona=example-persona @dk:adr=0001 @FR-004
Feature: Declare a consignment to customs
  As a shipper
  I want to declare my cargo to customs before it sails
  So that the consignment clears the border without being held

  Every consignment that crosses a customs border needs a declaration lodged
  before the sailing's cut-off. The declared value sets the duty owed, and an
  insured consignment names the marine policy that covers it.

  Background:
    Given a booked consignment from Rotterdam to Felixstowe
    And the customs cut-off is 24 hours before the sailing departs
    And goods with a declared value under 150 EUR are relieved of duty

  Rule: Duty follows the declared value and the commodity's duty rate

    Scenario Outline: Calculate the duty owed on a declaration
      Given the cargo is declared under a commodity code with a duty rate of <rate>%
      And its declared value is <value> EUR
      When the shipper lodges the declaration before the cut-off
      Then the declaration is accepted
      And the duty owed is <duty> EUR

      Examples: Dutiable goods
        | rate | value | duty |
        | 6    | 10000 | 600  |
        | 0    | 25000 | 0    |

      @edge
      Examples: Below the relief threshold
        | rate | value | duty |
        | 6    | 120   | 0    |

  Rule: A declaration carries the evidence customs asks for

    Scenario: Lodge a declaration for an insured consignment
      Given the consignment is insured under a marine cargo policy
      When the shipper lodges this declaration:
        """xml
        <declaration consignment="C-100">
          <goods code="6912.00" value="10000" currency="EUR"/>
          <insurance policy="MC-2026-0412"/>
        </declaration>
        """
      Then the declaration is accepted
      And the declaration records the policy reference "MC-2026-0412"

    Scenario: Hold a declaration lodged after the cut-off
      Given the customs cut-off has passed
      When the shipper lodges the declaration
      Then the declaration is held for manual review
      And the freight invoice carries a late-lodgement surcharge
