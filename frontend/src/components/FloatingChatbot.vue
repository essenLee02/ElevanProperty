<template>
  <div class="floating-chatbot">
    <button v-if="!isOpen" class="chat-toggle" type="button" @click="isOpen = true">
      Chat
    </button>

    <div v-else class="chat-window">
      <div class="chat-header">
        <div>
          <strong>Property Assistant</strong>
          <small>Ask about buying, selling, or renting property</small>
        </div>
        <button type="button" class="chat-close" @click="isOpen = false">×</button>
      </div>

      <div v-if="!profileReady" class="chat-profile">
        <p class="mb-2">Please enter your name and phone number before chatting.</p>
        <input v-model.trim="profile.name" class="form-control mb-2" placeholder="Name" />
        <input v-model="profile.phone" class="form-control mb-2" placeholder="Phone" inputmode="tel" @input="sanitizePhone" />
        <button class="btn primary-btn rounded-full w-100" type="button" @click="startChat">Start Chat</button>
        <p v-if="errorMessage" class="text-danger small mt-2">{{ errorMessage }}</p>
      </div>

      <template v-else>
        <div ref="messagesContainer" class="chat-messages">
          <div v-for="(item, index) in messages" :key="index" :class="['chat-message', item.role]">
            <span>{{ item.text }}</span>
          </div>
        </div>
        <form class="chat-input" @submit.prevent="sendMessage">
          <input v-model.trim="draft" type="text" placeholder="Type your property question..." :disabled="isSending" />
          <button type="submit" :disabled="isSending || !draft">{{ isSending ? '...' : 'Send' }}</button>
        </form>
        <p v-if="errorMessage" class="text-danger small px-3 pb-2 mb-0">{{ errorMessage }}</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue';
import { sendChatbotMessage } from '../services/chatbotApi'; // Tampilan Chatbot AI

const PHONE_ALLOWED_REGEX = /[^0-9+\-\s]/g;

const isOpen = ref(false);
const isSending = ref(false);
const profileReady = ref(false);
const draft = ref('');
const errorMessage = ref('');
const messagesContainer = ref(null);

const profile = reactive({
  name: '',
  phone: ''
});

const messages = ref([
  {
    role: 'assistant',
    text: 'Hello! I can help you buy, sell, or rent properties such as houses, villas, hotels, apartments, and boarding houses.'
  }
]);

const sanitizePhone = () => {
  profile.phone = String(profile.phone || '').replace(PHONE_ALLOWED_REGEX, '');
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const startChat = () => {
  errorMessage.value = '';
  sanitizePhone();
  if (!profile.name.trim() || !profile.phone.trim()) {
    errorMessage.value = 'Name and phone are required.';
    return;
  }
  localStorage.setItem('propertyChatProfile', JSON.stringify({ name: profile.name, phone: profile.phone }));
  profileReady.value = true;
};

const sendMessage = async () => {
  if (!draft.value || isSending.value) return;
  const userText = draft.value;
  draft.value = '';
  errorMessage.value = '';
  messages.value.push({ role: 'user', text: userText });
  await scrollToBottom();

  isSending.value = true;
  try {
    const response = await sendChatbotMessage({
      name: profile.name,
      phone: profile.phone,
      message: userText
    });
    messages.value.push({ role: 'assistant', text: response.data?.reply || 'Thank you. Our team will follow up soon.' });
  } catch (error) {
    const message = error.response?.data?.message || 'The chatbot could not reply right now. Please try again.';
    errorMessage.value = message;
    messages.value.push({ role: 'assistant', text: message });
  } finally {
    isSending.value = false;
    await scrollToBottom();
  }
};

onMounted(() => {
  const saved = localStorage.getItem('propertyChatProfile');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      profile.name = parsed.name || '';
      profile.phone = parsed.phone || '';
      profileReady.value = Boolean(profile.name && profile.phone);
    } catch (error) {
      localStorage.removeItem('propertyChatProfile');
    }
  }
});
</script>

<style scoped>
.floating-chatbot {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: 9999;
  font-family: inherit;
}
.chat-toggle {
  border: 0;
  border-radius: 999px;
  padding: 14px 22px;
  background: #155bd5;
  color: #fff;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.18);
  font-weight: 700;
}
.chat-window {
  width: 360px;
  max-width: calc(100vw - 32px);
  height: 520px;
  max-height: calc(100vh - 60px);
  background: #fff;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
}
.chat-header {
  background: #155bd5;
  color: #fff;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.chat-header small {
  display: block;
  opacity: 0.85;
}
.chat-close {
  background: transparent;
  border: 0;
  color: #fff;
  font-size: 28px;
  line-height: 1;
}
.chat-profile {
  padding: 18px;
}
.chat-messages {
  flex: 1;
  padding: 14px;
  overflow-y: auto;
  background: #f5f7fb;
}
.chat-message {
  display: flex;
  margin-bottom: 10px;
}
.chat-message span {
  max-width: 82%;
  padding: 10px 12px;
  border-radius: 14px;
  display: inline-block;
  line-height: 1.4;
  white-space: pre-line;
}

.chat-message.assistant {
  justify-content: flex-start;
}
.chat-message.assistant span {
  background: #fff;
  color: #333;
}
.chat-message.user {
  justify-content: flex-end;
}
.chat-message.user span {
  background: #155bd5;
  color: #fff;
}
.chat-input {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e7e7e7;
}
.chat-input input {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 999px;
  padding: 10px 12px;
}
.chat-input button {
  border: 0;
  background: #155bd5;
  color: #fff;
  border-radius: 999px;
  padding: 10px 14px;
}
</style>
