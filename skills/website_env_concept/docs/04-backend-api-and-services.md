# 04. Backend API & Services

## Services Architecture

### AIService
```javascript
async generateResponse(prompt, sessionData) {
  // Select ChatGPT or Claude
  // Handle fallback if primary fails
  // Return response
}
```

### PromptService
```javascript
async loadSkill(provider) {
  // Load unified skill files (SKILL.md + 7 docs)
  // Cache in memory
}

async composePrompt(message, sessionData) {
  // Build complete prompt with context + catalog
}
```

### PropertyService
```javascript
async filterProperties(criteria) {
  // Filter by type, location, budget, facilities
}
```

### SessionService
```javascript
async getOrCreateSession(phone, userData) {
  // Manage user sessions and history
}
```

### FonnteService
```javascript
async sendMessage(phoneNumber, message) {
  // Send to WhatsApp via Fonnte
}
```

## API Routes

```
POST /api/chatbot - Chat message
GET  /api/chatbot/history/:sessionId - Chat history
POST /api/contact - Contact submission
POST /api/webhook/fonnte - WhatsApp webhook
GET  /api/catalog - Property catalog
```

## Controllers

### Chatbot Controller
```javascript
async handleChatMessage(req, res) {
  // 1. Validate input
  // 2. Get/create session
  // 3. Load properties
  // 4. Compose prompt
  // 5. Get AI response
  // 6. Save history
  // 7. Return response
}
```

### Contact Controller
```javascript
async handleContactSubmission(req, res) {
  // 1. Validate form
  // 2. Save to Sheets (non-blocking)
  // 3. Send WhatsApp notification
  // 4. Return immediately
}
```

## Request Flow

1. Client sends request to /api endpoint
2. Controller validates & processes
3. Services handle business logic
4. Database/API calls made
5. Response formatted & returned
6. History saved (async)
