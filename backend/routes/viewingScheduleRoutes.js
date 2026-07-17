/**
 * viewingScheduleRoutes.js
 *
 * Routes untuk viewing scheduling (Google Calendar integration).
 */

const express = require('express');
const router = express.Router();
const { scheduleViewingAppointment, detectViewingRequest } = require('../controllers/viewingScheduleController');

/**
 * POST /api/viewing/schedule
 * Buat viewing appointment di Google Calendar.
 */
router.post('/schedule', scheduleViewingAppointment);

/**
 * POST /api/viewing/detect
 * Detect viewing request dari pesan customer.
 */
router.post('/detect', detectViewingRequest);

module.exports = router;
