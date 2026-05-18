# 07. Frontend Architecture & Setup

## Vue 3 + Vite Setup

```bash
npm create vite@latest frontend -- --template vue
npm install axios vue-router pinia
```

## Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── HomeModule.vue
│   │   ├── AboutModule.vue
│   │   ├── ContactModule.vue
│   │   └── ChatbotModule.vue
│   ├── composables/
│   │   ├── useChatbot.js
│   │   ├── useProperty.js
│   │   └── useSession.js
│   ├── api/
│   │   ├── chatbot.js
│   │   ├── contact.js
│   │   └── catalog.js
│   ├── App.vue
│   ├── main.js
│   └── style.css
└── vite.config.js
```

## API Services

```javascript
// api/chatbot.js
export async function sendMessage(message, sessionId) {
  const response = await axios.post('/api/chatbot', { message, sessionId });
  return response.data;
}

export async function getHistory(sessionId) {
  const response = await axios.get(`/api/chatbot/history/${sessionId}`);
  return response.data;
}
```

## Composables

```javascript
// composables/useChatbot.js
export function useChatbot() {
  const messages = ref([]);
  const sessionId = ref(localStorage.getItem('sessionId') || '');
  
  async function sendMessage(text) {
    const response = await chatbotApi.sendMessage(text, sessionId.value);
    messages.value.push({ role: 'assistant', text: response });
    sessionId.value = response.sessionId;
    localStorage.setItem('sessionId', sessionId.value);
  }

  return { messages, sendMessage };
}
```

## Environment Variables

```env
VITE_API_URL=http://localhost:3000/api
VITE_ENABLE_CHATBOT=true
VITE_CHATBOT_POSITION=bottom-right
```
