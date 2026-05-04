exports.saveLog = (req, res) => {
  const { action, details } = req.body;
  console.log(`[USER LOG] Action: ${action} | Details: ${typeof details === 'object' ? JSON.stringify(details) : details}`);
  res.json({ success: true });
};
