/**
 * viewingScheduleController.js
 *
 * Handle viewing/survey scheduling requests dari AI qualification flow.
 * Flow: AI deteksi tanggal/jam viewing → kirim ke endpoint ini → buat Google Calendar event
 *
 * POST /api/viewing/schedule
 *   - agentUserId: agen yang punya property
 *   - customerName: nama customer
 *   - customerEmail: email customer (opsional)
 *   - propertyId: ID property (opsional, untuk log/reference)
 *   - propertyAddress: alamat property
 *   - propertyType: tipe property (house, villa, apartment, dll)
 *   - transactionType: 'rent' | 'sale' | 'booking'
 *   - dateString: '2026-07-19' (YYYY-MM-DD)
 *   - timeString: '14:00' (HH:MM)
 */

const { scheduleViewing, detectViewingDateTime } = require('../services/googleCalendarService');
const User = require('../models/User');
const { isPropertyContextContinuation, hasPropertyKeyword } = require('../utils/propertyKeywordFilter');

/**
 * POST /api/viewing/schedule
 * Buat viewing appointment di Google Calendar.
 */
async function scheduleViewingAppointment(req, res) {
  try {
    const {
      agentUserId,
      customerName,
      customerEmail,
      propertyId,
      propertyAddress = 'TBD',
      propertyType = 'properti',
      transactionType = 'rent',
      dateString,
      timeString = '10:00',
    } = req.body;

    // ── Validasi input wajib
    if (!agentUserId) {
      return res.status(400).json({
        success: false,
        message: 'agentUserId wajib diisi.',
      });
    }

    if (!customerName) {
      return res.status(400).json({
        success: false,
        message: 'customerName wajib diisi.',
      });
    }

    if (!dateString) {
      return res.status(400).json({
        success: false,
        message: 'dateString wajib diisi (format: YYYY-MM-DD).',
      });
    }

    // ── Ambil email agen dari users model
    let agent;
    try {
      agent = await User.findByPk(agentUserId);
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: `Agen dengan ID ${agentUserId} tidak ditemukan.`,
        });
      }
    } catch (dbErr) {
      console.error('[ViewingSchedule] User lookup error:', dbErr.message);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data agen dari database.',
      });
    }

    const agentEmail = agent.email;
    if (!agentEmail) {
      return res.status(400).json({
        success: false,
        message: `Agen ${agent.name} tidak punya email di sistem. Jadwal tidak bisa dibuat.`,
      });
    }

    // ── Panggil Google Calendar Service
    const result = await scheduleViewing({
      agentEmail,
      customerName,
      customerEmail,
      dateString,
      timeString,
      propertyAddress,
      propertyType,
      transactionType,
      agentName: agent.name || 'Agen Properti',
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    // ── Log to database (opsional: simpan ke viewing_schedules table)
    console.log('[ViewingSchedule] ✅ Event created:', {
      agentId: agentUserId,
      customerName,
      propertyId,
      eventId: result.eventId,
      dateTime: result.startDateTime,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
      eventId: result.eventId,
      eventLink: result.eventLink,
      agentEmail,
      agentName: agent.name,
      startDateTime: result.startDateTime,
    });
  } catch (err) {
    console.error('[ViewingSchedule] Unhandled error:', err);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan saat membuat jadwal.',
      error: err.message,
    });
  }
}

/**
 * Detect viewing request dari pesan customer (untuk AI integration).
 * POST /api/viewing/detect
 *   - message: pesan dari customer
 *
 * Returns: { hasViewingRequest: bool, dateString?: string, timeString?: string }
 */
async function detectViewingRequest(req, res) {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'message wajib diisi.',
      });
    }

    const result = detectViewingDateTime(message);

    if (!result) {
      return res.status(200).json({
        hasViewingRequest: false,
        message: 'Tidak ada viewing request terdeteksi.',
      });
    }

    return res.status(200).json({
      hasViewingRequest: true,
      dateString: result.dateString,
      timeString: result.timeString,
      message: 'Viewing request terdeteksi.',
    });
  } catch (err) {
    console.error('[ViewingSchedule] Detect error:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal mendeteksi viewing request.',
      error: err.message,
    });
  }
}

module.exports = {
  scheduleViewingAppointment,
  detectViewingRequest,
};
