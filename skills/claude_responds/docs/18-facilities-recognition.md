# 18 — Facilities Recognition & Multilingual Support

**Version:** v1.0 — 2026-06-30 (273 facilities database)  
**Applies to:** Claude response skill  
**Integration point:** Q_FAC (Facilities question) + Property filtering  
**Reference data:** `facilities` master table (273 entries)  
**Language support:** Indonesian 🇮🇩 + English 🇬🇧

---

## Overview

The chatbot recognizes and recommends facilities (amenities, infrastructure, utilities) mentioned by customers. The system supports **both Indonesian and English** facility names, emoji icons, and detailed categorization for accurate property matching.

---

## Multilingual Facility Recognition

### How It Works

**For each customer message:**

1. **Language detection** — Determine if Indonesian or English
   - Indonesian patterns: "fasilitas", "ada", "mau", "butuh"
   - English patterns: "facility", "have", "want", "need"

2. **Facility name extraction** — Match against both Indonesian and English names
   - Example: "AC" matches both ID (AC) and EN (Air Conditioner)
   - Example: "Kolam renang" (ID) = "Swimming pool" (EN)

3. **Normalization** — Convert to standard facility list
   - Remove duplicates (e.g., "AC" and "Air Conditioner" → same)
   - Abbreviations → Full names
   - Common misspellings → Correct names

4. **Icon assignment** — Display emoji for quick visual reference
   - AC → ❄️
   - Gym → 🏋️
   - Pool → 🏊

---

## 📋 Facilities by Category (273 total)

### 🛏️ Bedroom & Bedding (10 facilities)

| ID | Facility (ID) | Facility (EN) | Icon |
|----|---------------|---------------|------|
| 127 | MASTER BEDROOM | Master Bedroom | 🛏️ |
| 128 | GUEST BEDROOM | Guest Bedroom | 🛏️ |
| 129 | KIDS BEDROOM | Kids Bedroom | 🛏️ |
| 130 | BEDROOM CLOSET | Bedroom Closet | 👗 |
| 131 | BEDROOM ENSUITE | Bedroom Ensuite | 🚿 |
| 132 | SECONDARY BEDROOM | Secondary Bedroom | 🛌 |
| 133 | STUDIO BEDROOM | Studio Bedroom | 🛏️ |
| 134 | BEDROOM BALCONY | Bedroom Balcony | 🏠 |
| 135 | BEDROOM WINDOW | Bedroom Window | 🪟 |
| 136 | BEDROOM DOOR | Bedroom Door | 🚪 |

### 🚿 Bathroom & Water (20+ facilities)

| ID | Facility (ID) | Facility (EN) | Icon |
|----|---------------|---------------|------|
| 137 | BATHROOM | Bathroom | 🚿 |
| 138 | SHOWER ROOM | Shower Room | 🚿 |
| 139 | BATH TUB | Bath Tub | 🛁 |
| 140 | JACUZZI TUB | Jacuzzi Tub | 🛁 |
| 141 | SHOWER HEAD | Shower Head | 🚿 |
| 142 | BATHROOM SINK | Bathroom Sink | 🚰 |
| 195 | ACCESSIBLE BATHROOM | Accessible Bathroom | ♿ |
| 196 | THERMAL SPRING | Thermal Spring | 🛀 |
| 208 | JACUZZI | Jacuzzi | 🛁 |
| 249 | SPA TUB | Spa Tub | 🛁 |
| 30 | SHOWER | Shower | 🚿 |
| 58 | OUTDOOR SHOWER | Outdoor Shower | 🚿 |
| 66 | PRIVATE BATHROOM | Private Bathroom | 🚿 |
| 68 | SHARED BATHROOM | Shared Bathroom | 🚿 |
| 72 | TOILET | Toilet | 🚽 |

### 🍽️ Kitchen & Dining (20+ facilities)

