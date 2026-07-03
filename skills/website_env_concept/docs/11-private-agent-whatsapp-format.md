# 11. Private Agent — WhatsApp Response Format

> File ini khusus mendokumentasikan `ResponseBuilderWhatsApp` dan
> `generateResponseForTerminalMassege()` — format response Private Agent
> yang dioptimalkan untuk WhatsApp (Fonnte, Kirimi, TimelinesAI).
>
> Untuk website chatbot, lihat `06-ai-system-and-skill-loader.md`.

---

## Mengapa Perlu Format Terpisah?

| | Website Chatbot | WhatsApp Terminal |
|---|---|---|
| Bold format | `**markdown**` | `*asterik*` (WhatsApp native) |
| Images | Tidak | `![Title](url)` |
| Agent footer | Tidak | Salam + nama agent |
| Max properties | 20 (Rumah123) + 6 (catalog) | 6 total (character limit WA) |
| Fungsi | `generateResponseForChatbot()` | `generateResponseForTerminalMassege()` |
| Class builder | `ResponseBuilder` | `ResponseBuilderWhatsApp` |

---

## ResponseBuilderWhatsApp

**File:** `backend/controllers/chatbotPrivateController.js`

```javascript
class ResponseBuilderWhatsApp {
  constructor(lang = 'en', agentName = 'Elevan Property')
  //   lang      : 'id' | 'en' — auto-detect dari LanguageDetector.detect()
  //   agentName : Nama agent WhatsApp (dari DB: agent.name)

  offTopic()     // → Pesan off-topic dalam format WA
  clarification()// → Minta klarifikasi tipe/transaksi dalam format WA
  exactMatch({ rumah123Listings, catalogMatches, filters })
  alternative({ alternatives, rumah123Listings, filters })
  // Private helpers:
  //   #catalogItemWhatsApp(item, index, lang)
  //   #catalogListWhatsApp(properties, lang, limit=6)
  //   #addFooter()    → "Salam hangat, *[agentName]*, *Elevan Property*"
  //   #filterAlternativesByLocation(alternatives, location)
  //   #summarizeRequest(filters)
}
```

---

## generateResponseForTerminalMassege()

```javascript
ChatbotPrivateService.generateResponseForTerminalMassege({
  session,               // ChatSession object
  history,               // Conversation history array
  userMessage,           // Pesan customer
  agentName,             // ← WAJIB diisi, contoh: "LEO FELIX"
  recommendationContext, // Null → auto-build dari userMessage
  externalError          // Error dari ChatGPT/Claude (untuk logging)
})
```

Dipanggil dari `whatsappAIService.js` sebagai Private Agent fallback:

```javascript
const { generatePrivateTerminalMassege } = require('../controllers/chatbotPrivateController');

const result = await generatePrivateTerminalMassege({
  session,
  history,
  userMessage: message,
  agentName:   agentName,  // Diambil dari agent.name di controller
  recommendationContext,
  externalError: new Error('ChatGPT and Claude unavailable for WhatsApp reply'),
});
```

---

## Format Response (Contoh Lengkap)

Customer mengirim: `"saya butuh sewa hotel Vasa di Surabaya"`

```
⚠️ Maaf, belum ada listing yang tersedia di *Surabaya* dari Rumah123
untuk *Sewa Hotel Surabaya*.

Namun berikut pilihan alternatif dari katalog saya untuk *Sewa Hotel Surabaya*:

1. *Surabaya Residential Area Boarding House Rent*
   ![Surabaya Residential Area Boarding House Rent](/assets/image_data/properties/boarding_house.png)
   📍 Lokasi: Residential Area, Surabaya, Jawa Timur
   💰 Harga: *Rp 8.750.000 / month*
   🏠 Tipe: Kos / Boarding House — Sewa
   📐 Luas: bangunan 785 m2, tanah 545 m2
   🏷️ Fasilitas: Laundry Area, Shared Kitchen, Wi-Fi, Security, Bed

2. *Surabaya Industrial Area Apartment Rent*
   ![Surabaya Industrial Area Apartment Rent](/assets/image_data/properties/apartment.png)
   📍 Lokasi: Industrial Area, Surabaya, Jawa Timur
   💰 Harga: *Rp 5.500.000 / month*
   🏠 Tipe: Apartemen — Sewa
   📐 Luas: bangunan 53 m2, tanah N/A
   🏷️ Fasilitas: Lift, Wi-Fi, AC, Furnished, Gym

[... hingga 6 properti total ...]

Saya siap membantu Anda menemukan rumah, villa, apartemen, atau properti
lainnya yang cocok untuk Anda.
Apakah ada yang ingin Anda tanyakan lebih lanjut?


Salam hangat,
*LEO FELIX*
*Elevan Property*
```

