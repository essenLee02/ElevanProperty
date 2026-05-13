# 02 — Property Intent and Terminology

## Transaction Intent

Understand these Indonesian property terms as user intent:

| User Term | Meaning |
|---|---|
| sewa | rent |
| disewakan | rent |
| kontrak | rent |
| kontrakan | rental house |
| beli | buy / purchase |
| membeli | buy / purchase |
| jual | sell / sale |
| dijual | sell / sale |

## Property Type Mapping

| User Term | Meaning |
|---|---|
| rumah | house |
| rumah kontrakan | rental house |
| kontrakan | rental house |
| villa / vila | villa |
| hotel | hotel |
| apartemen | apartment |
| kos | boarding house / boarding room |
| kos-kosan | boarding house |
| kamar kos | boarding room |
| ruko | shophouse |
| kantor | office |
| gudang | warehouse |
| lainnya | others |

## Building Type Values

Use these building type values when reading catalog data:

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

Use these transaction type values:

```text
sale
rent
purchase
```

## Boarding House Rule

If the user says `kos`, `kos-kosan`, or `tempat kos`, understand it as boarding house.

If the user says `kamar kos`, understand it as boarding room.

## Avoid Wrong Type Matching

Do not recommend:

- hotel when the user asks for house;
- villa when the user asks for boarding house;
- sale property when the user asks for rent;
- rental property when the user asks to buy.

If shown as alternatives, clearly label them as alternatives.
