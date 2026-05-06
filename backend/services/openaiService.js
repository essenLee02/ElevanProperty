const axios = require('axios');

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function maskSecret(secret) {
  const value = String(secret || '').trim();
  if (!value) return '';
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 10)}...${value.slice(-4)}`;
}

function getOpenAIConfig() {
  return {
    apiKey: String(process.env.OPENAI_API_KEY || '').trim(),
    model: String(process.env.OPENAI_MODEL || 'gpt-5.4-mini').trim(),
    maxOutputTokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 0),
    store: String(process.env.OPENAI_STORE_RESPONSE || 'true').toLowerCase() !== 'false'
  };
}

function extractOpenAIText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  const texts = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const contentItem of content) {
      if (typeof contentItem?.text === 'string' && contentItem.text.trim()) {
        texts.push(contentItem.text.trim());
      }

      if (typeof contentItem?.output_text === 'string' && contentItem.output_text.trim()) {
        texts.push(contentItem.output_text.trim());
      }
    }
  }

  return texts.join('\n').trim();
}

function normalizeOpenAIError(error) {
  const status = error?.response?.status;
  const apiMessage =
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Unknown OpenAI error';

  if (status === 401) {
    return new Error(
      `OpenAI API authentication failed. Please check OPENAI_API_KEY in backend .env. Detail: ${apiMessage}`
    );
  }

  if (status === 403) {
    return new Error(
      `OpenAI API permission/model access failed. Please check whether your project can use OPENAI_MODEL. Detail: ${apiMessage}`
    );
  }

  if (status === 404) {
    return new Error(
      `OpenAI model or endpoint was not found. Please check OPENAI_MODEL. Detail: ${apiMessage}`
    );
  }

  if (status === 429) {
    return new Error(
      `OpenAI API quota/billing/rate limit issue: ${apiMessage}`
    );
  }

  return new Error(`OpenAI API error${status ? ` ${status}` : ''}: ${apiMessage}`);
}

function buildContactPrompt({ name, email, phone, subject, message }) {
  return `
Anda adalah customer service profesional untuk website landing page property.
Buat balasan WhatsApp singkat dalam Bahasa Indonesia.

Aturan balasan:
- Sapa customer dengan nama.
- Tanggapi kebutuhan customer berdasarkan subject dan message.
- Jelaskan bahwa team akan follow up segera.
- Jangan menjanjikan ketersediaan unit, harga final, legalitas, atau booking pasti.
- Gaya bahasa sopan, ramah, dan profesional.
- Maksimal 5 paragraf pendek.

Data customer:
Nama: ${name}
Email: ${email}
Nomor WhatsApp: ${phone}
Subject: ${subject}
Message: ${message}
`.trim();
}

async function createResponse(input) {
  const config = getOpenAIConfig();

  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY is missing in backend .env');
  }

  if (!config.model) {
    throw new Error('OPENAI_MODEL is missing in backend .env');
  }

  const payload = {
    model: config.model,
    input,
    store: config.store
  };

  // Optional only. Keep empty by default to match the Postman request that already works.
  if (Number.isFinite(config.maxOutputTokens) && config.maxOutputTokens > 0) {
    payload.max_output_tokens = config.maxOutputTokens;
  }

  try {
    const response = await axios.post(OPENAI_RESPONSES_URL, payload, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 90000
    });

    return response.data;
  } catch (error) {
    throw normalizeOpenAIError(error);
  }
}

exports.generateContactReply = async (contactData) => {
  const prompt = buildContactPrompt(contactData);
  const data = await createResponse(prompt);
  const aiText = extractOpenAIText(data);

  if (!aiText) {
    throw new Error('OpenAI response is empty or cannot be parsed.');
  }

  return aiText;
};

exports.testOpenAIConnection = async () => {
  const data = await createResponse('Balas hanya dengan teks: OK');
  return {
    success: true,
    model: getOpenAIConfig().model,
    apiKeyMasked: maskSecret(getOpenAIConfig().apiKey),
    responseText: extractOpenAIText(data)
  };
};

exports.getOpenAIStatus = () => {
  const config = getOpenAIConfig();

  return {
    apiKeyLoaded: Boolean(config.apiKey),
    apiKeyMasked: maskSecret(config.apiKey),
    model: config.model,
    store: config.store,
    maxOutputTokens: config.maxOutputTokens > 0 ? config.maxOutputTokens : null
  };
};
