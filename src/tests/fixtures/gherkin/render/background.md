# Track a parcel

*2 scenarios*

## Background: A parcel exists

- **Given** a parcel `"P-1"` registered for tracking
- **And** the carrier has scanned it at the depot

## Scenario: See the latest scan

- **When** the recipient opens the tracking page
- **Then** the latest scan location is `"the depot"`

## Scenario: No scans yet

- **Given** the parcel has not been scanned
- **When** the recipient opens the tracking page
- **Then** the page states that no scans exist
