const { Log } = require('../models');
const { maskSecrets } = require('../utils/safeLog');

exports.saveLog = async (req, res) => {
  const action = String(req.body.action || 'UNKNOWN');
  const details = maskSecrets(req.body.details || '');
  const level = String(req.body.level || 'info');

  console.log(`[USER LOG] Action: ${action} | Details: ${details}`);

  try {
    await Log.create({ action, details, level });
  } catch (error) {
    console.error('Failed to save log to database:', error.message);
  }

  return res.json({ success: true });
};
