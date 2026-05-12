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
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { sendChatbotMessage } from '../services/chatbotApi';

const PHONE_ALLOWED_REGEX = /[^0-9+\-\s]/g;
const JSON_DATA_URL = '/json_data/indonesia_property_36_provinces_flat.json';
const PROFILE_COOKIE_NAME = 'propertyChatProfile';
const PROFILE_COOKIE_TTL_SECONDS = 20 * 60;

// Max properties to include in the first-chat context payload to ChatGPT.
// Sending all 7,920 records would be very large; send a compact JSON-derived context.
const CONTEXT_SAMPLE_SIZE = 50;

const isOpen = ref(false);
const isSending = ref(false);
const profileReady = ref(false);
const draft = ref('');
const errorMessage = ref('');
const messagesContainer = ref(null);
/** True after the first chat message has been sent (context already embedded). */
const contextSentOnce = ref(false);
let profileExpiryTimer = null;

const profile = reactive({
  name: '',
  phone: ''
});

const createInitialMessages = () => ([
  {
    role: 'assistant',
    text: 'Hello! I can help you buy, sell, or rent properties such as houses, villas, hotels, apartments, and boarding houses.'
  }
]);

const messages = ref(createInitialMessages());

const sanitizePhone = () => {
  profile.phone = String(profile.phone || '').replace(PHONE_ALLOWED_REGEX, '');
};

function setCookie(name, value, maxAgeSeconds) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

function deleteCookie(name) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function readCookie(name) {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch (_) {
    return null;
  }
}

function getSavedProfileFromCookie() {
  const raw = readCookie(PROFILE_COOKIE_NAME);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.name || !parsed.phone || !parsed.expiresAt || Date.now() >= Number(parsed.expiresAt)) {
      deleteCookie(PROFILE_COOKIE_NAME);
      return null;
    }
    return parsed;
  } catch (_) {
    deleteCookie(PROFILE_COOKIE_NAME);
    return null;
  }
}

function clearProfileExpiryTimer() {
  if (profileExpiryTimer) {
    window.clearTimeout(profileExpiryTimer);
    profileExpiryTimer = null;
  }
}

function resetChatProfile(message = '') {
  clearProfileExpiryTimer();
  deleteCookie(PROFILE_COOKIE_NAME);
  profile.name = '';
  profile.phone = '';
  profileReady.value = false;
  contextSentOnce.value = false;
  messages.value = createInitialMessages();
  if (message) errorMessage.value = message;
}

function scheduleProfileExpiry(expiresAt) {
  clearProfileExpiryTimer();
  const remaining = Number(expiresAt) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) {
    resetChatProfile('Your chat session expired after 20 minutes. Please enter your name and phone number again.');
    return;
  }

  profileExpiryTimer = window.setTimeout(() => {
    resetChatProfile('Your chat session expired after 20 minutes. Please enter your name and phone number again.');
  }, remaining);
}

function saveProfileCookie() {
  const expiresAt = Date.now() + (PROFILE_COOKIE_TTL_SECONDS * 1000);
  const value = JSON.stringify({
    name: profile.name,
    phone: profile.phone,
    expiresAt
  });
  setCookie(PROFILE_COOKIE_NAME, value, PROFILE_COOKIE_TTL_SECONDS);
  scheduleProfileExpiry(expiresAt);
}

function ensureProfileCookieIsValid() {
  const saved = getSavedProfileFromCookie();
  if (!saved) {
    resetChatProfile('Your chat session expired after 20 minutes. Please enter your name and phone number again.');
    return false;
  }
  return true;
}

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
  saveProfileCookie();
  profileReady.value = true;
};

function normalizeSearchText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function propertySearchText(property) {
  return normalizeSearchText([
    property.title,
    property.description,
    property.price,
    property.address,
    property.building_type,
    property.transaction_type,
    property.location?.province,
    property.location?.city,
    property.location?.area,
    Array.isArray(property.facilities) ? property.facilities.join(' ') : property.facilities
  ].filter(Boolean).join(' '));
}

