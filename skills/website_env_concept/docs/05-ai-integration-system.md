# 05. AI Integration System

## ChatGPT Integration

```javascript
async chatGptResponse(prompt, sessionData) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL,
    messages: [{ role: 'system', content: prompt }],
    max_tokens: 2000
  });

  return response.choices[0].message.content;
}
```

## Claude Integration

```javascript
async claudeResponse(prompt, sessionData) {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: process.env.CLAUDE_MODEL,
    max_tokens: 2000,
    system: prompt,
    messages: [{ role: 'user', content: sessionData.lastMessage }]
  });

  return response.content[0].text;
}
```

## Fallback Logic

```javascript
async generateResponseWithFallback(prompt, sessionData) {
  try {
    // Try primary provider (ChatGPT or Claude)
    return await primaryProvider(prompt, sessionData);
  } catch (error) {
    // Fallback to alternate provider
    return await fallbackProvider(prompt, sessionData);
  }
}
```

## Response Handling

- Validate response format
- Extract property recommendations
- Track tokens & cost
- Save to history
- Format for display

## Private AI Option

For on-premise deployment:
- Ollama (local LLM)
- LLaMA 2 or similar
- Same integration pattern as ChatGPT/Claude
