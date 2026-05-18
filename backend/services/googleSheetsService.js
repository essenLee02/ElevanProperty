const fs = require('fs');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const GOOGLE_SHEET_HEADERS = ['Timestamp', 'Name', 'Email', 'Phone', 'Subject', 'Message', 'Source'];

function getConfig() {
  const jsonPathFromEnv = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || './google-service-account.json';
  return {
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    sheetGid: process.env.GOOGLE_SHEET_GID || '0',
    sheetTitle: process.env.GOOGLE_SHEET_TAB_NAME || '',
    serviceAccountJsonPath: path.resolve(process.cwd(), jsonPathFromEnv)
  };
}

function readServiceAccount(serviceAccountJsonPath) {
  if (!fs.existsSync(serviceAccountJsonPath)) {
    throw new Error(`Service Account JSON file was not found: ${serviceAccountJsonPath}. Please copy google-service-account.json into the backend folder.`);
  }

  const rawJson = fs.readFileSync(serviceAccountJsonPath, 'utf8');
  const serviceAccount = JSON.parse(rawJson);

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Invalid Service Account JSON. Missing client_email or private_key.');
  }

  return serviceAccount;
}

function validateConfig(config) {
  const missing = [];
  if (!config.spreadsheetId) missing.push('GOOGLE_SHEET_ID');
  if (!config.serviceAccountJsonPath) missing.push('GOOGLE_SERVICE_ACCOUNT_JSON_PATH');
  if (missing.length) throw new Error(`Google Sheets configuration is incomplete. Missing: ${missing.join(', ')}`);
}

function createDocument() {
  const config = getConfig();
  validateConfig(config);
  const serviceAccount = readServiceAccount(config.serviceAccountJsonPath);

  const serviceAccountAuth = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return {
    doc: new GoogleSpreadsheet(config.spreadsheetId, serviceAccountAuth),
    config,
    serviceAccountEmail: serviceAccount.client_email
  };
}

function buildPermissionErrorMessage(serviceAccountEmail, spreadsheetId) {
  return (
    'Google Sheets permission error. Please open the Google Spreadsheet, click Share, ' +
    `add this service account email as Editor: ${serviceAccountEmail}. ` +
    `Spreadsheet ID used by backend: ${spreadsheetId}. ` +
    'After sharing, wait a few seconds and restart the backend.'
  );
}

function normalizeGoogleError(error, serviceAccountEmail, spreadsheetId) {
  const status = error?.response?.status;
  const message = error?.message || '';

  if (status === 403 || message.includes('[403]') || message.toLowerCase().includes('caller does not have permission')) {
    return new Error(buildPermissionErrorMessage(serviceAccountEmail, spreadsheetId));
  }

  if (
    status === 401 ||
    message.includes('[401]') ||
    message.toLowerCase().includes('invalid_grant') ||
    message.toLowerCase().includes('invalid jwt signature')
  ) {
    return new Error(
      'Google Sheets authentication failed in backend service account. Contact Form does not require user login/JWT. ' +
      'Please check backend/google-service-account.json, private_key formatting, service account status, Google Sheets API enablement, and system clock.'
    );
  }

  if (status === 404 || message.includes('[404]')) {
    return new Error(`Google Spreadsheet was not found. Please check GOOGLE_SHEET_ID: ${spreadsheetId}. Also make sure the spreadsheet is shared to: ${serviceAccountEmail}`);
  }

  return error;
}

async function getTargetSheet() {
  const { doc, config, serviceAccountEmail } = createDocument();

  try {
    await doc.loadInfo();
  } catch (error) {
    throw normalizeGoogleError(error, serviceAccountEmail, config.spreadsheetId);
  }

  let sheet = null;
  if (config.sheetGid && doc.sheetsById[config.sheetGid]) sheet = doc.sheetsById[config.sheetGid];
  else if (config.sheetTitle && doc.sheetsByTitle[config.sheetTitle]) sheet = doc.sheetsByTitle[config.sheetTitle];
  else sheet = doc.sheetsByIndex[0];

  if (!sheet) throw new Error('No worksheet/tab found in the configured Google Spreadsheet.');

  return { sheet, config, serviceAccountEmail };
}

async function ensureHeaderRow(sheet) {
  try {
    await sheet.loadHeaderRow();
  } catch (error) {
    const message = error.message || '';
    const headerIsBlank = message.includes('No values in the header row') || message.includes('All your header cells are blank') || message.includes('No values in header row');
    if (!headerIsBlank) throw error;
    await sheet.setHeaderRow(GOOGLE_SHEET_HEADERS);
    return;
  }

  const existingHeaders = (sheet.headerValues || []).map((header) => String(header).trim());
  const missingHeaders = GOOGLE_SHEET_HEADERS.filter((header) => !existingHeaders.includes(header));
  if (missingHeaders.length) {
    throw new Error(`Google Sheet header is incomplete. Please add these headers in row 1: ${missingHeaders.join(', ')}`);
  }
}

function getJakartaTimestamp() {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date());
}

async function appendContactRow(contactData) {
  const { sheet } = await getTargetSheet();
  await ensureHeaderRow(sheet);
  return sheet.addRow({
    Timestamp: getJakartaTimestamp(),
    Name: contactData.name,
    Email: contactData.email,
    Phone: contactData.phone,
    Subject: contactData.subject,
    Message: contactData.message,
    Source: contactData.source || 'Website Contact Form'
  });
}

async function getGoogleSheetsStatus() {
  const { sheet, config, serviceAccountEmail } = await getTargetSheet();
  return {
    spreadsheetId: config.spreadsheetId,
    targetSheetTitle: sheet.title,
    serviceAccountEmail
  };
}

module.exports = {
  appendContactRow,
  getGoogleSheetsStatus,
  ensureHeaderRow,
  getTargetSheet,
  normalizeGoogleError,
  buildPermissionErrorMessage
};
