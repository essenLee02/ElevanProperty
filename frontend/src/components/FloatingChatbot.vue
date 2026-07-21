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
        <p class="mb-2">Please enter your name, phone number, and location before chatting.</p>
        <input v-model.trim="profile.name"     class="form-control mb-2 form-control-lg form-control-sm" placeholder="Name" />
        <input v-model="profile.phone"          class="form-control mb-2 form-control-lg form-control-sm" placeholder="Phone" inputmode="tel" @input="sanitizePhone" />
        <input v-model.trim="profile.location" class="form-control mb-2 form-control-lg form-control-sm" placeholder="Your location, e.g. Surabaya" />
        <small class="text-muted d-block mb-2">Your chat profile cookie follows the backend .env TTL setting.</small>
        <button class="btn primary-btn rounded-full w-100" type="button" @click="startChat">Start Chat</button>
        <p v-if="errorMessage" class="text-danger small mt-2">{{ errorMessage }}</p>
      </div>

      <template v-else>
        <div ref="messagesContainer" class="chat-messages">
          <div
            v-for="(item, index) in messages"
            :key="index"
            :class="['chat-message', item.role]"
          >
            <!-- v-html is safe: MessageFormatter escapes all HTML before applying markdown transforms -->
            <span v-html="MessageFormatter.format(item.text)"></span>
          </div>
        </div>
        <form class="chat-input" @submit.prevent="sendMessage">
          <input class="form-control form-control-lg form-control-sm" v-model.trim="draft" type="text" placeholder="Type your property question..." :disabled="isSending" />
          <button type="submit" :disabled="isSending || !draft">{{ isSending ? '...' : 'Send' }}</button>
        </form>
        <p v-if="errorMessage" class="text-danger small px-3 pb-2 mb-0">{{ errorMessage }}</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { getChatbotConfig, sendChatbotMessage } from '../services/chatbotApi';

// ─── Constants ────────────────────────────────────────────────────────────────

const PHONE_ALLOWED_REGEX        = /[^0-9+\-\s]/g;
const PROFILE_COOKIE_NAME        = 'propertyChatProfile';
const DEFAULT_COOKIE_TTL_MINUTES = 20;
const DEFAULT_COOKIE_TTL_SECONDS = DEFAULT_COOKIE_TTL_MINUTES * 60;

// Catatan: frontend TIDAK lagi me-load katalog properti dari JSON. Backend yang
// membangun property context dari database (buildRecommendationContextForLLM)
// setiap kali pesan chatbot dikirim — jadi tidak perlu mengirim sampel dari sini.

// ─── MessageFormatter ─────────────────────────────────────────────────────────
/**
 * Converts AI chatbot response text (markdown-like) to safe HTML for v-html rendering.
 *
 * Security pipeline (order matters):
 *  1. escapeHtml   — escape all HTML entities first to block XSS
 *  2. renderImages — ![alt](url)  →  <img class="chat-image" />
 *  3. renderLinks  — [label](url) →  <a target="_blank" class="chat-link">
 *  4. renderBold   — **text**     →  <strong>text</strong>
 *  5. renderDivider — "---" line  →  <hr class="chat-divider" />
 *
 * Only http/https URLs are rendered; all other schemes are silently dropped.
 */
const MessageFormatter = {
  /**
   * Escape HTML special characters to prevent injection from AI-generated content.
   * Must be called before any other transform.
   *
   * @param {*} value - Raw value (any type, coerced to string)
   * @returns {string} HTML-safe string
   */
  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Return true only for http/https URLs (blocks javascript:, data:, etc.)
   *
   * @param {string} url
   * @returns {boolean}
   */
  isSafeUrl(url) {
    return /^https?:\/\//i.test(url);
  },

  /**
   * Render markdown image syntax → <img> tag.
   * ![alt text](https://image-url) becomes <img src="..." alt="..." class="chat-image" />
   * Drops the element entirely when the URL is not http/https.
   *
   * @param {string} text - Already HTML-escaped text
   * @returns {string}
   */
  renderImages(text) {
    return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
      if (!this.isSafeUrl(url)) return '';
      return `<img src="${url}" alt="${alt}" class="chat-image" loading="lazy" />`;
    });
  },

  /**
   * Render markdown link syntax → <a> tag.
   * [label text](https://url) becomes <a href="..." target="_blank" class="chat-link">label text</a>
   * Falls back to plain label text when the URL is not http/https.
   *
   * @param {string} text - Already HTML-escaped text
   * @returns {string}
   */
  renderLinks(text) {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      if (!this.isSafeUrl(url)) return label;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-link">${label}</a>`;
    });
  },

  /**
   * Render markdown bold syntax → <strong> tag.
   * **text** becomes <strong>text</strong>
   *
   * @param {string} text
   * @returns {string}
   */
  renderBold(text) {
    return text.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  },

  /**
   * Render a markdown horizontal rule → <hr>.
   * A line containing only "---" becomes <hr class="chat-divider" />
   *
   * @param {string} text
   * @returns {string}
   */
  renderDivider(text) {
    return text.replace(/^---$/gm, '<hr class="chat-divider" />');
  },

  /**
   * Full rendering pipeline for one chatbot message.
   * Escapes HTML first, then applies each markdown transform in the correct order.
   *
   * @param {*} value - Raw message value from the AI (any type)
   * @returns {string} Safe HTML string ready for v-html binding
   */
  format(value) {
    let text = this.escapeHtml(value);
    text = this.renderImages(text);   // images before links (prevents '![' matching as link start)
    text = this.renderLinks(text);
    text = this.renderBold(text);
    text = this.renderDivider(text);
    return text;
  },
};

