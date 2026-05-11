const axios = require('axios');
const { loadProjectSkillPrompt } = require('./skillPromptService');

const DEFAULT_MODEL = 'gpt-5.4-mini';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const BASE_PROPERTY_ASSISTANT_PROMPT = `
You are a professional property assistant for a property rental and sales platform in Indonesia.

You must follow the project skill documentation provided below. The skill documentation is the main behavior standard for this website chatbot and WhatsApp chatbot.

Core behavior:
- Help customers buy, sell, or rent properties such as houses, villas, hotels, apartments, and boarding houses.
- Reply in the same language used by the customer.
- Stay focused on property topics only.
- Prioritize the customer's latest message over older conversation history.
- Use only backend property catalog data provided in the current request.
- Do not invent property names, prices, facilities, addresses, locations, discounts, or availability.
- If exact matching properties exist, list exact matching properties first.
- If no exact match exists, clearly apologize or explain that no exact match is available, then provide only the closest alternatives from the backend catalog.
- If the customer asks for rental houses in Surabaya, do not recommend hotels in Malang.
- If the customer asks for hotels in Malang, recommend hotels in Malang if available.
- If the customer asks for a budget range, respect the range when exact matching data exists; if alternatives are outside the range, say so clearly.
- After listing property options, ask only one short follow-up question.
`.trim();

function getProjectSkillInstruction() {
  return `${BASE_PROPERTY_ASSISTANT_PROMPT}\n\nPROJECT SKILL DOCUMENTATION:\n${loadProjectSkillPrompt()}`;
}

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

  if (options.metadata && typeof options.metadata === 'object') {
    payload.metadata = options.metadata;
  }

  const maxOutputTokens = Number(options.max_output_tokens || process.env.OPENAI_MAX_OUTPUT_TOKENS || 0);
  if (maxOutputTokens > 0) payload.max_output_tokens = maxOutputTokens;

  try {
    console.log('[OPENAI REQUEST]', {
      model: payload.model,
      store: payload.store,
      source: options.metadata?.source || 'unknown',
      channel: options.metadata?.channel || 'unknown'
    });

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
  const input = `${getProjectSkillInstruction()}

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

  return createResponse(input, {
    store: true,
    metadata: {
      source: 'elevanlabs_contact_form',
      channel: 'website_contact'
    }
  });
}

async function generateChatbotReply(session, history, userMessage, propertyContext = '') {
  const input = `${getProjectSkillInstruction()}

Customer profile:
Name: ${session.name}
Phone: ${session.normalizedPhone}
Source: ${session.source}

Recent conversation history for context only. Do not let old history override the latest customer message:
${formatHistory(history)}

Backend property catalog context for this latest message:
${propertyContext || 'No backend property catalog context is available.'}

Latest customer message. This is the highest-priority instruction:
${userMessage}

Task:
Create the final chatbot reply using only the backend property catalog context above.
If exact matches are available, recommend exact matches directly.
If no exact match is available, say that no exact match is available and then present only the backend alternatives.
Do not keep asking discovery questions before showing options when the customer asks for suggestions or available properties.`;

  return createResponse(input, {
    store: true,
    metadata: {
      source: 'elevanlabs_floating_chatbot',
      channel: 'website_chatbot',
      sessionId: String(session.id || '')
    }
  });
}

async function generateWhatsappReply(session, history, userMessage, propertyContext = '') {
  const input = `${getProjectSkillInstruction()}

Customer profile:
Name: ${session.name}
Phone: ${session.normalizedPhone}
Source: ${session.source}

Recent conversation history for context only. Do not let old history override the latest customer message:
${formatHistory(history)}

Backend property catalog context for this latest WhatsApp message:
${propertyContext || 'No backend property catalog context is available.'}

Latest WhatsApp customer message. This is the highest-priority instruction:
${userMessage}

Task:
Create the final WhatsApp reply using only the backend property catalog context above.
If exact matches are available, recommend exact matches directly.
If no exact match is available, say that no exact match is available and then present only the backend alternatives.`;

  return createResponse(input, {
    store: true,
    metadata: {
      source: 'elevanlabs_fonnte_whatsapp',
      channel: 'whatsapp',
      sessionId: String(session.id || '')
    }
  });
}

async function detectCustomerIntent(message) {
  const input = `${getProjectSkillInstruction()}

Classify this customer message into one of: buy, sell, rent, unknown.
Return only one word.
Message: ${message}`;
  return createResponse(input, { store: true, metadata: { source: 'elevanlabs_intent_detection', channel: 'backend' } });
}

async function extractPropertyPreferences(message) {
  const input = `${getProjectSkillInstruction()}

Extract property preferences from the message into concise JSON with these keys: intent, propertyType, location, budget, size, bedrooms, bathrooms, facilities, rentalDuration, occupants, notes.
Message: ${message}`;
  return createResponse(input, { store: true, metadata: { source: 'elevanlabs_preference_extraction', channel: 'backend' } });
}

function checkOpenAIConfig() {
  const config = getOpenAIConfig();
  return {
    hasApiKey: Boolean(config.apiKey),
    keyLooksValid: Boolean(config.apiKey && config.apiKey.startsWith('sk-')),
    maskedKey: maskSecret(config.apiKey),
    model: config.model,
    store: config.store,
    skillPromptLoaded: Boolean(loadProjectSkillPrompt())
  };
}

module.exports = {
  PROPERTY_ASSISTANT_PROMPT: getProjectSkillInstruction(),
  getProjectSkillInstruction,
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
