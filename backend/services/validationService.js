const { isValidPhoneInput } = require('../utils/normalizePhone');

function validateRequiredFields(data, fields) {
  return fields.filter((field) => !String(data[field.key] || '').trim()).map((field) => field.label);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validatePhone(phone) {
  const value = String(phone || '').trim();
  return Boolean(value) && isValidPhoneInput(value);
}

function validateContactForm(body) {
  const requiredFields = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'subject', label: 'Subject' },
    { key: 'message', label: 'Message' }
  ];

  const missing = validateRequiredFields(body, requiredFields);
  if (missing.length) {
    return { valid: false, message: `The following sections are blank: ${missing.join(', ')}` };
  }

  if (!validateEmail(body.email)) {
    return { valid: false, message: 'Please enter a valid email address.' };
  }

  if (!validatePhone(body.phone)) {
    return { valid: false, message: 'Phone only accepts numbers, +, -, and spaces.' };
  }

  return { valid: true, message: '' };
}

function validateChatbotMessage(body) {
  const requiredFields = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'message', label: 'Message' }
  ];

  const missing = validateRequiredFields(body, requiredFields);
  if (missing.length) {
    return { valid: false, message: `The following sections are blank: ${missing.join(', ')}` };
  }

  if (!validatePhone(body.phone)) {
    return { valid: false, message: 'Phone only accepts numbers, +, -, and spaces.' };
  }

  return { valid: true, message: '' };
}

module.exports = {
  validateRequiredFields,
  validateEmail,
  validatePhone,
  validateContactForm,
  validateChatbotMessage
};
