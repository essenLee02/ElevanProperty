# 05 — JSON Property Catalog

## Main JSON File

```text
frontend/public/json_data/indonesia_property_36_provinces_flat.json
```

## Purpose

The JSON catalog is used by:

- About Us portfolio display;
- frontend filters;
- chatbot property recommendation context;
- ChatGPT prompt context.

## Required Fields

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

## Building Types

```text
house
apartment
hotel
villa
boarding_house
shophouse
office
warehouse
others
```

## Transaction Types

```text
sale
rent
purchase
```

## Image Path Rule

The `image` field should point to shared PNG files by building type:

```text
/assets/image_data/properties/house.png
/assets/image_data/properties/apartment.png
/assets/image_data/properties/hotel.png
/assets/image_data/properties/villa.png
/assets/image_data/properties/boarding_house.png
/assets/image_data/properties/shophouse.png
/assets/image_data/properties/office.png
/assets/image_data/properties/warehouse.png
/assets/image_data/properties/others.png
```

For `others`, the image may represent a tourism or San Diego Zoo-inspired attraction image when required by the dataset.

## Data Size Rule

If the JSON is too large, reduce records while keeping mixed:

- provinces;
- building types;
- transaction types.

Recommended lightweight dataset:

```text
400 property records
```

## Recommendation Rule

Chatbot should not send the entire large JSON to ChatGPT when not needed.

Backend should filter relevant properties before sending context to ChatGPT.
