const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_\-]+/g,
  /Bearer\s+[A-Za-z0-9_\.\-]+/g,
  /Authorization:\s*[^\s,}]+/gi,
  /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g
];

function maskSecrets(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value || {});
  SECRET_PATTERNS.forEach((pattern) => {
    text = text.replace(pattern, '[MASKED_SECRET]');
  });
  return text;
}

function safeLog(action, details = '', level = 'info') {
  const message = `[${String(level).toUpperCase()}] ${action} | ${maskSecrets(details)}`;
  if (level === 'error') console.error(message);
  else if (level === 'warn' || level === 'warning') console.warn(message);
  else console.log(message);
}

module.exports = {
  safeLog,
  maskSecrets
};
