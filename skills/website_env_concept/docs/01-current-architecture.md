# 01 — Current Architecture

## Main Stack

```text
Frontend: VueJS, Vue Router, Axios, Vite
Backend: NodeJS, ExpressJS, Sequelize, MySQL
External APIs: Google Sheets, OpenAI / ChatGPT, Fonnte
Data Source: JSON property catalog
```

## Main Pages

```text
/
 /about
 /contact
```

## Main Frontend Modules

```text
HomeView.vue
AboutView.vue
ContactView.vue
FloatingChatbot.vue
Navbar.vue
PortfolioCard.vue
PropertyFilter.vue
```

## Main Backend Modules

```text
server.js
routes/index.js
controllers/
models/
services/
utils/
```

## Main Flow

```text
User opens website
→ user views Home / About Us / Contact
→ About Us loads property data from JSON
→ user opens chatbot
→ user enters name, phone, and location
→ frontend stores chatbot profile cookie based on backend TTL
→ frontend sends chat to backend
→ backend loads property JSON and conversation history
→ backend sends filtered property context to ChatGPT
→ ChatGPT generates response
→ frontend displays response
→ optional WhatsApp response is sent through Fonnte
```
