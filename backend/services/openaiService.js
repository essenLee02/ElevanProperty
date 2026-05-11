const axios = require('axios');

const DEFAULT_MODEL = 'gpt-5.4-mini';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const PROPERTY_ASSISTANT_PROMPT = `
You are a professional property assistant for a property rental and sales platform in Indonesia.

Your job is to help customers buy, sell, or rent properties such as houses, villas, hotels, apartments, and boarding houses.

Always communicate in a friendly, professional, polite, natural, and human-like way.

Stay focused on property topics only. If the customer asks unrelated questions, politely redirect them back to property buying, selling, or rental assistance.

Your service focus is Java Island, Indonesia. If the customer asks outside Java, explain politely and offer similar locations in Java.

Identify whether the customer wants to buy, sell, or rent. If unclear, ask a follow-up question.

Collect important requirements:
- property type
- location
- budget
- land size
- building size
- bedrooms
- bathrooms
- facilities
- furnished/unfurnished
- rental duration if renting
- number of occupants if renting

Recommend suitable property options if available. If exact options are not available, suggest alternatives.

Reply in the same language used by the customer.
`.trim();

function sanitizeEnvValue(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/[\r\n]/g, '')
    .trim();
}

function maskSecret(value) {
  const clean = sanitizeEnvValue(value);
  if (!clean) return '';
  if (clean.length <= 12) return '***';
  return `${clean.slice(0, 8)}...${clean.slice(-4)}`;
}

function extractOpenAIText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = data && Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (item && Array.isArray(item.content)) {
      const textParts = item.content
        .map((content) => {
          if (!content) return '';
          if (typeof content.text === 'string') return content.text;
          if (typeof content.output_text === 'string') return content.output_text;
          if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
          return '';
        })
        .filter(Boolean);

      if (textParts.length) return textParts.join('\n').trim();
    }
  }

  if (data && Array.isArray(data.choices)) {
    const text = data.choices
      .map((choice) => choice.message?.content || choice.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
    if (text) return text;
  }

  return '';
}

function normalizeOpenAIError(error) {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown OpenAI API error';

  if (status === 401) {
    return new Error('OpenAI rejected the API key. Please replace OPENAI_API_KEY in backend/.env with a new active key, then restart the backend.');
  }

  if (status === 402 || status === 429) {
    return new Error(`OpenAI API quota/billing/rate limit issue: ${apiMessage}`);
  }

  if ((status === 400 || status === 404) && String(apiMessage).toLowerCase().includes('model')) {
    return new Error(`OpenAI model error: ${apiMessage}. Please check OPENAI_MODEL in backend/.env.`);
  }

  return new Error(`OpenAI API error${status ? ` (${status})` : ''}: ${apiMessage}`);
}

function getOpenAIConfig() {
  const apiKey = sanitizeEnvValue(process.env.OPENAI_API_KEY);
  const model = sanitizeEnvValue(process.env.OPENAI_MODEL) || DEFAULT_MODEL;

  return {
    apiKey,
    model,
    store: String(process.env.OPENAI_STORE_RESPONSE || 'true').toLowerCase() !== 'false'
  };
}

async function createResponse(input, options = {}) {
  const config = getOpenAIConfig();

  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY is missing in backend/.env');
  }

  if (!config.apiKey.startsWith('sk-')) {
    throw new Error('OPENAI_API_KEY format is invalid. It should start with sk-.');
  }

  const payload = {
    model: options.model || config.model,
    input,
    store: options.store !== undefined ? options.store : config.store
  };

  const maxOutputTokens = Number(options.max_output_tokens || process.env.OPENAI_MAX_OUTPUT_TOKENS || 0);
  if (maxOutputTokens > 0) payload.max_output_tokens = maxOutputTokens;

  try {
    const response = await axios.post(OPENAI_RESPONSES_URL, payload, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 90000
    });

    const text = extractOpenAIText(response.data);
    if (!text) throw new Error('OpenAI response is empty or cannot be parsed.');
    return text;
  } catch (error) {
    throw normalizeOpenAIError(error);
  }
}

function formatHistory(history = []) {
  if (!history.length) return 'No previous conversation history.';
  return history.map((item) => `${item.role}: ${item.message}`).join('\n');
}

async function generateContactReply({ name, email, phone, subject, message }) {
  const input = `${PROPERTY_ASSISTANT_PROMPT}

Task: Create a short WhatsApp reply for a new website Contact Form submission.

Rules:
- Greet the customer by name.
- Acknowledge the property inquiry.
- Ask one or two relevant follow-up questions if needed.
- Mention that the team can continue assisting through WhatsApp.
- Do not invent exact availability, price, discount, legal promise, or appointment schedule.
- Keep it friendly, polite, and concise.
- Maximum 5 short paragraphs.

Customer data:
Name: ${name}
Email: ${email}
Phone: ${phone}
Subject: ${subject}
Message: ${message}`;

  return createResponse(input, { store: true });
}

async function generateChatbotReply(session, history, userMessage, propertyContext = '') {
  const input = `${PROPERTY_ASSISTANT_PROMPT}

Customer profile:
Name: ${session.name}
Phone: ${session.normalizedPhone}
Source: ${session.source}

Recent conversation history:
${formatHistory(history)}

Available property context:
${propertyContext || 'No live property catalog is connected yet. Ask discovery questions and offer to let the team follow up.'}

Current customer message:
${userMessage}

Reply naturally and helpfully. Ask for missing requirements if needed.`;

  return createResponse(input, { store: true });
}

async function generateWhatsappReply(session, history, userMessage, propertyContext = '') {
  return generateChatbotReply(session, history, userMessage, propertyContext);
}

async function detectCustomerIntent(message) {
  const input = `${PROPERTY_ASSISTANT_PROMPT}

Classify this customer message into one of: buy, sell, rent, unknown.
Return only one word.
Message: ${message}`;
  return createResponse(input, { store: false });
}

async function extractPropertyPreferences(message) {
  const input = `${PROPERTY_ASSISTANT_PROMPT}

Extract property preferences from the message into concise JSON with these keys: intent, propertyType, location, budget, size, bedrooms, bathrooms, facilities, rentalDuration, occupants, notes.
Message: ${message}`;
  return createResponse(input, { store: false });
}

function checkOpenAIConfig() {
  const config = getOpenAIConfig();
  return {
    hasApiKey: Boolean(config.apiKey),
    keyLooksValid: Boolean(config.apiKey && config.apiKey.startsWith('sk-')),
    maskedKey: maskSecret(config.apiKey),
    model: config.model
  };
}

module.exports = {
  PROPERTY_ASSISTANT_PROMPT,
  createResponse,
  generateContactReply,
  generateChatbotReply,
  generateWhatsappReply,
  detectCustomerIntent,
  extractPropertyPreferences,
  checkOpenAIConfig,
  sanitizeEnvValue,
  maskSecret
};