| ID | Facility (ID) | Facility (EN) | Icon |
|----|---------------|---------------|------|
| 4 | KITCHEN SET | Kitchen Set | 🍽️ |
| 27 | KITCHEN | Kitchen | 🍳 |
| 33 | DINING ROOM | Dining Room | 🍽️ |
| 48 | RESTAURANT | Restaurant | 🍽️ |
| 70 | SHARED KITCHEN | Shared Kitchen | 🍳 |
| 84 | PANTRY | Pantry | 🍳 |
| 147 | OVEN | Oven | 🔥 |
| 148 | MICROWAVE | Microwave | 🔬 |
| 149 | DISHWASHER | Dishwasher | 🧼 |
| 150 | REFRIGERATOR | Refrigerator | ❄️ |
| 151 | FREEZER | Freezer | ❄️ |
| 152 | STOVE BURNER | Stove Burner | 🔥 |
| 153 | GAS RANGE | Gas Range | 🔥 |
| 154 | ELECTRIC RANGE | Electric Range | ⚡ |
| 155 | INDUCTION COOKTOP | Induction Cooktop | ⚡ |
| 156 | RANGE HOOD | Range Hood | 💨 |
| 229 | KITCHEN ISLAND | Kitchen Island | 🍳 |

### 🏋️ Fitness & Recreation (25+ facilities)

| ID | Facility (ID) | Facility (EN) | Icon |
|----|---------------|---------------|------|
| 8 | GYM | Gym | 🏋️ |
| 5 | KOLAM RENANG | Swimming Pool | 🏊 |
| 9 | YOGA | Yoga | 🧘 |
| 116 | TENNIS COURT | Tennis Court | 🎾 |
| 110 | SAUNA | Sauna | 🔥 |
| 207 | STEAM ROOM | Steam Room | 💨 |
| 121 | GAME ROOM | Game Room | 🎮 |
| 120 | BILLIARD ROOM | Billiard Room | 🎱 |
| 252 | FITNESS AREA | Fitness Area | 🏋️ |
| 253 | TREADMILL | Treadmill | 🏃 |
| 254 | ELLIPTICAL MACHINE | Elliptical Machine | 🚴 |
| 255 | WEIGHT RACK | Weight Rack | 🏋️ |
| 256 | DUMBBELL SET | Dumbbell Set | 💪 |
| 251 | YOGA ROOM | Yoga Room | 🧘 |
| 250 | MASSAGE CHAIR | Massage Chair | 🪑 |

### 🌳 Garden & Outdoor (15+ facilities)

| ID | Facility (ID) | Facility (EN) | Icon |
|----|---------------|---------------|------|
| 26 | GARDEN | Garden | 🌳 |
| 42 | ROOFTOP GARDEN | Rooftop Garden | 🌳 |
| 162 | PATIO | Patio | 🌳 |
| 163 | TERRACE | Terrace | 🌳 |
| 164 | BALCONY | Balcony | 🏠 |
| 165 | DECK | Deck | 🌳 |
| 166 | VERANDA | Veranda | 🏠 |
| 167 | GARDEN | Garden | 🌳 |
| 168 | LANDSCAPING | Landscaping | 🌿 |
| 169 | FLOWER BED | Flower Bed | 🌺 |
| 170 | VEGETABLE GARDEN | Vegetable Garden | 🥬 |
| 171 | HERB GARDEN | Herb Garden | 🌿 |
| 223 | ROOFTOP TERRACE | Rooftop Terrace | 🏠 |
| 224 | OUTDOOR KITCHEN | Outdoor Kitchen | 🍳 |
| 225 | BBQ GRILL | BBQ Grill | 🔥 |

### 🅿️ Parking & Access (10+ facilities)

| ID | Facility (ID) | Facility (EN) | Icon |
|----|---------------|---------------|------|
| 25 | PARKING | Parking | 🚗 |
| 172 | GARAGE | Garage | 🚗 |
| 173 | COVERED CARPORT | Covered Carport | 🚗 |
| 174 | PARKING SPACE | Parking Space | 🚗 |
| 175 | BIKE RACK | Bike Rack | 🚲 |
| 176 | MOTORCYCLE PARKING | Motorcycle Parking | 🏍️ |
| 34 | CARPORT | Carport | 🚗 |
| 3 | PARKIR SEPEDA MOTOR | Motorcycle Parking | 🏍️ |
| 92 | TRUCK ACCESS | Truck Access | 🚚 |

