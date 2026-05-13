# 11 — Property Data Fields

## Expected Property Fields

GPT may receive property data with fields such as:

```text
id
title
description
price
location
address
facilities
building_area
land_area
building_type
transaction_type
image
```

## Location Object

The location may include:

```text
province
city
area
```

## Field Usage

Use the fields as follows:

- `title` for property name.
- `description` for summary.
- `price` for price display.
- `location` for city, province, and area matching.
- `address` for address display if available.
- `facilities` for facility matching.
- `building_area` and `land_area` for size comparison.
- `building_type` for property type.
- `transaction_type` for rent, sale, or purchase.
- `image` is usually for frontend display, not conversational priority.

## Missing Field Rule

If a field is missing, do not invent it.

Use only available fields.
