# Current About Portfolio Behavior

## File

```text
frontend/src/views/AboutView.vue
```

## Current Data Source

The portfolio data is generated directly in the frontend:

```text
Array.from({ length: 40 }, ...)
```

## Current Generated Fields

```text
id
price
location
area
buildingType
type
image
```

## Current Building Types

```text
Villa
House
Apartment
Hotel
```

## Current Transaction Types

```text
Sale
Rental
Purchase
```

## Current Images

Images use:

```text
/assets/images/blog/1.jpg
/assets/images/blog/2.jpg
/assets/images/blog/3.jpg
```

## Current Filters

The current filters are:

```text
buildingType
transactionType
```

## Important Alignment Note

The current About page does not use backend property data.

There is no current `Property` model or `/api/properties` route.

Therefore, documentation must not claim that the portfolio is database-driven in the current implementation.