### 🔐 Security & Technology (20+ facilities)

| ID | Facility (ID) | Facility (EN) | Icon |
|----|---------------|---------------|------|
| 2 | SECURITY | Security | 🔐 |
| 6 | CCTV 24 JAM | CCTV 24 Hours | 📹 |
| 22 | CCTV | CCTV | 📹 |
| 185 | ALARM SYSTEM | Alarm System | 🚨 |
| 186 | CCTV CAMERA | CCTV Camera | 📹 |
| 187 | VIDEO INTERCOM | Video Intercom | 📱 |
| 188 | SMART LOCK | Smart Lock | 🔐 |
| 189 | MOTION SENSOR | Motion Sensor | 📡 |
| 12 | WI-FI | Wi-Fi | 📶 |
| 16 | SMART HOME | Smart Home | 🏠 |
| 24 | SMART TV | Smart TV | 📺 |
| 81 | SERVER ROOM | Server Room | 💻 |
| 112 | SMART HOME SYSTEM | Smart Home System | 🏠 |
| 113 | SECURITY 24H | Security 24H | 🔐 |

### ⚡ Utilities & Infrastructure (15+ facilities)

| ID | Facility (ID) | Facility (EN) | Icon |
|----|---------------|---------------|------|
| 29 | PLN ELECTRICITY | PLN Electricity | ⚡ |
| 37 | PDAM WATER | PDAM Water | 💧 |
| 80 | ELECTRICITY | Electricity | ⚡ |
| 197 | ELECTRICAL PANEL | Electrical Panel | ⚡ |
| 198 | CIRCUIT BREAKER | Circuit Breaker | ⚡ |
| 199 | BACKUP GENERATOR | Backup Generator | ⚙️ |
| 200 | SOLAR PANELS | Solar Panels | ☀️ |
| 201 | CENTRAL AC | Central AC | ❄️ |
| 202 | HEATING SYSTEM | Heating System | 🔥 |
| 263 | HVAC SYSTEM | HVAC System | ⚙️ |

### 👶 Kids & Family (5+ facilities)

| ID | Facility (ID) | Facility (EN) | Icon |
|----|---------------|---------------|------|
| 7 | KIDS ZONE | Kids Zone | 🧒 |
| 209 | DOG PARK | Dog Park | 🐕 |
| 210 | PET AREA | Pet Area | 🐾 |
| 219 | RECREATION AREA | Recreation Area | 🎪 |

### 🌃 Common/High-Demand Facilities (Most Recognized)

These are frequently mentioned by customers:

```
❄️  AC / Air Conditioner        🍳  Kitchen Set
🚿  Shower / Bathroom           🏊  Swimming Pool / Kolam Renang
🛁  Bathtub / Jacuzzi           🏋️  Gym / Fitness
🧘  Yoga                        📶  WiFi
🚗  Parking / Parkir            🔐  Security / CCTV
💧  Water Supply / PDAM         ⚡  Electricity / PLN
🌳  Garden / Taman              🚪  Door / Gate
🛋️  Living Room / Sofa          🛏️  Bed / Tempat Tidur
🍷  Bar / Wine Cellar           📺  Smart TV
🔥  Fireplace / Heating         🍽️  Dining Room / Restaurant
```

---

## 🌐 Multilingual Patterns

### Indonesian Facility Recognition

**Common phrases:**
```
"Ada AC, WiFi, dan CCTV"          → AC, WiFi, CCTV
"Fasilitas standar aja"            → Standard amenities
"Lengkap dengan kitchen set"       → Kitchen Set included
"Mau yang ada gym dan kolam"       → Gym, Swimming Pool
"Perlu AC dan kamar mandi"         → AC, Bathroom
"Ada gerbang keamanan 24 jam"      → Security 24H, Gate
"Fasilitas kolam renang dan yoga"  → Swimming Pool, Yoga
```