---

## Format per Item (catalogItemWhatsApp)

```javascript
// Template untuk setiap item properti
`${index + 1}. *${item.title}*
   ![${item.title}](${item.imageUrl})   ← Ada jika imageUrl tersedia
   📍 Lokasi: ${location}
   💰 Harga: *${item.price}*
   🏠 Tipe: ${buildingType} — ${transactionType}
   📐 Luas: bangunan ${item.buildingArea}, tanah ${item.landArea}
   🏷️ Fasilitas: ${item.facilities}`
```

Perbedaan dengan `catalogItem()` biasa (untuk web):
```javascript
// Web: markdown bold
`${index + 1}. **${item.title}**`
`   💰 ${isId ? 'Harga' : 'Price'}: **${item.price}**`

// WhatsApp: asterik bold + images
`${index + 1}. *${item.title}*`
`   ![${item.title}](${item.imageUrl})`
`   💰 Harga: *${item.price}*`
```

---

## Footer (addFooter)

Ditambahkan di akhir setiap response:

```javascript
// Bahasa Indonesia
`\n\nSaya siap membantu Anda menemukan rumah, villa, apartemen, atau properti ` +
`lainnya yang cocok untuk Anda.\nApakah ada yang ingin Anda tanyakan lebih lanjut?` +
`\n\n\nSalam hangat,\n*${agentName}*\n*Elevan Property*`

// English
`\n\nWe are ready to help you find a house, villa, apartment, or other property ` +
`that suits you.\nWould you like to know more details?` +
`\n\n\nWarm regards,\n*${agentName}*\n*Elevan Property*`
```

---

## Perbedaan Exact Match vs Alternative

### exactMatch (ada hasil di Rumah123 atau catalog)

```
Berikut *3 pilihan [summary]* terbaik dari *Rumah123* (data terkini):

1. *Nama Properti*
   ...

Salam hangat, *LEO FELIX* ...
```

### alternative (Rumah123 kosong, tampilkan alternatif dari catalog)

```
⚠️ Maaf, belum ada listing yang tersedia di *[kota]* dari Rumah123
untuk *[summary]*.

Namun berikut pilihan alternatif dari katalog saya untuk *[summary]*:

1. *Nama Properti*
   ...

Salam hangat, *LEO FELIX* ...
```

### Tidak Ada Sama Sekali

```
Maaf, saat ini belum ada properti yang sesuai dengan *[summary]* di *[kota]*
di katalog maupun Rumah123. Apakah Anda ingin mencoba lokasi, tipe properti,
atau range harga lain?

Salam hangat, *LEO FELIX* ...
```

---

## Image URL Convention

Image path dari `imageUrl` field di flat JSON:

```
/assets/image_data/properties/[tipe].png
```

Contoh tipe yang dikenal:
```
apartment.png
house.png
villa.png
boarding_house.png
warehouse.png
office.png
land.png
shophouse.png
hotel.png
```

Jika `imageUrl` kosong/null → baris image dilewati.

---

## Terminal Logging (whatsappAIService)

Saat Private Agent digunakan:

```javascript
console.log(
  `[WhatsAppAI] Private Agent (terminal message) used ` +
  `(${result.exactMatches || 0} exact, ` +
  `${result.alternatives || 0} alt, ` +
  `${result.rumah123Listings || 0} rumah123)`
);
```

Dan di server terminal (jika MASSEGE_TERMINAL aktif):

```
[WHATSAPP PRIVATE AGENT ACTIVE] {
  reason:    'ChatGPT and Claude unavailable for WhatsApp reply',
  sessionId: 123,
  language:  'id',
  agent:     'LEO FELIX'
}
```

---

## Cara Menambah/Mengubah Agent Footer

Nama agent otomatis diambil dari DB (`users.name`) dan dipass ke `generateResponseForTerminalMassege`:

```javascript
// Di fonnteChatController (setelah agent ditemukan):
const result = await generateWhatsAppAIReply({
  session,
  message,
  agentName: agent.name,   // ← "LEO FELIX" dari DB
});

// Di whatsappAIService (fallback ke Private Agent):
const result = await generatePrivateTerminalMassege({
  ...
  agentName: agentName,    // ← "LEO FELIX" diteruskan
});

// Di ResponseBuilderWhatsApp:
constructor(lang = 'en', agentName = 'Elevan Property')
// agentName = "LEO FELIX" → muncul di footer
```
