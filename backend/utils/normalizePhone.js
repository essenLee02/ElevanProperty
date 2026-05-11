function normalizePhone(phone) {
  let value = String(phone || '').trim();
  value = value.replace(/[\s\-]/g, '');
  if (value.startsWith('+')) value = value.slice(1);
  if (value.startsWith('0')) value = `62${value.slice(1)}`;
  if (value.startsWith('8')) value = `62${value}`;
  return value;
}

function isValidPhoneInput(phone) {
  return /^[0-9+\-\s]+$/.test(String(phone || ''));
}

module.exports = {
  normalizePhone,
  isValidPhoneInput
};
