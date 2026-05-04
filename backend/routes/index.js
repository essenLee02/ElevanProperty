const express = require('express');
const router = express.Router();

const homeController = require('../controllers/homeController');
const aboutController = require('../controllers/aboutController');
const contactController = require('../controllers/contactController');
const logController = require('../controllers/logController');

// Module Home
router.get('/home', homeController.index);

// Module About Us
router.get('/about', aboutController.index);

// Module Contact
router.post('/contact', contactController.submitContact);
router.get('/contact/google-sheets-status', contactController.googleSheetsStatus);

// Module Logger
router.post('/log', logController.saveLog);

module.exports = router;
