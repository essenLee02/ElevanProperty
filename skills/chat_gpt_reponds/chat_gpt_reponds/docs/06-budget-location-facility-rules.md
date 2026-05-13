# 06 — Budget, Location, and Facility Rules

## Budget Expressions

Understand expressions such as:

```text
5 juta - 10 juta per tahun
Rp 5.000.000 sampai Rp 10.000.000 per tahun
under 10 million per year
max 10 juta
di bawah 10 juta
sekitar 8 juta
5jt sampai 10jt
```

## Price Periods

Understand:

```text
per night
per day
per week
per month
per year
```

Also understand Indonesian equivalents such as:

```text
per malam
per hari
per minggu
per bulan
per tahun
```

## Budget Rule

If the user gives a budget range, GPT must respect it if matching data is available.

If no data matches the range, GPT must say so and ask whether the user wants a wider range.

## Location Rule

Respect the requested location first.

If a location is requested, do not recommend another city as an exact match.

## Facility Rule

Respect mentioned facilities when available:

```text
AC
Wi-Fi
furnished
full furnish
parking
security
kitchen
water heater
bed
wardrobe
garden
pool
```

Do not invent facilities not present in the property data.