// ─── Reactive State ───────────────────────────────────────────────────────────

const isOpen            = ref(false);
const isSending         = ref(false);
const profileReady      = ref(false);
const draft             = ref('');
const errorMessage      = ref('');
const messagesContainer = ref(null);

const profileCookieTtlSeconds = ref(DEFAULT_COOKIE_TTL_SECONDS);
const profileCookieTtlMinutes = ref(DEFAULT_COOKIE_TTL_MINUTES);

const profile = reactive({ name: '', phone: '', location: '' });

let profileExpiryTimer = null;

// ─── Initial Messages ─────────────────────────────────────────────────────────

/**
 * Return the default welcome message shown when a new chat session starts.
 * @returns {Array<{role: string, text: string}>}
 */
const createInitialMessages = () => ([{
  role: 'assistant',
  text: 'Hello! I can help you buy, sell, or rent properties. Please enter your name, phone number, and location to start.',
}]);

const messages = ref(createInitialMessages());

// ─── Cookie Utilities ─────────────────────────────────────────────────────────

/**
 * Write a browser cookie with the given name, URL-encoded value, and max-age.
 *
 * @param {string} name
 * @param {string} value
 * @param {number} maxAgeSeconds
 */
function setCookie(name, value, maxAgeSeconds) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

/**
 * Immediately expire (delete) a browser cookie by setting Max-Age=0.
 *
 * @param {string} name
 */
function deleteCookie(name) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * Read and URL-decode the value of a browser cookie by name.
 * Returns null when the cookie is absent or cannot be decoded.
 *
 * @param {string} name
 * @returns {string|null}
 */
function readCookie(name) {
  const prefix = `${name}=`;
  const match  = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(prefix));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch (_) {
    return null;
  }
}

// ─── Profile Management ───────────────────────────────────────────────────────

/**
 * Strip characters not allowed in a phone number (digits, +, -, spaces only).
 */
const sanitizePhone = () => {
  profile.phone = String(profile.phone || '').replace(PHONE_ALLOWED_REGEX, '');
};

/** Cancel any pending profile-expiry timeout. */
function clearProfileExpiryTimer() {
  if (profileExpiryTimer) {
    window.clearTimeout(profileExpiryTimer);
    profileExpiryTimer = null;
  }
}

/**
 * Reset the chat to the profile entry state and clear all conversation history.
 * Optionally display a message explaining why the session ended.
 *
 * @param {string} [message] - Optional expiry message
 */
function resetChatProfile(message = '') {
  clearProfileExpiryTimer();
  deleteCookie(PROFILE_COOKIE_NAME);
  Object.assign(profile, { name: '', phone: '', location: '' });
  profileReady.value    = false;
  messages.value        = createInitialMessages();
  if (message) errorMessage.value = message;
}

/**
 * Schedule a call to resetChatProfile when the profile cookie will expire.
 *
 * @param {number} expiresAt - Unix timestamp (ms) of cookie expiry
 */
function scheduleProfileExpiry(expiresAt) {
  clearProfileExpiryTimer();
  const remaining = Number(expiresAt) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) {
    resetChatProfile('Your chat session expired. Please enter your name, phone number, and location again.');
    return;
  }
  profileExpiryTimer = window.setTimeout(
    () => resetChatProfile('Your chat session expired. Please enter your name, phone number, and location again.'),
    remaining
  );
}

/**
 * Persist the current profile to a browser cookie with an expiry timestamp embedded in the value.
 */
