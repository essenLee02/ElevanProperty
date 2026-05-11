const { Contact } = require('../models');
const { validateContactForm } = require('../services/validationService');
const { appendContactRow, getGoogleSheetsStatus } = require('../services/googleSheetsService');
const { generateContactReply, checkOpenAIConfig } = require('../services/openaiService');
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
  const aiReply = await generateContactReply(contactPayload);
  const whatsappResult = await sendWhatsAppMessage(contactPayload.phone, aiReply);

  const session = await findOrCreateSession(contactPayload.name, contactPayload.phone, 'contact_form');
  await saveUserMessage(session.id, `${contactPayload.subject}\n${contactPayload.message}`, 'contact_form', {
    email: contactPayload.email
  });
  await saveAssistantMessage(session.id, aiReply, 'whatsapp', {
    whatsappTarget: whatsappResult.target
  });

  return {
    aiReply,
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
        message: 'Message received, sent to Google Spreadsheet, and saved to database. However, the AI WhatsApp reply failed. Please check OPENAI_API_KEY, OPENAI_MODEL, FONNTE_TOKEN, Fonnte device connection, and WhatsApp quota.'
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
  const openAIConfig = checkOpenAIConfig();
  const fonnteConfig = checkFonnteConfig();
  let openAITest = null;

  if (String(req.query.testOpenAI || '').toLowerCase() === 'true') {
    try {
      const { createResponse } = require('../services/openaiService');
      openAITest = await createResponse('Reply with this exact text only: OpenAI backend connection is OK.', { store: false });
    } catch (error) {
      openAITest = { error: error.message };
    }
  }

  const success = openAIConfig.hasApiKey && openAIConfig.keyLooksValid && fonnteConfig.hasToken && (!openAITest?.error);

  return res.status(success ? 200 : 500).json({
    success,
    aiWhatsappEnabled: isAiWhatsappEnabled(),
    openAI: {
      hasApiKey: openAIConfig.hasApiKey,
      keyLooksValid: openAIConfig.keyLooksValid,
      maskedKey: openAIConfig.maskedKey,
      model: openAIConfig.model,
      test: openAITest
    },
    fonnte: {
      hasToken: fonnteConfig.hasToken
    },
    message: success
      ? 'OpenAI and Fonnte configuration are ready.'
      : 'OpenAI or Fonnte configuration is not ready. If the OpenAI test says the key was rejected, create a new OpenAI API key, update backend/.env, and restart the backend.'
  });
};
