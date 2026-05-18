# 11. Module: Chatbot

## Floating Chatbot Widget

```
Chatbot Module
├── Floating Button
│   └── Toggle open/close
│
├── Chat Window
│   ├── Header (title, close button)
│   ├── Messages area (scrollable)
│   ├── Input field
│   └── Send button
│
├── Session Management
│   ├── Store sessionId in cookie
│   ├── Load chat history
│   └── Maintain context
│
└── Context Persistence
    ├── Remember user location
    ├── Remember property preferences
    └── Restore conversation
```

## Component Template

```vue
<template>
  <div class="floating-chatbot">
    <div v-if="isOpen" class="chatbot-window">
      <div class="header">
        <h3>Property Assistant</h3>
        <button @click="isOpen = false">×</button>
      </div>
      <div class="messages">
        <div v-for="msg in messages" :key="msg.id" :class="msg.role">
          {{ msg.text }}
        </div>
      </div>
      <div class="input-area">
        <input 
          v-model="userMessage" 
          @keyup.enter="sendMessage" 
          placeholder="Ask about properties..."
        />
        <button @click="sendMessage">Send</button>
      </div>
    </div>
    <button v-else @click="isOpen = true" class="toggle">💬</button>
  </div>
</template>
```

## Chatbot Logic

```javascript
export function useChatbot() {
  const isOpen = ref(false);
  const messages = ref([]);
  const userMessage = ref('');
  const sessionId = ref(localStorage.getItem('chatbot_session') || '');

  async function sendMessage() {
    if (!userMessage.value) return;

    messages.value.push({
      id: Date.now(),
      role: 'user',
      text: userMessage.value
    });

    const response = await chatbotApi.sendMessage(
      userMessage.value, 
      sessionId.value
    );

    messages.value.push({
      id: Date.now() + 1,
      role: 'assistant',
      text: response.text
    });

    sessionId.value = response.sessionId;
    localStorage.setItem('chatbot_session', sessionId.value);
    userMessage.value = '';
  }

  return { isOpen, messages, userMessage, sendMessage };
}
```

## Features

- Floating widget (bottom-right)
- Session persistence
- Chat history
- Property recommendations
- Click to open/close
- Mobile optimized
- Smooth animations

## Context Management

- Store sessionId in localStorage
- Load previous messages
- Maintain user preferences
- Handle session timeout

## API Integration

- POST /api/chatbot - Send message
- GET /api/chatbot/history/:sessionId - Load history
