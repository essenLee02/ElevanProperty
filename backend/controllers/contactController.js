const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const Contact = require('../models/Contact');
const { generateContactReply, checkOpenAIConfig } = require('../services/openaiService');
const { sendWhatsAppMessage, normalizeWhatsAppNumber, checkFonnteConfig } = require('../services/fonnteService');

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

const isAiWhatsappEnabled = () => String(process.env.ENABLE_AI_WHATSAPP || 'true').toLowerCase() !== 'false';

const buildAiWhatsappReply = async (contactPayload) => {
  const aiReply = await generateContactReply(contactPayload);
  const whatsappResult = await sendWhatsAppMessage(contactPayload.phone, aiReply);

  return {
    aiReply,
    whatsappTarget: whatsappResult.target,
    fonnteResponse: whatsappResult.response
  };
};

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

exports.aiWhatsappStatus = async (req, res) => {
  const openAIConfig = checkOpenAIConfig();
  const fonnteConfig = checkFonnteConfig();

  return res.json({
    success: openAIConfig.hasApiKey && fonnteConfig.hasToken,
    aiWhatsappEnabled: isAiWhatsappEnabled(),
    openAI: {
      hasApiKey: openAIConfig.hasApiKey,
      model: openAIConfig.model
    },
    fonnte: {
      hasToken: fonnteConfig.hasToken
    },
    message: openAIConfig.hasApiKey && fonnteConfig.hasToken
      ? 'OpenAI and Fonnte configuration are present.'
      : 'OPENAI_API_KEY or FONNTE_TOKEN is missing in backend .env.'
  });
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
    // 1. Submit to Google Sheets first. This prevents duplicate MySQL rows when Google permission is not ready.
    await exports.submitToGoogleSheets(contactPayload);

    // 2. Save to MySQL database.
    const newContact = await Contact.create(contactPayload);
    console.log(`[USER LOG] Action: FORM_SUBMIT_SUCCESS | Details: Contact ID: ${newContact.id}`);

    // 3. Send the contact form data to OpenAI, then send OpenAI's reply to WhatsApp via Fonnte.
    if (!isAiWhatsappEnabled()) {
      return res.json({
        success: true,
        googleSheetSent: true,
        databaseSaved: true,
        whatsappSent: false,
        contactId: newContact.id,
        message: 'Message received, sent to Google Spreadsheet, and saved to database successfully. AI WhatsApp reply is disabled.'
      });
    }

    try {
      const aiWhatsappResult = await buildAiWhatsappReply(contactPayload);

      console.log(
        `[USER LOG] Action: AI_WHATSAPP_SENT | Details: ${JSON.stringify({
          contactId: newContact.id,
          target: aiWhatsappResult.whatsappTarget
        })}`
      );

      return res.json({
        success: true,
        googleSheetSent: true,
        databaseSaved: true,
        whatsappSent: true,
        contactId: newContact.id,
        whatsappTarget: aiWhatsappResult.whatsappTarget,
        aiReply: aiWhatsappResult.aiReply,
        fonnteResponse: aiWhatsappResult.fonnteResponse,
        message: 'Message received, sent to Google Spreadsheet, saved to database, and AI WhatsApp reply sent successfully!'
      });
    } catch (aiWhatsappError) {
      console.error('Failed to send AI WhatsApp reply:', aiWhatsappError);

      return res.status(200).json({
        success: true,
        googleSheetSent: true,
        databaseSaved: true,
        whatsappSent: false,
        contactId: newContact.id,
        whatsappTarget: normalizeWhatsAppNumber(contactPayload.phone),
        aiWhatsappError: aiWhatsappError.message || 'Failed to send AI WhatsApp reply.',
        message: 'Message received, sent to Google Spreadsheet, and saved to database. However, the AI WhatsApp reply failed. Please check OPENAI_API_KEY, OPENAI_MODEL, FONNTE_TOKEN, Fonnte device connection, and WhatsApp quota.'
      });
    }
  } catch (error) {
    console.error('Error saving contact:', error);

    return res.status(500).json({
      success: false,
      googleSheetSent: false,
      databaseSaved: false,
      whatsappSent: false,
      error: error.message || 'Failed to save message.'
    });
  }
};
