const axios = require('axios');

function extractOpenAIText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = data && Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (item && Array.isArray(item.content)) {
      const textParts = item.content
        .map((content) => content.text || content.output_text || '')
        .filter(Boolean);

      if (textParts.length > 0) {
        return textParts.join('\n').trim();
      }
    }
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
    return new Error('OpenAI API key is invalid or unauthorized. Please check OPENAI_API_KEY in backend .env.');
  }

  if (status === 402 || status === 429) {
    return new Error(`OpenAI API quota/billing/rate limit issue: ${apiMessage}`);
  }

  if (status === 400 && apiMessage.toLowerCase().includes('model')) {
    return new Error(`OpenAI model error: ${apiMessage}. Please check OPENAI_MODEL in backend .env.`);
  }

  return new Error(`OpenAI API error${status ? ` (${status})` : ''}: ${apiMessage}`);
}

exports.generateContactReply = async ({ name, email, phone, subject, message }) => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing in backend .env');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-5.5';

  const prompt = `
You are a professional property customer service assistant for a real estate landing page.
Create a short WhatsApp reply in Bahasa Indonesia.

Rules:
- Greet the customer by name.
- Acknowledge their property inquiry.
- Mention that the team will follow up soon by WhatsApp or phone.
- Keep it friendly, polite, and concise.
- Do not invent exact availability, price, discount, legal promise, or appointment schedule.
- Maximum 5 short paragraphs.

Customer data from website contact form:
Name: ${name}
Email: ${email}
Phone: ${phone}
Subject: ${subject}
Message: ${message}
`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/responses',
      {
        model,
        input: prompt,
        max_output_tokens: 350,
        store: false
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const aiText = extractOpenAIText(response.data);

    if (!aiText) {
      throw new Error('OpenAI response is empty or cannot be parsed.');
    }

    return aiText;
  } catch (error) {
    throw normalizeOpenAIError(error);
  }
};

exports.checkOpenAIConfig = () => ({
  hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  model: process.env.OPENAI_MODEL || 'gpt-5.5'
});