### English Facility Recognition

**Common phrases:**
```
"I need AC and WiFi"               → AC, WiFi
"Furnished with kitchen"           → Kitchen
"Gym and pool access"              → Gym, Pool
"24-hour security system"          → Security 24H
"Parking included"                 → Parking
"Air conditioning required"        → AC
"Swimming pool is important"       → Swimming Pool
```

---

## ✅ Response Format

### When Customer Mentions Facilities

**Indonesian context:**
```
Customer: "Saya mau tempat yang ada AC, WiFi, dan kolam renang"
AI Response:
"Baik, saya catat fasilitas yang Anda inginkan: AC, WiFi, dan Kolam Renang. 
Saya cari yang memiliki ketiga fasilitas tersebut ya! 👍"

Summary line:
✓ Fasilitas: *AC, WiFi, Kolam Renang*
```

**English context:**
```
Customer: "I need a place with AC, WiFi, and a gym"
AI Response:
"Got it! I've noted your preferred facilities: AC, WiFi, and Gym. 
I'll find properties with all three! 👍"

Summary line:
✓ Facilities: *AC, WiFi, Gym*
```

### Standard vs. Specific Facilities

**Standard (when customer answers "standar" or "whatever"):**
```
Customer: "Fasilitas standar aja"
Summary:
✗ Fasilitas: *AC, Kitchen Set, CCTV Camera, Lemari, Kamar Mandi, Kulkas, 
            One Gate System (Fasilitas Standar)*
```

**Never asked:**
```
If Q_FAC was never mentioned:
✗ Fasilitas: (Belum ditanyakan)
```

---

## 🔄 Language Switch Handling

**If customer switches languages mid-conversation:**

1. **Detect the language change** — Analyze the current message
2. **Validate previous context** — Ensure facility names are still understood
3. **Continue naturally** — Respond in the customer's current language
4. **Maintain facility records** — Store canonical English names internally

**Example:**
```
Turn 1 (Indonesian):
Customer: "Saya mau AC dan WiFi"
AI: "Baik, AC dan WiFi ya. Fasilitas lain?"

Turn 2 (English):
Customer: "Also need a gym"
AI: "Perfect! AC, WiFi, and Gym. Any other facilities?"
```

---

## 📊 Common Misspellings & Normalizations

| Misspelling | Correct Form | Facility |
|-------------|--------------|----------|
| "AC" | Air Conditioner | ❄️ |
| "WiFi" / "Wifi" | Wi-Fi | 📶 |
| "Kolam" | Kolam Renang | 🏊 |
| "Kamar mandi" | Bathroom | 🚿 |
| "Parkir" | Parking | 🅿️ |
| "CCTV" | CCTV Camera | 📹 |
| "Gym" / "Fitness" | Gym | 🏋️ |
| "Jacuzzi" | Jacuzzi Tub | 🛁 |
| "One gate" | One Gate System | 🚪 |
| "Lemari" | Wardrobe/Storage | 📦 |

---

## 🚀 Implementation Tips for Claude

1. **Always normalize** facility names to canonical English form internally
2. **Preserve customer language** in responses (answer in their language)
3. **Use emoji** for visual clarity (icon from facilities table)
4. **Combine duplicates** (AC + Air Conditioner = one entry)
5. **Handle abbreviations** (A/C, WiFi, etc. → standard name)
6. **Never invent facilities** — only use items from the 273-facility database
7. **Accept variations** — both Indonesian and English names for same facility

---

## ✨ Quick Reference

**For Claude API:**
- Load all 273 facilities into system context during initialization
- Map customer input to facility IDs for database lookups
- Respond with customer's language but store canonical English names
- Include emoji icons in customer-facing output for visual clarity
- Support seamless code-switching between Indonesian and English

