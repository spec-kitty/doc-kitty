# Book a consignment

As a shipper\
I want to book cargo onto a sailing\
So that my goods travel on a confirmed slot

A booking reserves space on one sailing for one consignment. Bookings that
exceed the sailing's remaining capacity are refused, and the shipper sees why.

*2 rules · 4 scenarios · 2 example rows*

## Background

- **Given** a sailing from Rotterdam to Felixstowe with 40 TEU remaining

## Rule: A booking within capacity is confirmed

### Scenario: Book cargo that fits

`@smoke`

- **Given** a consignment of 12 TEU
- **When** the shipper books the consignment onto the sailing
- **Then** the booking is confirmed
- **And** the sailing has 28 TEU remaining

### Scenario: Attach a packing list to a confirmed booking

- **Given** a confirmed booking for a consignment of 2 TEU
- **When** the shipper attaches the packing list:

  ```json
  { "lines": [{ "sku": "A-1", "qty": 10 }, { "sku": "B-2", "qty": 4 }] }
  ```

- **Then** the booking shows 2 packing-list lines

## Rule: A booking over capacity is refused

### Scenario Outline: Refuse cargo that does not fit

- **Given** a consignment of `<size>` TEU
- **When** the shipper books the consignment onto the sailing
- **Then** the booking is refused with reason `"<reason>"`

**Examples: Over capacity** `@edge`

| size | reason |
| --- | --- |
| 41 | insufficient space |
| 120 | insufficient space |

### Scenario: Refused bookings state the remaining capacity

- **Given** these consignments are already booked:

  | consignment | size |
  | --- | --- |
  | C-100 | 30 |
  | C-101 | 8 |

- **When** the shipper books a consignment of 5 TEU onto the sailing
- **Then** the booking is refused with reason `"insufficient space"`
- **And** the refusal states that 2 TEU remain
