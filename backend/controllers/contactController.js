const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const Contact = require('../models/Contact');
const openaiService = require('../services/openaiService');
const fonnteService = require('../services/fonnteService');

const REQUIRED_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'subject', label: 'Subject' },
  { key: 'message', label: 'Message' }
];

const GOOGLE_SHEET_HEADERS = [
  'Timestamp',
  'Name',
  'Email',
  'Phone',
  'Subject',
  'Message',
  'Source'
];

const getGoogleSheetConfig = () => {
  const jsonPathFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || './google-service-account.json';

  return {
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    sheetGid: process.env.GOOGLE_SHEET_GID || '0',
    sheetTitle: process.env.GOOGLE_SHEET_TAB_NAME || '',
    serviceAccountJsonPath: path.resolve(process.cwd(), jsonPathFromEnv)
  };
};

const readServiceAccount = (serviceAccountJsonPath) => {
  if (!fs.existsSync(serviceAccountJsonPath)) {
    throw new Error(
      `Service Account JSON file was not found: ${serviceAccountJsonPath}. ` +
      'Please copy google-service-account.json into the backend folder.'
    );
  }

  const rawJson = fs.readFileSync(serviceAccountJsonPath, 'utf8');
  const serviceAccount = JSON.parse(rawJson);

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Invalid Service Account JSON. Missing client_email or private_key.');
  }

  return serviceAccount;
};

const validateGoogleSheetConfig = (config) => {
  const missingConfig = [];

  if (!config.spreadsheetId) missingConfig.push('GOOGLE_SHEET_ID');
  if (!config.serviceAccountJsonPath) missingConfig.push('GOOGLE_SERVICE_ACCOUNT_JSON_PATH');

  if (missingConfig.length) {
    throw new Error(`Google Sheets configuration is incomplete. Missing: ${missingConfig.join(', ')}`);
  }
};

const getJakartaTimestamp = () => new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
}).format(new Date());

const createGoogleDocument = () => {
  const config = getGoogleSheetConfig();
  validateGoogleSheetConfig(config);

  const serviceAccount = readServiceAccount(config.serviceAccountJsonPath);

  const serviceAccountAuth = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const doc = new GoogleSpreadsheet(config.spreadsheetId, serviceAccountAuth);

  return {
    doc,
    config,
    serviceAccountEmail: serviceAccount.client_email
  };
};

const buildPermissionErrorMessage = (serviceAccountEmail, spreadsheetId) => {
  return (
    'Google Sheets permission error. Please open the Google Spreadsheet, click Share, ' +
    `add this service account email as Editor: ${serviceAccountEmail}. ` +
    `Spreadsheet ID used by backend: ${spreadsheetId}. ` +
    'After sharing, wait a few seconds and restart the backend.'
  );
};

const normalizeGoogleError = (error, serviceAccountEmail, spreadsheetId) => {
  const status = error?.response?.status;
  const message = error?.message || '';

  if (status === 403 || message.includes('[403]') || message.includes('caller does not have permission')) {
    return new Error(buildPermissionErrorMessage(serviceAccountEmail, spreadsheetId));
  }

  if (status === 404 || message.includes('[404]')) {
    return new Error(
      `Google Spreadsheet was not found. Please check GOOGLE_SHEET_ID: ${spreadsheetId}. ` +
      `Also make sure the spreadsheet is shared to: ${serviceAccountEmail}`
    );
  }

  return error;
};

const getTargetSheet = async (doc, config, serviceAccountEmail) => {
  try {
    await doc.loadInfo();
  } catch (error) {
    throw normalizeGoogleError(error, serviceAccountEmail, config.spreadsheetId);
  }

  if (config.sheetGid && doc.sheetsById[config.sheetGid]) {
    return doc.sheetsById[config.sheetGid];
  }

  if (config.sheetTitle && doc.sheetsByTitle[config.sheetTitle]) {
    return doc.sheetsByTitle[config.sheetTitle];
  }

  return doc.sheetsByIndex[0];
};

const ensureGoogleSheetHeader = async (sheet) => {
  try {
    await sheet.loadHeaderRow();
  } catch (error) {
    const message = error.message || '';
    const headerIsBlank =
      message.includes('No values in the header row') ||
      message.includes('All your header cells are blank') ||
      message.includes('No values in header row');

    if (!headerIsBlank) throw error;

    await sheet.setHeaderRow(GOOGLE_SHEET_HEADERS);
    return;
  }

  const existingHeaders = (sheet.headerValues || []).map((header) => String(header).trim());
  const missingHeaders = GOOGLE_SHEET_HEADERS.filter((header) => !existingHeaders.includes(header));

  if (missingHeaders.length) {
    throw new Error(
      `Google Sheet header is incomplete. Please add these headers in row 1: ${missingHeaders.join(', ')}`
    );
  }
};

const sanitizeContactPayload = (body) => ({
  name: String(body.name || '').trim(),
  email: String(body.email || '').trim(),
  phone: String(body.phone || '').trim(),
  subject: String(body.subject || '').trim(),
  message: String(body.message || '').trim()
});