function scorePropertyForMessage(property, message) {
  const query = normalizeSearchText(message);
  const searchable = propertySearchText(property);
  const tokens = query.split(' ').filter((token) => token.length >= 4);

  let score = 0;
  tokens.forEach((token) => {
    if (searchable.includes(token)) score += 1;
  });

  if (query.includes('sewa') || query.includes('rent')) {
    if (property.transaction_type === 'rent') score += 5;
  }
  if (query.includes('jual') || query.includes('beli') || query.includes('sale') || query.includes('purchase')) {
    if (['sale', 'purchase'].includes(property.transaction_type)) score += 4;
  }
  if ((query.includes('rumah') || query.includes('house')) && property.building_type === 'house') score += 5;
  if (query.includes('villa') && property.building_type === 'villa') score += 5;
  if (query.includes('hotel') && property.building_type === 'hotel') score += 5;
  if ((query.includes('apartemen') || query.includes('apartment')) && property.building_type === 'apartment') score += 5;
  if ((query.includes('kos') || query.includes('kost')) && property.building_type === 'boarding_house') score += 5;
  if ((query.includes('ruko') || query.includes('shophouse')) && property.building_type === 'shophouse') score += 5;
  if ((query.includes('kantor') || query.includes('office')) && property.building_type === 'office') score += 5;
  if ((query.includes('gudang') || query.includes('warehouse')) && property.building_type === 'warehouse') score += 5;
  if ((query.includes('lainnya') || query.includes('others') || query.includes('other')) && property.building_type === 'others') score += 5;

  return score;
}

function simplifyPropertyForContext(property) {
  return {
    id: property.id,
    title: property.title,
    building_type: property.building_type,
    transaction_type: property.transaction_type,
    price: property.price,
    province: property.location?.province || '',
    city: property.location?.city || '',
    area: property.location?.area || '',
    facilities: Array.isArray(property.facilities) ? property.facilities.slice(0, 3).join(', ') : '',
    building_area: property.building_area,
    land_area: property.land_area
  };
}

/**
 * Load compact property context from the Indonesia property JSON file.
 * For the first chat message, prioritize records relevant to the user's text.
 */
async function loadPropertyContextSample(userMessage = '') {
  try {
    const res = await fetch(JSON_DATA_URL);
    if (!res.ok) throw new Error(`Property JSON request failed: ${res.status}`);

    const json = await res.json();
    const properties = Array.isArray(json.properties) ? json.properties : [];

    const scored = properties
      .map((property) => ({ property, score: scorePropertyForMessage(property, userMessage) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, CONTEXT_SAMPLE_SIZE)
      .map((item) => simplifyPropertyForContext(item.property));

    let selected = scored;
    let selectionStrategy = 'relevant_to_first_message';

    if (!selected.length) {
      const step = Math.max(1, Math.floor(properties.length / CONTEXT_SAMPLE_SIZE));
      selected = [];
      for (let i = 0; i < properties.length && selected.length < CONTEXT_SAMPLE_SIZE; i += step) {
        selected.push(simplifyPropertyForContext(properties[i]));
      }
      selectionStrategy = 'evenly_distributed_sample';
    }

    return {
      sourceFile: 'frontend/public/json_data/indonesia_property_36_provinces_flat.json',
      totalRecords: properties.length,
      sampleSize: selected.length,
      selectionStrategy,
      properties: selected
    };
  } catch (_) {
    return null;
  }
}

const sendMessage = async () => {
  if (!draft.value || isSending.value) return;
  if (!ensureProfileCookieIsValid()) return;

  const userText = draft.value;
  draft.value = '';
  errorMessage.value = '';
  messages.value.push({ role: 'user', text: userText });
  await scrollToBottom();

  isSending.value = true;
  try {
    // On the very first chat message, load the property JSON and include it as
    // context in the request payload sent to the backend / ChatGPT.
    let propertyContext = null;
    if (!contextSentOnce.value) {
      propertyContext = await loadPropertyContextSample(userText);
      contextSentOnce.value = true;
    }

    const payload = {
      name: profile.name,
      phone: profile.phone,
      message: userText
    };

    // Attach the property catalog context when available (first message only).
    if (propertyContext) {
      payload.propertyContext = propertyContext;
    }

    const response = await sendChatbotMessage(payload);
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
  const saved = getSavedProfileFromCookie();
  if (saved) {
    profile.name = saved.name || '';
    profile.phone = saved.phone || '';
    profileReady.value = Boolean(profile.name && profile.phone);
    scheduleProfileExpiry(saved.expiresAt);
  }
});

onBeforeUnmount(() => {
  clearProfileExpiryTimer();
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