function saveProfileCookie() {
  const ttlSeconds = Number(profileCookieTtlSeconds.value || DEFAULT_COOKIE_TTL_SECONDS);
  const expiresAt  = Date.now() + ttlSeconds * 1000;
  setCookie(PROFILE_COOKIE_NAME, JSON.stringify({ ...profile, expiresAt }), ttlSeconds);
  scheduleProfileExpiry(expiresAt);
}

/**
 * Read, parse, and validate the saved profile cookie.
 * Returns null (and deletes the cookie) when the value is missing, malformed, or expired.
 *
 * @returns {{ name: string, phone: string, location: string, expiresAt: number }|null}
 */
function getSavedProfileFromCookie() {
  const raw = readCookie(PROFILE_COOKIE_NAME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.name || !parsed.phone || !parsed.location || !parsed.expiresAt || Date.now() >= Number(parsed.expiresAt)) {
      deleteCookie(PROFILE_COOKIE_NAME);
      return null;
    }
    return parsed;
  } catch (_) {
    deleteCookie(PROFILE_COOKIE_NAME);
    return null;
  }
}

/**
 * Guard before sending a message: verify the cookie is still valid.
 * Triggers a reset and returns false when the session has expired.
 *
 * @returns {boolean}
 */
function ensureProfileCookieIsValid() {
  if (!getSavedProfileFromCookie()) {
    resetChatProfile('Your chat session expired. Please enter your name, phone number, and location again.');
    return false;
  }
  return true;
}

// ─── Chat Actions ─────────────────────────────────────────────────────────────

/**
 * Scroll the messages container to the bottom after Vue has re-rendered.
 */
const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

/**
 * Validate the profile form inputs and transition the UI to the active chat state.
 */
const startChat = () => {
  errorMessage.value = '';
  sanitizePhone();
  if (!profile.name.trim() || !profile.phone.trim() || !profile.location.trim()) {
    errorMessage.value = 'Name, phone, and location are required.';
    return;
  }
  saveProfileCookie();
  profileReady.value = true;
};

/**
 * Send the current draft message to the backend chatbot API.
 *
 * Property context TIDAK lagi dikirim dari frontend — backend yang membangun
 * konteks katalog dari database (buildRecommendationContextForLLM) untuk setiap pesan.
 */
const sendMessage = async () => {
  if (!draft.value || isSending.value) return;
  if (!ensureProfileCookieIsValid()) return;

  const userText     = draft.value;
  draft.value        = '';
  errorMessage.value = '';

  messages.value.push({ role: 'user', text: userText });
  await scrollToBottom();

  isSending.value = true;
  try {
    const payload = {
      name:     profile.name,
      phone:    profile.phone,
      location: profile.location,
      message:  userText,
    };

    const response = await sendChatbotMessage(payload);
    messages.value.push({
      role: 'assistant',
      text: response.data?.reply || 'Thank you. Our team will follow up soon.',
    });
  } catch (error) {
    const msg = error.response?.data?.message || 'The chatbot could not reply right now. Please try again.';
    errorMessage.value = msg;
    messages.value.push({ role: 'assistant', text: msg });
  } finally {
    isSending.value = false;
    await scrollToBottom();
  }
};

// ─── Config ───────────────────────────────────────────────────────────────────

/**
 * Fetch cookie TTL settings from the backend /chatbot/config endpoint.
 * Falls back to defaults when the request fails or returns invalid data.
 */
async function loadChatbotConfig() {
  try {
    const response   = await getChatbotConfig();
    const ttlSeconds = Number(response.data?.cookieTtlSeconds || DEFAULT_COOKIE_TTL_SECONDS);
    const ttlMinutes = Number(response.data?.cookieTtlMinutes || DEFAULT_COOKIE_TTL_MINUTES);
    if (Number.isFinite(ttlSeconds) && ttlSeconds > 0) profileCookieTtlSeconds.value = ttlSeconds;
    if (Number.isFinite(ttlMinutes) && ttlMinutes > 0) profileCookieTtlMinutes.value = ttlMinutes;
  } catch (_) {
    profileCookieTtlSeconds.value = DEFAULT_COOKIE_TTL_SECONDS;
    profileCookieTtlMinutes.value = DEFAULT_COOKIE_TTL_MINUTES;
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  await loadChatbotConfig();
  const saved = getSavedProfileFromCookie();
  if (saved) {
    Object.assign(profile, { name: saved.name || '', phone: saved.phone || '', location: saved.location || '' });
    profileReady.value = Boolean(profile.name && profile.phone && profile.location);
    scheduleProfileExpiry(saved.expiresAt);
  }
});

onBeforeUnmount(() => {
  clearProfileExpiryTimer();
});
</script>
