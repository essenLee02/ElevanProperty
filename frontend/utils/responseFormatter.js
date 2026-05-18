function success(res, message, data = {}, status = 200) {
  return res.status(status).json({ success: true, message, ...data });
}

function error(res, message, errors = [], status = 500) {
  return res.status(status).json({ success: false, message, errors });
}

module.exports = { success, error };
