# 05 — About Us Module and JSON Catalog

## Purpose

The About Us module displays company/profile information and property portfolio data.

The property list must come from the JSON catalog, not random dummy generation.

## Frontend Files

```text
frontend/src/views/AboutView.vue
frontend/src/components/PortfolioCard.vue
frontend/src/components/PropertyFilter.vue
frontend/src/services/aboutApi.js
```

## Backend Route

```text
GET /api/about
```

## Backend Controller

```text
backend/controllers/aboutController.js
```

## Main Property Catalog

```text
frontend/public/json_data/indonesia_property_36_provinces_flat.json
```

This catalog is used by:

- About Us portfolio;
- frontend property filters;
- frontend first-chat compact context;
- backend property recommendation service.

## Other JSON Files Present

```text
frontend/public/json_data/indonesia_property_36_provinces_associative.json
frontend/public/json_data/indonesia_property_36_provinces_flat - v2.json
```

The primary runtime catalog should remain:

```text
indonesia_property_36_provinces_flat.json
```

unless code is intentionally changed.

## Expected JSON Fields

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

## Building Type Values

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

## Transaction Type Values

```text
sale
rent
purchase
```

## Property Image Assets

Folder:

```text
frontend/public/assets/image_data/properties/
```

Expected image mapping:

```text
apartment.png
boarding_house.png
hotel.png
house.png
office.png
others.png
shophouse.png
villa.png
warehouse.png
```

## Image URL Rule

Property JSON should refer to:

```text
/assets/image_data/properties/{building_type}.png
```

## Frontend Behavior

About Us should:

- load catalog data;
- normalize location display;
- filter by building type;
- filter by transaction type;
- filter by location text;
- render property cards;
- paginate when needed;
- not create random dummy properties at runtime.

## Backend/AI Rule

The backend chatbot recommendation service should use the same main JSON catalog.

Do not invent property records outside this catalog.

## Troubleshooting

If About Us still shows random or wrong data:

1. confirm `AboutView.vue` loads the JSON file;
2. confirm the JSON path is correct;
3. confirm property image paths use `/assets/image_data/properties/`;
4. confirm filters use the same building and transaction type values;
5. confirm backend recommendation service reads the same catalog file.
