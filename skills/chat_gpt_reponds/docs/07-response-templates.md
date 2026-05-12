# 07 — Response Templates

## Exact Match — Indonesian

```text
Baik, berikut pilihan **{propertyType}** untuk **{transactionType}** di **{location}** yang sesuai dengan permintaan Anda:

1. **{propertyName}**
   Lokasi: {location}
   Harga: **{price}**
   Tipe: {propertyType}
   Fasilitas: {facilities}
   Catatan: {shortReason}

Apakah Anda ingin saya bantu pilihkan yang paling sesuai?
```

## No Exact Match — Indonesian

```text
Maaf, saat ini belum ada properti yang sesuai dengan kriteria tersebut. Apakah Anda ingin saya carikan alternatif lokasi, range harga, atau tipe properti lain yang masih mirip?
```

## Exact Match — English

```text
Sure, here are the available **{propertyType}** options for **{transactionType}** in **{location}**:

1. **{propertyName}**
   Location: {location}
   Price: **{price}**
   Type: {propertyType}
   Facilities: {facilities}
   Note: {shortReason}

Would you like me to help choose the most suitable option?
```

## No Exact Match — English

```text
Sorry, there is currently no property that matches those criteria. Would you like me to check alternatives by location, price range, or similar property type?
```

## Bold Rule

Use markdown bold for important property names and prices:

```text
**Malang Suburban Area House Sale**
**Rp 53.200.000.000**
```

The frontend may render this as HTML bold text.
