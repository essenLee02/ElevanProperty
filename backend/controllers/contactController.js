const { Contact } = require('../models');
const { validateContactForm } = require('../services/validationService');
const { appendContactRow, getGoogleSheetsStatus } = require('../services/googleSheetsService');
const { checkChatGPTConfig } = require('../services/openaiService');
const {
  generateContactReplyWithProviderFallback,
  checkAIProviderConfig
} = require('../services/aiProviderService');
const { sendWhatsAppMessage, normalizeWhatsAppNumber, checkFonnteConfig } = require('../services/fonnteService');
const { findOrCreateSession, saveUserMessage, saveAssistantMessage } = require('../services/sessionService');
const { safeLog } = require('../utils/safeLog');

function sanitizeContactPayload(body) {
  return {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(),
    subject: String(body.subject || '').trim(),
    message: String(body.message || '').trim()
  };
}

function isAiWhatsappEnabled() {
  return String(process.env.ENABLE_AI_WHATSAPP || 'true').toLowerCase() !== 'false';
}

async function sendAiWhatsappReply(contactPayload) {
  const aiResult = await generateContactReplyWithProviderFallback(contactPayload);
  const aiReply = aiResult.reply;
  const whatsappResult = await sendWhatsAppMessage(contactPayload.phone, aiReply);

  const session = await findOrCreateSession(contactPayload.name, contactPayload.phone, 'contact_form');
  await saveUserMessage(session.id, `${contactPayload.subject}\n${contactPayload.message}`, 'contact_form', {
    email: contactPayload.email
  });
  await saveAssistantMessage(session.id, aiReply, 'whatsapp', {
    whatsappTarget: whatsappResult.target,
    source: aiResult.provider,
    primaryProvider: aiResult.primaryProvider,
    fallbackUsed: aiResult.fallbackUsed,
    fallbackProvider: aiResult.fallbackProvider || null,
    primaryError: aiResult.primaryError || null
  });

  return {
    aiReply,
    aiProvider: aiResult.provider,
    primaryProvider: aiResult.primaryProvider,
    fallbackUsed: aiResult.fallbackUsed,
    fallbackProvider: aiResult.fallbackProvider || null,
    primaryError: aiResult.primaryError || null,
    whatsappTarget: whatsappResult.target,
    fonnteResponse: whatsappResult.response
  };
}

exports.submitContact = async (req, res) => {
  const contactPayload = sanitizeContactPayload(req.body);

  safeLog('FORM_SUBMIT_ATTEMPT', {
    name: contactPayload.name,
    email: contactPayload.email,
    phone: contactPayload.phone,
    subject: contactPayload.subject
  });

  const validation = validateContactForm(contactPayload);
  if (!validation.valid) {
    return res.status(400).json({ success: false, message: validation.message, error: validation.message });
  }

  let googleSheetSent = false;
  let databaseSaved = false;
  let newContact = null;

  try {
    await appendContactRow({ ...contactPayload, source: 'Website Contact Form' });
    googleSheetSent = true;

    newContact = await Contact.create(contactPayload);
    databaseSaved = true;
    safeLog('FORM_SUBMIT_SUCCESS', `Contact ID: ${newContact.id}`);

    if (!isAiWhatsappEnabled()) {
      return res.json({
        success: true,
        googleSheetSent,
        databaseSaved,
        whatsappSent: false,
        contactId: newContact.id,
        message: 'Message received, sent to Google Spreadsheet, and saved to database successfully. AI WhatsApp reply is disabled.'
      });
    }

    try {
      const aiWhatsappResult = await sendAiWhatsappReply(contactPayload);
      safeLog('AI_WHATSAPP_SENT', {
        contactId: newContact.id,
        target: aiWhatsappResult.whatsappTarget
      });

      return res.json({
        success: true,
        googleSheetSent,
        databaseSaved,
        whatsappSent: true,
        contactId: newContact.id,
        whatsappTarget: aiWhatsappResult.whatsappTarget,
        aiReply: aiWhatsappResult.aiReply,
        aiProvider: aiWhatsappResult.aiProvider,
        primaryProvider: aiWhatsappResult.primaryProvider,
        fallbackUsed: aiWhatsappResult.fallbackUsed,
        fallbackProvider: aiWhatsappResult.fallbackProvider || null,
        primaryError: aiWhatsappResult.primaryError || null,
        fonnteResponse: aiWhatsappResult.fonnteResponse,
        message: 'Message received, sent to Google Spreadsheet, saved to database, and AI WhatsApp reply sent successfully.'
      });
    } catch (aiWhatsappError) {
      safeLog('AI_WHATSAPP_FAILED', aiWhatsappError.message, 'error');

      return res.status(200).json({
        success: true,
        googleSheetSent,
        databaseSaved,
        whatsappSent: false,
        contactId: newContact.id,
        whatsappTarget: normalizeWhatsAppNumber(contactPayload.phone),
        aiWhatsappError: aiWhatsappError.message || 'Failed to send AI WhatsApp reply.',
        message: 'Message received, sent to Google Spreadsheet, and saved to database. However, the AI WhatsApp reply failed. Please check OPENAI_API_KEY, OPENAI_MODEL, ANTHROPIC_API_KEY, CLAUDE_MODEL, FONNTE_TOKEN, Fonnte device connection, and WhatsApp quota.'
      });
    }
  } catch (error) {
    safeLog('CONTACT_SUBMIT_FAILED', error.message, 'error');

    return res.status(500).json({
      success: false,
      googleSheetSent,
      databaseSaved,
      whatsappSent: false,
      contactId: newContact?.id || null,
      message: error.message || 'Failed to save message.',
      error: error.message || 'Failed to save message.'
    });
  }
};

exports.googleSheetsStatus = async (req, res) => {
  try {
    const status = await getGoogleSheetsStatus();
    return res.json({
      success: true,
      message: 'Google Sheets connection is OK.',
      ...status
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      error: error.message,
      actionRequired: 'Check backend/google-service-account.json, backend/.env, Google Sheets API enablement, and spreadsheet sharing permission.'
    });
  }
};

exports.aiWhatsappStatus = async (req, res) => {
  const aiConfig = checkAIProviderConfig();
  const fonnteConfig = checkFonnteConfig();

  // Backward-compatible field for existing frontend/debug usage.
  const openAIConfig = checkChatGPTConfig();

  const aiReady =
    (aiConfig.primaryProvider === 'chatgpt' && aiConfig.chatGPT.hasApiKey && aiConfig.chatGPT.keyLooksValid) ||
    (aiConfig.primaryProvider === 'claude' && aiConfig.claude.hasApiKey && aiConfig.claude.keyLooksValid) ||
    aiConfig.claudeFallbackReady;

  const success = aiReady && fonnteConfig.hasToken;

  return res.status(success ? 200 : 500).json({
    success,
    aiWhatsappEnabled: isAiWhatsappEnabled(),
    aiProviders: aiConfig,
    openAI: {
      hasApiKey: openAIConfig.hasApiKey,
      keyLooksValid: openAIConfig.keyLooksValid,
      maskedKey: openAIConfig.maskedKey,
      model: openAIConfig.model,
      provider: 'chatgpt'
    },
    fonnte: {
      hasToken: fonnteConfig.hasToken
    },
    message: success
      ? 'AI provider and Fonnte configuration are ready. ChatGPT is primary by default; Claude fallback is available when configured.'
      : 'AI provider or Fonnte configuration is not ready. Check OPENAI_API_KEY, ANTHROPIC_API_KEY, ENABLE_CLAUDE_FALLBACK, and FONNTE_TOKEN in backend/.env.'
  });
};
