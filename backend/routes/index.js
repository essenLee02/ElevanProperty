const express    = require('express');
const router     = express.Router();
const rateLimit  = require('express-rate-limit');
const { verifyWebhookSecret } = require('../middleware/verifyWebhookSecret');

/* ══════════════════════════════════════════════════════════════════════════════
   RATE LIMITERS
══════════════════════════════════════════════════════════════════════════════ */

// Contact form: 5 req / 15 menit
const contactLimiter = rateLimit({
  windowMs       : 15 * 60 * 1000,
  max            : 5,
  message        : { success: false, message: 'Terlalu banyak pengiriman. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders  : false,
});

// Webhook endpoints: 120 req / menit (cukup untuk volume normal, blok abuse)
const webhookLimiter = rateLimit({
  windowMs       : 60 * 1000,
  max            : 120,
  message        : { success: false, message: 'Rate limit: terlalu banyak request ke webhook.' },
  standardHeaders: true,
  legacyHeaders  : false,
  skip           : () => false,   // Selalu aktif
});

// Log endpoint: 60 req / menit
const logLimiter = rateLimit({
  windowMs       : 60 * 1000,
  max            : 60,
  message        : { success: false, message: 'Rate limit pada log endpoint.' },
  standardHeaders: true,
  legacyHeaders  : false,
});

// Login: 8 percobaan GAGAL / 15 menit per IP (audit keamanan, 25 Agu 2026).
// Sebelumnya /auth/login TIDAK punya rate limit sama sekali — satu-satunya
// endpoint yang memverifikasi password tanpa batas percobaan, padahal contact/
// webhook/log semuanya sudah dilindungi. skipSuccessfulRequests: true supaya
// yang hanya salah ketik password sekali lalu berhasil TIDAK ikut kena hitungan
// — limiter ini menyasar percobaan tebak-password berulang, bukan mengganggu
// login normal yang wajar.
const loginLimiter = rateLimit({
  windowMs               : 15 * 60 * 1000,
  max                    : 8,
  skipSuccessfulRequests : true,
  message                : { success: false, message: 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.' },
  standardHeaders        : true,
  legacyHeaders          : false,
});

/* ══════════════════════════════════════════════════════════════════════════════
   CONTROLLERS
══════════════════════════════════════════════════════════════════════════════ */

const homeController             = require('../controllers/homeController');
const aboutController            = require('../controllers/aboutController');
const contactController          = require('../controllers/contactController');
const chatbotController          = require('../controllers/chatbotController');
const chatbotPrivateController   = require('../controllers/chatbotPrivateController');
const fonnteWebhookController    = require('../controllers/fonnteWebhookController');
const logController              = require('../controllers/logController');
const rumah123Controller         = require('../controllers/rumah123Controller');
const timelinesAIChatController  = require('../controllers/timelinesAIChatController');
const fonnteChatController       = require('../controllers/fonnteChatController');
const viewingScheduleController  = require('../controllers/viewingScheduleController');
const customerMasterController   = require('../controllers/customerMasterController');
const kirimiChatController       = require('../controllers/kirimiChatController');

// Auth controllers
const registerController         = require('../controllers/registerController');
const loginController            = require('../controllers/loginController');
const refreshTokenController     = require('../controllers/refreshTokenController');
const profileController          = require('../controllers/profileController');

// Master data controllers
const facilityMasterController   = require('../controllers/facilityMasterController');
const developerPropertyMasterController = require('../controllers/developerPropertyMasterController');
const leadQualificationController = require('../controllers/leadQualificationController');
const countryMasterController    = require('../controllers/countryMasterController');
const provinceMasterController   = require('../controllers/provinceMasterController');
const cityMasterController       = require('../controllers/cityMasterController');
const propertyMasterController   = require('../controllers/propertyMasterController');
const locationMasterController   = require('../controllers/locationMasterController');
// ⚠️ propertyLocationController merged into propertyMasterController

const { verifyToken, requirePrivilege } = require('../middleware/verifyToken');
const { uploadPropertyImages } = require('../middleware/uploadPropertyImage');

/* ══════════════════════════════════════════════════════════════════════════════
   PUBLIC ROUTES — Tidak butuh autentikasi
══════════════════════════════════════════════════════════════════════════════ */

router.get('/home',   homeController.index);
router.get('/about',  aboutController.index);

router.post('/contact',                    contactLimiter, contactController.submitContact);
router.get('/contact/google-sheets-status',                contactController.googleSheetsStatus);
router.get('/contact/ai-whatsapp-status',                  contactController.aiWhatsappStatus);

// Floating Website Chatbot (public — dipakai tanpa login)
router.get('/chatbot/config',                              chatbotController.getConfig);
router.get('/chatbot/ai-provider-status',                  chatbotController.aiProviderStatus);
router.get('/chatbot/skill-status',                        chatbotController.skillStatus);
router.get('/chatbot/private-status',                      chatbotPrivateController.privateAgentStatus);
router.post('/chatbot/private-message',                    chatbotPrivateController.sendPrivateMessage);
router.post('/chatbot/message',                            chatbotController.sendMessage);

/* ══════════════════════════════════════════════════════════════════════════════
   AUTH ROUTES
══════════════════════════════════════════════════════════════════════════════ */

router.post('/auth/register',   registerController.insertDataAgent);
router.get('/auth/users-count', registerController.countUsers);
router.post('/auth/login',      loginLimiter, loginController.loginUser);
router.get('/auth/refresh',     refreshTokenController.refreshTokenController);
router.delete('/auth/logout',   loginController.logoutUser);
router.get('/auth/me',          loginController.getCurrentUser);

// Test endpoint — butuh login
router.get('/auth/protected-test', verifyToken, (req, res) => {
  return res.json({
    status   : 200,
    data     : { response: req.user, message: 'Anda terautentikasi' },
    isSuccess: 1
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   PROFILE ROUTES — Butuh login (verifyToken)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/profile/me',            verifyToken, profileController.getCurrentProfile);
router.put('/profile/update-agent',  verifyToken, profileController.updateDataAgent);

/* ══════════════════════════════════════════════════════════════════════════════
   WEBHOOK ROUTES — Public tapi rate-limited
   (Dikirim dari platform eksternal: Fonnte, Kirimi, TimelinesAI)
══════════════════════════════════════════════════════════════════════════════ */

// Fonnte legacy webhook
router.post('/fonnte/webhook',       webhookLimiter, verifyWebhookSecret, fonnteWebhookController.handleWebhook);

// Fonnte multi-agent webhook (public)
router.post('/fonnte-chat/webhook',      webhookLimiter, verifyWebhookSecret, fonnteChatController.handleInboundMessage);
router.post('/fonnte-chat/chaining',     webhookLimiter, verifyWebhookSecret, fonnteChatController.handleChainingWebhook);
router.post('/fonnte-chat/webhook-raw',  webhookLimiter, verifyWebhookSecret, fonnteChatController.webhookRawCatcher);

// TimelinesAI webhook (public)
router.post('/timelinesai/webhook',      webhookLimiter, verifyWebhookSecret, timelinesAIChatController.handleInboundMessage);
router.post('/timelinesai/webhook-raw',  webhookLimiter, verifyWebhookSecret, timelinesAIChatController.webhookRawCatcher);

// Kirimi webhook (public)
router.post('/kirimi/webhook',           webhookLimiter, verifyWebhookSecret, kirimiChatController.handleInboundMessage);
router.post('/kirimi/webhook-raw',       webhookLimiter, verifyWebhookSecret, kirimiChatController.webhookRawCatcher);

/* ══════════════════════════════════════════════════════════════════════════════
   WHATSAPP ADMIN ROUTES — Butuh login (verifyToken)
   Endpoint simulate, debug, agent list hanya untuk user terautentikasi.
══════════════════════════════════════════════════════════════════════════════ */

// Fonnte admin endpoints
router.post('/fonnte-chat/simulate',              verifyToken, fonnteChatController.simulateInboundMessage);
router.get('/fonnte-chat/debug-info',             verifyToken, fonnteChatController.getDebugInfo);
router.get('/fonnte-chat/agents',                 verifyToken, fonnteChatController.getAgentsWithFonnte);
router.get('/fonnte-chat/agent-chats/:agentName', verifyToken, fonnteChatController.getAgentChats);
router.get('/fonnte-chat/chat-history/:sessionId',verifyToken, fonnteChatController.getChatHistory);
router.get('/fonnte-chat/status',                 verifyToken, fonnteChatController.getFonnteStatus);
router.get('/fonnte-chat/poller-status',          verifyToken, fonnteChatController.getPollerStatus);
router.post('/fonnte-chat/poller-start',          verifyToken, fonnteChatController.startPoller);
router.post('/fonnte-chat/poller-stop',           verifyToken, fonnteChatController.stopPoller);
router.get('/fonnte-chat/check-fonnte-api',       verifyToken, fonnteChatController.checkFonnteApi);

// TimelinesAI admin endpoints
router.post('/timelinesai/simulate',              verifyToken, timelinesAIChatController.simulateInboundMessage);
router.get('/timelinesai/debug-info',             verifyToken, timelinesAIChatController.getDebugInfo);
router.get('/timelinesai/agents',                 verifyToken, timelinesAIChatController.getRegisteredAgents);
router.get('/timelinesai/agent-chats/:agentName', verifyToken, timelinesAIChatController.getAgentChats);
router.get('/timelinesai/chat-history/:sessionId',verifyToken, timelinesAIChatController.getChatHistory);
router.get('/timelinesai/status',                 verifyToken, timelinesAIChatController.getStatus);
router.get('/timelinesai/check-api',              verifyToken, timelinesAIChatController.checkTimelinesApi);

// Kirimi admin endpoints (butuh login)
router.post('/kirimi/simulate',                        verifyToken, kirimiChatController.simulateInboundMessage);
router.get('/kirimi/debug-info',                       verifyToken, kirimiChatController.getDebugInfo);
router.get('/kirimi/agents',                           verifyToken, kirimiChatController.getAgentsWithKirimi);
router.get('/kirimi/agent-chats/:agentName',           verifyToken, kirimiChatController.getAgentChats);
router.get('/kirimi/chat-history/:sessionId',          verifyToken, kirimiChatController.getChatHistory);
router.get('/kirimi/status',                           verifyToken, kirimiChatController.getKirimiStatus);
router.get('/kirimi/check-api',                        verifyToken, kirimiChatController.checkKirimiApi);

/* ══════════════════════════════════════════════════════════════════════════════
   UTILITY ROUTES
══════════════════════════════════════════════════════════════════════════════ */

// Logger (rate-limited, tidak butuh login — dipakai frontend untuk event tracking)
router.post('/log',               logLimiter, logController.insertLog);

// Rumah123 (Apify Scraper)
router.get('/rumah123/status',                             rumah123Controller.status);
router.get('/rumah123/search',                             rumah123Controller.search);
router.post('/rumah123/search',                            rumah123Controller.searchPost);
router.get('/rumah123/dataset/:datasetId',                 rumah123Controller.getDataset);
router.get('/rumah123/cache-status',                       rumah123Controller.cacheStatus);
router.post('/rumah123/warmup',    verifyToken,            rumah123Controller.triggerWarmup);

// Debug chatbot (development only)
router.get('/chatbot/debug/test-rumah123', verifyToken,    chatbotPrivateController.debugTestRumah123);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — FACILITY (Butuh login)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/facility/list',                        verifyToken, facilityMasterController.showDataFacility);
router.get('/facility/detail/:facility_id',         verifyToken, facilityMasterController.getDetailFacility);
router.post('/facility/insert',                     verifyToken, facilityMasterController.insertDataFacility);
router.put('/facility/update/:facility_id',         verifyToken, facilityMasterController.updateDataFacility);
router.patch('/facility/toggle-status/:facility_id',verifyToken, facilityMasterController.toggleStatusFacility);
router.delete('/facility/delete/:facility_id',      verifyToken, facilityMasterController.deleteFacility);

/* ══════════════════════════════════════════════════════════════════════════════
   LEAD QUALIFICATION — ADMIN ONLY
   Daftar customer yang LAYAK di-follow-up agent, dinilai dari 7 indikator
   (services/leadScoringService.js). Admin-only BUKAN sekadar formalitas:
   hasilnya adalah nomor WhatsApp + isi percakapan LINTAS AGENT.
══════════════════════════════════════════════════════════════════════════════ */

router.get('/lead/qualified',     verifyToken, requirePrivilege('admin'), leadQualificationController.listQualifiedLeads);
router.get('/lead/detail/:phone', verifyToken, requirePrivilege('admin'), leadQualificationController.getLeadDetail);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — DEVELOPER PROPERTY (brand agensi: Ray White, Brighton, dst.)
══════════════════════════════════════════════════════════════════════════════ */

// /options SENGAJA didaftarkan SEBELUM /detail/:id — Express mencocokkan rute
// secara berurutan, jadi tanpa ini "options" akan tertangkap sebagai nilai
// :developer_property_id dan dropdown selalu balas 404.
router.get('/developer-property/options',                          verifyToken, developerPropertyMasterController.getDeveloperPropertyOptions);
router.get('/developer-property/list',                             verifyToken, developerPropertyMasterController.showDataDeveloperProperty);
router.get('/developer-property/detail/:developer_property_id',    verifyToken, developerPropertyMasterController.getDetailDeveloperProperty);
router.post('/developer-property/insert',                          verifyToken, developerPropertyMasterController.insertDataDeveloperProperty);
router.put('/developer-property/update/:developer_property_id',    verifyToken, developerPropertyMasterController.updateDataDeveloperProperty);
router.patch('/developer-property/toggle-status/:developer_property_id', verifyToken, developerPropertyMasterController.toggleStatusDeveloperProperty);
router.delete('/developer-property/delete/:developer_property_id', verifyToken, developerPropertyMasterController.deleteDeveloperProperty);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — COUNTRY (Butuh login)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/country/options',                      verifyToken, countryMasterController.getCountryOptions);
router.get('/country/list',                         verifyToken, countryMasterController.showDataCountry);
router.get('/country/detail/:country_id',           verifyToken, countryMasterController.getDetailCountry);
router.post('/country/insert',                      verifyToken, countryMasterController.insertDataCountry);
router.put('/country/update/:country_id',           verifyToken, countryMasterController.updateDataCountry);
router.patch('/country/toggle-status/:country_id',  verifyToken, countryMasterController.toggleStatusCountry);
router.delete('/country/delete/:country_id',        verifyToken, countryMasterController.deleteCountry);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — PROVINCE (Butuh login)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/province/options',                     verifyToken, provinceMasterController.getProvinceOptions);
router.get('/province/list',                        verifyToken, provinceMasterController.showDataProvince);
router.get('/province/detail/:province_id',         verifyToken, provinceMasterController.getDetailProvince);
router.post('/province/insert',                     verifyToken, provinceMasterController.insertDataProvince);
router.put('/province/update/:province_id',         verifyToken, provinceMasterController.updateDataProvince);
router.patch('/province/toggle-status/:province_id',verifyToken, provinceMasterController.toggleStatusProvince);
router.delete('/province/delete/:province_id',      verifyToken, provinceMasterController.deleteProvince);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — CITY (Butuh login)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/city/list',                            verifyToken, cityMasterController.showDataCity);
router.get('/city/detail/:city_id',                 verifyToken, cityMasterController.getDetailCity);
router.post('/city/insert',                         verifyToken, cityMasterController.insertDataCity);
router.put('/city/update/:city_id',                 verifyToken, cityMasterController.updateDataCity);
router.patch('/city/toggle-status/:city_id',        verifyToken, cityMasterController.toggleStatusCity);
router.delete('/city/delete/:city_id',              verifyToken, cityMasterController.deleteCity);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — PROPERTY (Butuh login)
══════════════════════════════════════════════════════════════════════════════ */

router.get('/property/list',                          verifyToken, propertyMasterController.showDataProperty);
router.get('/property/detail/:property_id',           verifyToken, propertyMasterController.getDetailProperty);
router.post('/property/insert',                       verifyToken, propertyMasterController.insertDataProperty);
router.put('/property/update/:property_id',           verifyToken, propertyMasterController.updateDataProperty);
router.patch('/property/toggle-status/:property_id',  verifyToken, propertyMasterController.toggleStatusProperty);
router.delete('/property/delete/:property_id',        verifyToken, propertyMasterController.deleteProperty);

/* ══════════════════════════════════════════════════════════════════════════════
   PROPERTY-LOCATION RELATIONSHIPS (Butuh login)
   Menghubungkan property dengan nearby location anchors (landmarks)
   ⚠️ MERGED: Semua method dipindahkan ke propertyMasterController
══════════════════════════════════════════════════════════════════════════════ */

router.get('/property/:property_id/locations',              verifyToken, propertyMasterController.getPropertyLocations);
router.post('/property/:property_id/locations',             verifyToken, propertyMasterController.addLocationToProperty);
router.post('/property/:property_id/locations/bulk',        verifyToken, propertyMasterController.bulkAddLocations);
router.delete('/property/:property_id/locations/:location_id', verifyToken, propertyMasterController.removeLocationFromProperty);

/* ══════════════════════════════════════════════════════════════════════════════
   PROPERTY IMAGES (Butuh login)
   File disimpan di <PROPERTY_IMAGE_DIR>/<PROPERTY_ID>/, URL dicatat di
   property_images. Properti tanpa gambar → fallback default folder `properties/`.
   ⚠️ Upload memakai multipart/form-data (field: images[]) — bukan JSON.
══════════════════════════════════════════════════════════════════════════════ */

router.get('/property/:property_id/images',            verifyToken, propertyMasterController.getPropertyImages);
router.post('/property/:property_id/images',           verifyToken, uploadPropertyImages, propertyMasterController.uploadPropertyImages);
router.delete('/property/:property_id/images/:image_id', verifyToken, propertyMasterController.deletePropertyImage);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — LOCATION (Butuh login)
══════════════════════════════════════════════════════════════════════════════ */

// /areas SEBELUM /detail/:location_id — Express mencocokkan berurutan, tanpa ini
// "areas" tertangkap sebagai :location_id dan dropdown selalu 404.
router.get('/location/areas',                             verifyToken, locationMasterController.getAreaOptions);
// Picker "Lokasi/Patokan Terdekat": area+landmark sekota, commercial lintas kota.
router.get('/location/nearby-options',                    verifyToken, locationMasterController.getNearbyLocationOptions);
router.get('/location/list',                              verifyToken, locationMasterController.showDataLocation);
router.get('/location/detail/:location_id',               verifyToken, locationMasterController.getDetailLocation);
router.post('/location/insert',                           verifyToken, locationMasterController.insertDataLocation);
router.put('/location/update/:location_id',               verifyToken, locationMasterController.updateDataLocation);
router.patch('/location/toggle-status/:location_id',      verifyToken, locationMasterController.toggleStatusLocation);
router.delete('/location/delete/:location_id',            verifyToken, locationMasterController.deleteDataLocation);

/* ══════════════════════════════════════════════════════════════════════════════
   MASTER DATA — CUSTOMER (Butuh login)
   Terisi otomatis oleh AI (saat summary WhatsApp) + input manual agent.
══════════════════════════════════════════════════════════════════════════════ */

router.get('/customer/list',                              verifyToken, customerMasterController.showDataCustomer);
router.get('/customer/detail/:customer_id',               verifyToken, customerMasterController.getDetailCustomer);
router.post('/customer/insert',                           verifyToken, customerMasterController.insertDataCustomer);
router.put('/customer/update/:customer_id',               verifyToken, customerMasterController.updateDataCustomer);
router.patch('/customer/toggle-status/:customer_id',      verifyToken, customerMasterController.toggleStatusCustomer);
router.patch('/customer/toggle-ai/:customer_id',          verifyToken, customerMasterController.toggleAiResponseCustomer);
router.delete('/customer/delete/:customer_id',            verifyToken, customerMasterController.deleteCustomer);

/* ══════════════════════════════════════════════════════════════════════════════
   VIEWING SCHEDULE — Google Calendar Integration (Viewing/Survey Appointments)
══════════════════════════════════════════════════════════════════════════════ */

router.post('/viewing/schedule',                          viewingScheduleController.scheduleViewingAppointment);
router.post('/viewing/detect',                            viewingScheduleController.detectViewingRequest);

module.exports = router;
