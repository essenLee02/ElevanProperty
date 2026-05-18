# 19 — Match Availability Response Rule

## Purpose

The chatbot must avoid saying that data is not available when matching property data is already shown in the response.

## Main Rule

If the backend catalog contains matching properties for the customer's visible request, the assistant must present them as available matches.

The assistant must not say:

```text
No exact match is available.
Tidak ada exact match.
Belum ada data yang sesuai.
```

when it is also listing properties that match the requested core criteria.

## Core Criteria

Core criteria are the criteria clearly visible in the latest user message, especially:

```text
building type
location
transaction type when explicitly mentioned
budget when explicitly mentioned
facilities when explicitly mentioned
```

## Example

User:

```text
Hi.. saya mau rumah di Sidoarjo
```

If the catalog contains:

```text
Sidoarjo Near Campus House Sale
Sidoarjo Near Station House Sale
```

Correct response:

```text
Baik, berikut pilihan **rumah di Sidoarjo** yang tersedia dari katalog kami:

1. **Sidoarjo Near Campus House Sale**
   Lokasi: Sidoarjo, Jawa Timur
   Harga: **Rp ...**
```

Incorrect response:

```text
Maaf, tidak ada exact match untuk rumah di Sidoarjo.
Pilihan terdekat:
1. Sidoarjo Near Campus House Sale
```

## History Contamination Rule

Old conversation history must not make the latest request too narrow.

Example:

Old history:

```text
sewa hotel di Malang
```

Latest user message:

```text
saya mau rumah di Sidoarjo
```

Correct interpretation:

```text
building_type = house
location = Sidoarjo
transaction_type = not specified
```

Incorrect interpretation:

```text
building_type = house
location = Sidoarjo
transaction_type = rent from old history
```

## Alternative Wording Rule

Use alternative wording only when the data does not match the visible request.

If the properties match the requested location and property type, show them as matching options, even when the transaction type was not specified.