exports.submitToGoogleSheets = async (contactData) => {
  const { doc, config, serviceAccountEmail } = createGoogleDocument();
  const sheet = await getTargetSheet(doc, config, serviceAccountEmail);

  if (!sheet) {
    throw new Error('No worksheet/tab found in the configured Google Spreadsheet.');
  }

  await ensureGoogleSheetHeader(sheet);

  return sheet.addRow({
    Timestamp: getJakartaTimestamp(),
    Name: contactData.name,
    Email: contactData.email,
    Phone: contactData.phone,
    Subject: contactData.subject,
    Message: contactData.message,
    Source: 'Website Contact Form'
  });
};

exports.googleSheetsStatus = async (req, res) => {
  let serviceAccountEmail = null;
  let spreadsheetId = null;

  try {
    const { doc, config, serviceAccountEmail: email } = createGoogleDocument();
    serviceAccountEmail = email;
    spreadsheetId = config.spreadsheetId;

    const sheet = await getTargetSheet(doc, config, serviceAccountEmail);

    return res.json({
      success: true,
      message: 'Google Sheets connection is OK.',
      spreadsheetId: config.spreadsheetId,
      targetSheetTitle: sheet?.title || null,
      serviceAccountEmail
    });
  } catch (error) {
    const normalizedError = normalizeGoogleError(error, serviceAccountEmail, spreadsheetId);

    return res.status(500).json({
      success: false,
      error: normalizedError.message,
      serviceAccountEmail,
      spreadsheetId,
      actionRequired: serviceAccountEmail
        ? `Share the Google Spreadsheet to ${serviceAccountEmail} as Editor.`
        : 'Check backend/google-service-account.json and backend/.env.'
    });
  }
};


const shouldSendAiWhatsapp = () => {
  return String(process.env.ENABLE_AI_WHATSAPP || 'true').toLowerCase() !== 'false';
};

const sendAiWhatsappReply = async (contactPayload) => {
  const aiReply = await openaiService.generateContactReply(contactPayload);
  const fonnteResult = await fonnteService.sendWhatsAppMessage(contactPayload.phone, aiReply);

  return {
    sent: true,
    target: fonnteResult.target,
    aiReply,
    fonnteResponse: fonnteResult.response
  };
};

exports.aiWhatsappStatus = async (req, res) => {
  const testOpenAI = String(req.query.testOpenAI || '').toLowerCase() === 'true';

  try {
    const status = {
      success: true,
      aiWhatsappEnabled: shouldSendAiWhatsapp(),
      openai: openaiService.getOpenAIStatus(),
      fonnte: fonnteService.getFonnteStatus(),
      note: 'Use ?testOpenAI=true to test OpenAI with a small request. This may consume a small amount of API credit.'
    };

    if (testOpenAI) {
      status.openaiTest = await openaiService.testOpenAIConnection();
    }

    return res.json(status);
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
      aiWhatsappEnabled: shouldSendAiWhatsapp(),
      openai: openaiService.getOpenAIStatus(),
      fonnte: fonnteService.getFonnteStatus()
    });
  }
};

exports.submitContact = async (req, res) => {
  const contactPayload = sanitizeContactPayload(req.body);

  console.log(
    `[USER LOG] Action: FORM_SUBMIT_ATTEMPT | Details: ${JSON.stringify({
      name: contactPayload.name,
      email: contactPayload.email,
      phone: contactPayload.phone,
      subject: contactPayload.subject
    })}`
  );

  const blankSections = REQUIRED_FIELDS
    .filter((field) => !contactPayload[field.key])
    .map((field) => field.label);

  if (blankSections.length) {
    return res.status(400).json({
      success: false,
      error: `The following sections are blank: ${blankSections.join(', ')}`
    });
  }

  try {
    // Submit to Google Sheets first. This prevents duplicate MySQL rows when Google permission is not ready.
    await exports.submitToGoogleSheets(contactPayload);

    const newContact = await Contact.create(contactPayload);

    console.log(`[USER LOG] Action: FORM_SUBMIT_SUCCESS | Details: Contact ID: ${newContact.id}`);

    let aiWhatsappResult = {
      sent: false,
      skipped: true,
      reason: 'AI WhatsApp sending is disabled.'
    };

    if (shouldSendAiWhatsapp()) {
      try {
        aiWhatsappResult = await sendAiWhatsappReply(contactPayload);
        console.log(
          `[USER LOG] Action: AI_WHATSAPP_SENT | Details: Contact ID: ${newContact.id}, Target: ${aiWhatsappResult.target}`
        );
      } catch (aiWhatsappError) {
        aiWhatsappResult = {
          sent: false,
          skipped: false,
          error: aiWhatsappError.message
        };

        console.error('Failed to send AI WhatsApp reply:', aiWhatsappError);
      }
    }

    return res.json({
      success: true,
      message: aiWhatsappResult.sent
        ? 'Message received, sent to Google Spreadsheet, saved to database, and AI WhatsApp reply was sent successfully!'
        : 'Message received, sent to Google Spreadsheet, and saved to database. AI WhatsApp reply was not sent.',
      contactId: newContact.id,
      aiWhatsapp: {
        sent: aiWhatsappResult.sent,
        target: aiWhatsappResult.target || null,
        error: aiWhatsappResult.error || null,
        skipped: aiWhatsappResult.skipped || false,
        reason: aiWhatsappResult.reason || null
      }
    });
  } catch (error) {
    console.error('Error saving contact:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to save message.'
    });
  }
};
