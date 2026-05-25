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
const { generatePrivateContactReply } = require('./chatbotPrivateController');

class ContactController {
  static #sanitize(body) {
    return {
      name:    String(body.name    || '').trim(),
      email:   String(body.email   || '').trim(),
      phone:   String(body.phone   || '').trim(),
      subject: String(body.subject || '').trim(),
      message: String(body.message || '').trim()
    };
  }

  static #isAiWhatsappEnabled() {
    return String(process.env.ENABLE_AI_WHATSAPP || 'true').toLowerCase() !== 'false';
  }

  static async #sendAiWhatsappReply(contactPayload) {
    let aiResult;
    let usedPrivateFallback = false;
    let aiProviderError     = null;

    try {
      aiResult = await generateContactReplyWithProviderFallback(contactPayload);
    } catch (providerError) {
      aiProviderError = providerError.message || 'AI provider error';

      console.error('[CONTACT FORM AI PROVIDER ERROR - FALLBACK TO PRIVATE AGENT]', {
        errorMessage: aiProviderError,
        errorDetails: providerError,
        timestamp:    new Date().toISOString(),
        userPhone:    contactPayload.phone,
        note:         'Using chatbotPrivateController fallback instead'
      });

      safeLog('CONTACT_FORM_AI_PROVIDER_FAILED_USING_PRIVATE_FALLBACK', {
        phone: contactPayload.phone,
        error: aiProviderError
      }, 'warn');

      try {
        const privateResult = generatePrivateContactReply({
          name:    contactPayload.name,
          phone:   contactPayload.phone,
          subject: contactPayload.subject,
          message: contactPayload.message,
        });

        aiResult = {
          reply:            privateResult.reply,
          provider:         'private_agent',
          primaryProvider:  'chatgpt',
          fallbackUsed:     true,
          fallbackProvider: 'private_agent',
          primaryError:     aiProviderError
        };
        usedPrivateFallback = true;

        console.log('[CONTACT FORM PRIVATE AGENT FALLBACK SUCCESS]', {
          userPhone:   contactPayload.phone,
          replyLength: privateResult.reply.length
        });
      } catch (privateError) {
        console.error('[CONTACT FORM PRIVATE AGENT FALLBACK ALSO FAILED]', {
          originalError: aiProviderError,
          fallbackError: privateError.message,
          timestamp:     new Date().toISOString()
        });
        throw new Error(`Both AI providers and private agent failed: ${privateError.message}`);
      }
    }

    const aiReply        = aiResult.reply;
    const whatsappResult = await sendWhatsAppMessage(contactPayload.phone, aiReply);

    const session = await findOrCreateSession(contactPayload.name, contactPayload.phone, 'contact_form');
    await saveUserMessage(session.id, `${contactPayload.subject}\n${contactPayload.message}`, 'contact_form', {
      email: contactPayload.email
    });
    await saveAssistantMessage(session.id, aiReply, 'whatsapp', {
      whatsappTarget:    whatsappResult.target,
      source:            aiResult.provider,
      primaryProvider:   aiResult.primaryProvider,
      fallbackUsed:      aiResult.fallbackUsed,
      fallbackProvider:  aiResult.fallbackProvider || null,
      primaryError:      aiResult.primaryError || null,
      usedPrivateFallback,
      aiProviderErrorMessage: aiProviderError
    });

    return {
      aiReply,
      aiProvider:       aiResult.provider,
      primaryProvider:  aiResult.primaryProvider,
      fallbackUsed:     aiResult.fallbackUsed,
      fallbackProvider: aiResult.fallbackProvider || null,
      primaryError:     aiResult.primaryError || null,
      usedPrivateFallback,
      whatsappTarget:   whatsappResult.target,
      fonnteResponse:   whatsappResult.response
    };
  }

  static async submitContact(req, res) {
    const contactPayload = ContactController.#sanitize(req.body);

    safeLog('FORM_SUBMIT_ATTEMPT', {
      name:    contactPayload.name,
      email:   contactPayload.email,
      phone:   contactPayload.phone,
      subject: contactPayload.subject
    });

    const validation = validateContactForm(contactPayload);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message, error: validation.message });
    }

    let googleSheetSent  = false;
    let googleSheetError = null;
    let databaseSaved    = false;
    let newContact       = null;

    try {
      newContact    = await Contact.create(contactPayload);
      databaseSaved = true;
      safeLog('FORM_SUBMIT_DATABASE_SUCCESS', `Contact ID: ${newContact.id}`);

      try {
        await appendContactRow({ ...contactPayload, source: 'Website Contact Form' });
        googleSheetSent = true;
      } catch (sheetError) {
        googleSheetError = sheetError.message || 'Google Sheets sync failed.';
        safeLog('GOOGLE_SHEETS_SYNC_FAILED_NON_BLOCKING', googleSheetError, 'error');
        console.error('[CONTACT GOOGLE SHEETS NON-BLOCKING ERROR]', {
          message: googleSheetError,
          note:    'Contact form submission is still saved in database.'
        });
      }

      if (!ContactController.#isAiWhatsappEnabled()) {
        return res.json({
          success:          true,
          googleSheetSent,
          googleSheetError,
          databaseSaved,
          whatsappSent:     false,
          contactId:        newContact.id,
          message:          googleSheetSent
            ? 'Message received, sent to Google Spreadsheet, and saved to database successfully. AI WhatsApp reply is disabled.'
            : 'Message received and saved to database successfully. Google Sheets sync failed in backend, but your form submission was accepted. AI WhatsApp reply is disabled.'
        });
      }

      try {
        const aiWhatsappResult = await ContactController.#sendAiWhatsappReply(contactPayload);

        if (aiWhatsappResult.usedPrivateFallback) {
          console.log('[CONTACT FORM] Message queued via private agent fallback (ChatGPT/Claude unavailable)');
        }

        safeLog('AI_WHATSAPP_SENT', {
          contactId:          newContact.id,
          target:             aiWhatsappResult.whatsappTarget,
          usedPrivateFallback: aiWhatsappResult.usedPrivateFallback
        });

        return res.json({
          success:             true,
          googleSheetSent,
          googleSheetError,
          databaseSaved,
          whatsappSent:        true,
          contactId:           newContact.id,
          whatsappTarget:      aiWhatsappResult.whatsappTarget,
          aiReply:             aiWhatsappResult.aiReply,
          aiProvider:          aiWhatsappResult.aiProvider,
          primaryProvider:     aiWhatsappResult.primaryProvider,
          fallbackUsed:        aiWhatsappResult.fallbackUsed,
          fallbackProvider:    aiWhatsappResult.fallbackProvider || null,
          usedPrivateFallback: aiWhatsappResult.usedPrivateFallback || false,
          primaryError:        aiWhatsappResult.primaryError || null,
          fonnteResponse:      aiWhatsappResult.fonnteResponse,
          message:             aiWhatsappResult.usedPrivateFallback
            ? 'Message received and saved. Reply sent via backup AI system (primary providers temporarily unavailable).'
            : googleSheetSent
              ? 'Message received, sent to Google Spreadsheet, saved to database, and AI WhatsApp reply sent successfully.'
              : 'Message received and saved to database successfully. Google Sheets sync failed in backend, but AI WhatsApp reply was sent successfully.'
        });

      } catch (aiWhatsappError) {
        console.error('[CONTACT FORM] AI reply generation failed completely:', {
          error:     aiWhatsappError.message,
          phone:     contactPayload.phone,
          timestamp: new Date().toISOString()
        });

        safeLog('AI_WHATSAPP_FAILED_COMPLETELY', aiWhatsappError.message, 'error');

        return res.status(200).json({
          success:         true,
          googleSheetSent,
          googleSheetError,
          databaseSaved,
          whatsappSent:    false,
          contactId:       newContact.id,
          whatsappTarget:  normalizeWhatsAppNumber(contactPayload.phone),
          message:         'Message received and saved to database successfully. Our system is currently processing your inquiry. You will receive a response via WhatsApp shortly.'
        });
      }

    } catch (error) {
      safeLog('CONTACT_SUBMIT_FAILED', error.message, 'error');

      return res.status(500).json({
        success:         false,
        googleSheetSent,
        googleSheetError,
        databaseSaved,
        whatsappSent:    false,
        contactId:       newContact?.id || null,
        message:         error.message || 'Failed to save message.',
        error:           error.message || 'Failed to save message.'
      });
    }
  }

  static async googleSheetsStatus(req, res) {
    try {
      const status = await getGoogleSheetsStatus();
      return res.json({
        success: true,
        message: 'Google Sheets connection is OK.',
        ...status
      });
    } catch (error) {
      return res.status(500).json({
        success:        false,
        message:        error.message,
        error:          error.message,
        actionRequired: 'Check backend/google-service-account.json, backend/.env, Google Sheets API enablement, and spreadsheet sharing permission.'
      });
    }
  }

  static async aiWhatsappStatus(req, res) {
    const aiConfig    = checkAIProviderConfig();
    const fonnteConfig = checkFonnteConfig();
    const openAIConfig = checkChatGPTConfig();

    const aiReady =
      (aiConfig.primaryProvider === 'chatgpt' && aiConfig.chatGPT.hasApiKey && aiConfig.chatGPT.keyLooksValid) ||
      (aiConfig.primaryProvider === 'claude'  && aiConfig.claude.hasApiKey  && aiConfig.claude.keyLooksValid) ||
      aiConfig.claudeFallbackReady;

    const success = aiReady && fonnteConfig.hasToken;

    return res.status(success ? 200 : 500).json({
      success,
      aiWhatsappEnabled: ContactController.#isAiWhatsappEnabled(),
      aiProviders:       aiConfig,
      openAI: {
        hasApiKey:     openAIConfig.hasApiKey,
        keyLooksValid: openAIConfig.keyLooksValid,
        maskedKey:     openAIConfig.maskedKey,
        model:         openAIConfig.model,
        provider:      'chatgpt'
      },
      fonnte: {
        hasToken: fonnteConfig.hasToken
      },
      message: success
        ? 'AI provider and Fonnte configuration are ready.'
        : 'AI provider or Fonnte configuration is not ready. Check OPENAI_API_KEY, ANTHROPIC_API_KEY, ENABLE_CLAUDE_FALLBACK, and FONNTE_TOKEN in backend/.env.'
    });
  }
}

module.exports = ContactController;
