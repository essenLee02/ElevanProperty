const {
  generateChatGPTContactReply,
  generateChatGPTChatbotReply,
  generateChatGPTWhatsappReply,
  checkChatGPTConfig
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

function canUseChatGPT() {
  const chatGPTConfig = checkChatGPTConfig();
  return chatGPTConfig.hasApiKey && chatGPTConfig.keyLooksValid;
}

function canUseClaudeFallback() {
  const claudeConfig = checkClaudeConfig();
  return isClaudeFallbackEnabled() && claudeConfig.hasApiKey && claudeConfig.keyLooksValid;
}

function logProviderError(provider, taskName, error) {
  console.error(`[${String(provider).toUpperCase()} ERROR]`, {
    taskName,
    provider,
    status: error?.status || error?.response?.status || null,
    message: error?.originalMessage || error?.message || 'Unknown provider error',
    stack: error?.stack
  });
}

function logProviderSkipped(provider, taskName, reason) {
  console.warn('[AI PROVIDER SKIPPED]', {
    taskName,
    provider,
    reason
  });
}

function logProviderFallback(taskName, fromProvider, toProvider, reason) {
  console.warn('[AI PROVIDER FALLBACK]', {
    taskName,
    from: fromProvider,
    to: toProvider,
    reason
  });
}

async function executeAIProviderWithFallback(taskName, chatGPTFn, claudeFn) {
  const primary = getPrimaryAIProvider();
  const providerErrors = [];

  if (primary === 'claude') {
    try {
      const reply = await claudeFn();
      return {
        reply,
        provider: 'claude',
        fallbackUsed: false,
        primaryProvider: 'claude',
        providerErrors,
        taskName
      };
    } catch (claudeError) {
      logProviderError('claude', taskName, claudeError);
      providerErrors.push({
        provider: 'claude',
        message: claudeError.message,
        status: claudeError.status || null
      });

      if (!canUseChatGPT()) {
        logProviderSkipped('chatgpt', taskName, 'ChatGPT is not configured or OPENAI_API_KEY is invalid.');
        const finalError = new Error(`Claude failed and ChatGPT is not available. Claude: ${claudeError.message}`);
        finalError.provider = 'ai_provider_router';
        finalError.providerErrors = providerErrors;
        finalError.claudeError = claudeError.message;
        throw finalError;
      }

      logProviderFallback(taskName, 'claude', 'chatgpt', claudeError.message);

      try {
        const reply = await chatGPTFn();
        return {
          reply,
          provider: 'chatgpt',
          fallbackUsed: true,
          primaryProvider: 'claude',
          fallbackProvider: 'chatgpt',
          primaryError: claudeError.message,
          providerErrors,
          taskName
        };
      } catch (chatGPTError) {
        logProviderError('chatgpt', taskName, chatGPTError);
        providerErrors.push({
          provider: 'chatgpt',
          message: chatGPTError.message,
          status: chatGPTError.status || null
        });

        const finalError = new Error(`Claude failed and ChatGPT fallback also failed. Claude: ${claudeError.message}. ChatGPT: ${chatGPTError.message}`);
        finalError.provider = 'ai_provider_router';
        finalError.providerErrors = providerErrors;
        finalError.claudeError = claudeError.message;
        finalError.chatGPTError = chatGPTError.message;
        throw finalError;
      }
    }
  }

  try {
    const reply = await chatGPTFn();
    return {
      reply,
      provider: 'chatgpt',
      fallbackUsed: false,
      primaryProvider: 'chatgpt',
      providerErrors,
      taskName
    };
  } catch (chatGPTError) {
    logProviderError('chatgpt', taskName, chatGPTError);
    providerErrors.push({
      provider: 'chatgpt',
      message: chatGPTError.message,
      status: chatGPTError.status || null
    });

    if (!canUseClaudeFallback()) {
      logProviderSkipped('claude', taskName, 'Claude fallback is disabled, not configured, or ANTHROPIC_API_KEY is invalid.');
      const finalError = new Error(`ChatGPT failed and Claude fallback is not available. ChatGPT: ${chatGPTError.message}`);
      finalError.provider = 'ai_provider_router';
      finalError.providerErrors = providerErrors;
      finalError.chatGPTError = chatGPTError.message;
      throw finalError;
    }

    logProviderFallback(taskName, 'chatgpt', 'claude', chatGPTError.message);

    try {
      const reply = await claudeFn();
      return {
        reply,
        provider: 'claude',
        fallbackUsed: true,
        primaryProvider: 'chatgpt',
        fallbackProvider: 'claude',
        primaryError: chatGPTError.message,
        providerErrors,
        taskName
      };
    } catch (claudeError) {
      logProviderError('claude', taskName, claudeError);
      providerErrors.push({
        provider: 'claude',
        message: claudeError.message,
        status: claudeError.status || null
      });

      const finalError = new Error(`ChatGPT failed and Claude fallback also failed. ChatGPT: ${chatGPTError.message}. Claude: ${claudeError.message}`);
      finalError.provider = 'ai_provider_router';
      finalError.providerErrors = providerErrors;
      finalError.chatGPTError = chatGPTError.message;
      finalError.claudeError = claudeError.message;
      throw finalError;
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
    chatGPTReady: canUseChatGPT(),
    claudeFallbackReady: canUseClaudeFallback(),
    chatGPT,
    claude
  };
}

module.exports = {
  isClaudeFallbackEnabled,
  getPrimaryAIProvider,
  getAIProviderOrder,
  canUseChatGPT,
  canUseClaudeFallback,
  executeAIProviderWithFallback,
  generateContactReplyWithProviderFallback,
  generateChatbotReplyWithProviderFallback,
  generateWhatsappReplyWithProviderFallback,
  checkAIProviderConfig
};
