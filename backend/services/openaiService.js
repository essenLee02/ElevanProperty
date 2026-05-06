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
- Acknowledge their inquiry.
- Mention that the team will follow up soon.
- Keep it friendly, polite, and concise.
- Do not invent exact availability, price, or legal promise.
- Maximum 5 short paragraphs.

Customer data:
Name: ${name}
Email: ${email}
Phone: ${phone}
Subject: ${subject}
Message: ${message}
`;

  const response = await axios.post(
    'https://api.openai.com/v1/responses',
    {
      model,
      input: prompt,
      max_output_tokens: 350
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
};
