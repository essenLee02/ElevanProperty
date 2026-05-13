const {
  generateChatGPTContactReply,
  generateChatGPTChatbotReply,
  generateChatGPTWhatsappReply,
  checkChatGPTConfig,
  isChatGPTFallbackEligibleError
} = require('./openaiService');

const {
  generateClaudeContactReply,
  generateClaudeChatbotReply,
  generateClaudeWhatsappReply,
  checkClaudeConfig
} = require('./claudeService');

function isClaudeFallbackEnabled() {
  return String(process.env.ENABLE_CLAUDE_FALLBACK || 'true').toLowerCase() !== 'false';
}

function getPrimaryAIProvider() {
  const value = String(process.env.AI_PRIMARY_PROVIDER || 'chatgpt').toLowerCase().trim();
  return value === 'claude' ? 'claude' : 'chatgpt';
}

function getAIProviderOrder() {
  const primary = getPrimaryAIProvider();

  if (primary === 'claude') {
    return ['claude', 'chatgpt'];
  }

  return ['chatgpt', 'claude'];
}

function canUseClaudeFallback() {
  const claudeConfig = checkClaudeConfig();
  return isClaudeFallbackEnabled() && claudeConfig.hasApiKey && claudeConfig.keyLooksValid;
}

function shouldFallbackFromChatGPTToClaude(error) {
  return (
    getPrimaryAIProvider() === 'chatgpt' &&
    canUseClaudeFallback() &&
    isChatGPTFallbackEligibleError(error)
  );
}

async function executeAIProviderWithFallback(taskName, chatGPTFn, claudeFn) {
  const primary = getPrimaryAIProvider();

  if (primary === 'claude') {
    const reply = await claudeFn();
    return {
      reply,
      provider: 'claude',
      fallbackUsed: false,
      primaryProvider: 'claude',
      taskName
    };
  }

  try {
    const reply = await chatGPTFn();
    return {
      reply,
      provider: 'chatgpt',
      fallbackUsed: false,
      primaryProvider: 'chatgpt',
      taskName
    };
  } catch (chatGPTError) {
    if (!shouldFallbackFromChatGPTToClaude(chatGPTError)) {
      throw chatGPTError;
    }

    console.warn('[AI PROVIDER FALLBACK]', {
      taskName,
      from: 'chatgpt',
      to: 'claude',
      reason: chatGPTError.message
    });

    try {
      const reply = await claudeFn();
      return {
        reply,
        provider: 'claude',
        fallbackUsed: true,
        primaryProvider: 'chatgpt',
        fallbackProvider: 'claude',
        primaryError: chatGPTError.message,
        taskName
      };
    } catch (claudeError) {
      const combinedError = new Error(`ChatGPT failed and Claude fallback also failed. ChatGPT: ${chatGPTError.message}. Claude: ${claudeError.message}`);
      combinedError.provider = 'ai_provider_router';
      combinedError.chatGPTError = chatGPTError.message;
      combinedError.claudeError = claudeError.message;
      throw combinedError;
    }
  }
}

async function generateContactReplyWithProviderFallback(contactPayload) {
  return executeAIProviderWithFallback(
    'contact_reply',
    () => generateChatGPTContactReply(contactPayload),
    () => generateClaudeContactReply(contactPayload)
  );
}

async function generateChatbotReplyWithProviderFallback(session, history, userMessage, propertyContext = '') {
  return executeAIProviderWithFallback(
    'chatbot_reply',
    () => generateChatGPTChatbotReply(session, history, userMessage, propertyContext),
    () => generateClaudeChatbotReply(session, history, userMessage, propertyContext)
  );
}

async function generateWhatsappReplyWithProviderFallback(session, history, userMessage, propertyContext = '') {
  return executeAIProviderWithFallback(
    'whatsapp_reply',
    () => generateChatGPTWhatsappReply(session, history, userMessage, propertyContext),
    () => generateClaudeWhatsappReply(session, history, userMessage, propertyContext)
  );
}

function checkAIProviderConfig() {
  const chatGPT = checkChatGPTConfig();
  const claude = checkClaudeConfig();

  return {
    primaryProvider: getPrimaryAIProvider(),
    providerOrder: getAIProviderOrder(),
    claudeFallbackEnabled: isClaudeFallbackEnabled(),
    claudeFallbackReady: canUseClaudeFallback(),
    chatGPT,
    claude
  };
}

module.exports = {
  isClaudeFallbackEnabled,
  getPrimaryAIProvider,
  getAIProviderOrder,
  canUseClaudeFallback,
  shouldFallbackFromChatGPTToClaude,
  executeAIProviderWithFallback,
  generateContactReplyWithProviderFallback,
  generateChatbotReplyWithProviderFallback,
  generateWhatsappReplyWithProviderFallback,
  checkAIProviderConfig
};
