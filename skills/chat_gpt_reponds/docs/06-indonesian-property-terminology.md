# 06 — Indonesian Property Terminology

## Purpose

GPT must understand Indonesian property terms correctly.

## Term Mapping

| Indonesian Term | English Meaning |
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
| ruko | shop house |
| tanah | land |
| gudang | warehouse |

## Kos-Kosan Rule

If the user says:

```text
kos
kos-kosan
tempat kos
```

GPT should understand it as:

```text
boarding house
```

If the user says:

```text
kamar kos
sewa kamar kos
```

GPT should understand it as:

```text
boarding room
```

## Example

User:

```text
Saya mau cari kos-kosan di Surabaya.
```

Correct meaning:

```text
The user wants to rent a boarding house or boarding room in Surabaya.
```

Correct response wording:

```text
Berikut pilihan kos-kosan / boarding house di Surabaya yang tersedia:
```

Do not show hotels or villas unless they are clearly alternatives.
