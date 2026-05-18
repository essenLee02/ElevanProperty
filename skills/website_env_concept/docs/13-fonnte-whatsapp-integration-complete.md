# 13. Fonnte WhatsApp Integration — Complete Guide

**Complete integration guide for Fonnte WhatsApp API with examples, webhook handling, and production setup.**

---

## What is Fonnte?

**Fonnte** is a WhatsApp API platform that allows you to:
- Send messages programmatically
- Receive messages via webhooks
- Manage media (images, documents)
- Track message status
- Handle automation

**Official**: https://fonnte.com

---

## Setup: Getting Started

### 1. Create Fonnte Account

```bash
# Visit https://fonnte.com
# Sign up with email
# Verify email
# Create API token
# Scan QR code with WhatsApp-enabled phone
```

### 2. Environment Variables

```env
FONNTE_TOKEN=your_token_here
FONNTE_WEBHOOK_SECRET=your_secret_here
FONNTE_DEVICE_ID=device_123
ENABLE_AI_WHATSAPP=true
ADMIN_PHONE=62821234567  # For notifications
```

### 3. Webhook Setup

```
In Fonnte Dashboard:
  Settings → Webhook
  URL: https://yoursite.com/api/webhook/fonnte
  Secret: (use FONNTE_WEBHOOK_SECRET)
  Events: incoming-message, message-status
```

---

## Fonnte Service Class

### Complete Implementation

```javascript
// backend/services/fonnteService.js

class FonnteService {
  constructor() {
    this.token = process.env.FONNTE_TOKEN;
    this.webhookSecret = process.env.FONNTE_WEBHOOK_SECRET;
    this.baseUrl = 'https://api.fonnte.com';
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Send text message to single recipient
   * @param {string} phoneNumber - Target phone (with country code, e.g., 62821234567)
   * @param {string} message - Message text (max 4096 chars)
   * @returns {Promise}
   */
  async sendMessage(phoneNumber, message) {
    if (!this.validatePhone(phoneNumber)) {
      throw new Error('Invalid phone number format');
    }

    if (!this.validateMessage(message)) {
      throw new Error('Message too long or empty');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/send`,
        {
          target: phoneNumber,
          message: message,
          countryCode: '62', // Indonesia
          delay: 0, // No delay
          isGroup: false
        },
        {
          headers: {
            'Authorization': this.token,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      return {
        success: response.data.status === true,
        messageId: response.data.data?.id,
        response: response.data
      };
    } catch (error) {
      logger.error('Fonnte send error:', error.response?.data || error.message);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Send message to multiple recipients (batch)
   * @param {Array<string>} phoneNumbers - Array of phone numbers
   * @param {string} message - Message text
   * @returns {Promise}
   */
  async sendBatch(phoneNumbers, message) {
    const results = [];

    for (const phone of phoneNumbers) {
      try {
        const result = await this.sendMessage(phone, message);
        results.push({ phone, ...result });
      } catch (error) {
        results.push({ phone, success: false, error: error.message });
      }

      // Rate limiting - wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Send message with media (image, document)
   * @param {string} phoneNumber - Target phone
   * @param {string} mediaUrl - URL of media (publicly accessible)
   * @param {string} mediaType - 'image', 'document', 'video', 'audio'
   * @param {string} caption - Optional caption
   * @returns {Promise}
   */
  async sendMedia(phoneNumber, mediaUrl, mediaType, caption = '') {
    if (!['image', 'document', 'video', 'audio'].includes(mediaType)) {
      throw new Error(`Invalid media type: ${mediaType}`);
    }

    try {
      const payload = {
        target: phoneNumber,
        [mediaType]: mediaUrl, // e.g., "image": "https://..."
        countryCode: '62'
      };

      if (caption) {
        payload.caption = caption;
      }

      const response = await axios.post(
        `${this.baseUrl}/send`,
        payload,
        {
          headers: { 'Authorization': this.token },
          timeout: this.timeout
        }
      );

      return {
        success: response.data.status === true,
        messageId: response.data.data?.id
      };
    } catch (error) {
      logger.error('Fonnte media send error:', error.message);
      throw new Error(`Failed to send media: ${error.message}`);
    }
  }

  /**
   * Get device/connection status
   * @returns {Promise}
   */
  async getStatus() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/device`,
        {
          headers: { 'Authorization': this.token },
          timeout: this.timeout
        }
      );

      return {
        connected: response.data.data?.is_login === true,
        phone: response.data.data?.phone,
        device: response.data.data?.device_name,
        battery: response.data.data?.battery
      };
    } catch (error) {
      logger.error('Fonnte status check error:', error.message);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Handle incoming webhook from Fonnte
   * @param {object} req - Express request
   * @returns {Promise}
   */
  async handleWebhook(req) {
    // Validate webhook signature
    if (!this.validateWebhookSignature(req)) {
      throw new Error('Invalid webhook signature');
    }

    const { type, data } = req.body;

    switch (type) {
      case 'incoming-message':
        return await this.handleIncomingMessage(data);

      case 'message-status':
        return await this.handleMessageStatus(data);

      default:
        logger.warn(`Unknown webhook type: ${type}`);
        return { status: 'unknown' };
    }
  }

  /**
   * Handle incoming WhatsApp message
   * @param {object} data - Message data from webhook
   * @returns {Promise}
   */
  async handleIncomingMessage(data) {
    const {
      phone, // Sender's phone
      message,
      type, // 'text', 'image', 'document', etc
      timestamp
    } = data;

    logger.info(`Incoming message from ${phone}: ${message}`);

    // Process based on message type
    if (type === 'text') {
      // Handle text message
      return { processed: true, type: 'text' };
    } else if (type === 'image' || type === 'document') {
      // Handle media
      return { processed: true, type: 'media' };
    } else {
      // Other types: video, audio, etc
      return { processed: true, type: type };
    }
  }

  /**
   * Handle message delivery status
   * @param {object} data - Status data from webhook
   * @returns {Promise}
   */
  async handleMessageStatus(data) {
    const { id, status } = data;
    // status: 'sent', 'delivered', 'read', 'failed'

    logger.info(`Message ${id} status: ${status}`);

    // Update message status in database if needed
    // await db.chatHistory.update({ messageId: id }, { status });

    return { processed: true, status };
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number
   * @returns {boolean}
   */
  validatePhone(phone) {
    // Must be: 62 (country) + 8+ digits
    const phoneRegex = /^62\d{8,}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  }

  /**
   * Validate message content
   * @param {string} message - Message text
   * @returns {boolean}
   */
  validateMessage(message) {
    if (!message || typeof message !== 'string') return false;
    if (message.length === 0) return false;
    if (message.length > 4096) return false; // Fonnte limit
    return true;
  }

  /**
   * Validate webhook signature
   * @param {object} req - Express request
   * @returns {boolean}
   */
  validateWebhookSignature(req) {
    const signature = req.headers['x-webhook-signature'];
    if (!signature) return false;

    const body = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Send notification to admin
   * @param {string} title - Notification title
   * @param {string} message - Message content
   * @returns {Promise}
   */
  async sendAdminNotification(title, message) {
    const adminPhone = process.env.ADMIN_PHONE;

    if (!adminPhone) {
      logger.warn('ADMIN_PHONE not configured, skipping notification');
      return { sent: false };
    }

    try {
      const fullMessage = `📢 *${title}*\n\n${message}`;
      return await this.sendMessage(adminPhone, fullMessage);
    } catch (error) {
      logger.error('Failed to send admin notification:', error.message);
      return { sent: false, error: error.message };
    }
  }
}

module.exports = new FonnteService();
```

---

## Webhook Controller

### Handle Incoming Messages

```javascript
// backend/controllers/webhookController.js

const fonnteService = require('../services/fonnteService');
const sessionService = require('../services/sessionService');
const aiService = require('../services/aiService');

async function handleFonnteWebhook(req, res) {
  try {
    // Validate webhook
    const webhookResult = await fonnteService.handleWebhook(req);

    if (webhookResult.type === 'message-status') {
      // Just log status update
      return res.json({ success: true, type: 'status-update' });
    }

    const { phone, message, type, timestamp } = req.body.data;

    if (type !== 'text') {
      // Handle non-text (media, etc)
      return res.json({ success: true, type: 'media-ignored' });
    }

    // Get or create session
    const session = await sessionService.getOrCreateSession(phone, {
      source: 'whatsapp_fonnte',
      name: req.body.data.pushname || 'WhatsApp User'
    });

    // Same AI logic as website chatbot
    const properties = await propertyService.getCatalog();
    const prompt = await promptService.composePrompt(
      message,
      session,
      properties,
      'chatgpt' // or claude
    );

    const aiResponse = await aiService.generateResponse(prompt, session);

    // Save to history
    await sessionService.addToHistory(session.id, message, aiResponse);

    // Send response back to WhatsApp
    await fonnteService.sendMessage(phone, aiResponse);

    res.json({ success: true, messageId: session.id });
  } catch (error) {
    logger.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { handleFonnteWebhook };
```

---

## Integration with Chatbot

### Send WhatsApp Notification for Contact Form

```javascript
// When contact form submitted
async function handleContactSubmission(req, res) {
  const { name, phone, email, message } = req.body;

  // 1. Save to Google Sheets (non-blocking)
  sheetsService.appendRow({ name, phone, email, message })
    .catch(err => logger.error('Sheets error:', err));

  // 2. Send WhatsApp notification to admin (non-blocking)
  const adminNotification = `
📋 *Formulir Kontak Baru*

Nama: ${name}
WhatsApp: ${phone}
Email: ${email}
Pesan: ${message}

Hubungi untuk follow-up.
  `;

  fonnteService.sendAdminNotification('Kontak Baru', adminNotification)
    .catch(err => logger.error('WhatsApp error:', err));

  // 3. Return success immediately
  res.json({ success: true });
}
```

---

## Common Use Cases

### 1. Send Property Recommendation via WhatsApp

```javascript
async function sendPropertyRecommendation(phone, property) {
  const message = `
🏠 *${property.name}*

📍 ${property.location}
💰 ${property.price}
📐 ${property.buildingArea}m²
🛏️ ${property.rooms} kamar, ${property.bathrooms} kamar mandi
✨ ${property.facilities.join(', ')}

Tertarik? Chat dengan AI kami di website!
  `;

  return await fonnteService.sendMessage(phone, message);
}
```

### 2. Send Order/Status Update

```javascript
async function sendStatusUpdate(phone, status) {
  const statusMessages = {
    confirmed: '✅ Pesanan Anda telah dikonfirmasi.',
    processing: '⏳ Sedang diproses oleh tim kami.',
    completed: '🎉 Selesai! Hubungi kami untuk detail lebih lanjut.'
  };

  return await fonnteService.sendMessage(phone, statusMessages[status]);
}
```

### 3. Send Reminder

```javascript
async function sendReminder(phone, propertyName) {
  const message = `
👋 Halo! Kami ingin tahu, apakah Anda masih tertarik dengan:

🏠 ${propertyName}

Balas dengan "ya" atau chat dengan AI kami!
  `;

  return await fonnteService.sendMessage(phone, message);
}
```

---

## Error Handling & Retries

```javascript
async function sendWithRetry(phoneNumber, message, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fonnteService.sendMessage(phoneNumber, message);
    } catch (error) {
      logger.warn(`Attempt ${attempt} failed:`, error.message);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // All retries failed
        logger.error(`All ${maxRetries} attempts failed`);
        throw error;
      }
    }
  }
}
```

---

## Testing Fonnte Integration

### Manual Test

```bash
# Test webhook signature validation
curl -X POST http://localhost:3000/api/webhook/fonnte \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: signature_here" \
  -d '{
    "type": "incoming-message",
    "data": {
      "phone": "62821234567",
      "message": "Halo, ada rumah di Surabaya?",
      "type": "text",
      "timestamp": 1234567890
    }
  }'

# Test send message
curl -X POST http://localhost:3000/api/test/send-whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "62821234567",
    "message": "Test message from API"
  }'
```

### Unit Test Example

```javascript
// test/fonnte.test.js

describe('FonnteService', () => {
  it('should validate phone number', () => {
    expect(fonnteService.validatePhone('62821234567')).toBe(true);
    expect(fonnteService.validatePhone('081234567')).toBe(false);
  });

  it('should validate message', () => {
    expect(fonnteService.validateMessage('Hello')).toBe(true);
    expect(fonnteService.validateMessage('')).toBe(false);
    expect(fonnteService.validateMessage('x'.repeat(5000))).toBe(false);
  });

  it('should send message successfully', async () => {
    const result = await fonnteService.sendMessage(
      '62821234567',
      'Test message'
    );
    expect(result.success).toBe(true);
  });
});
```

---

## Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Messages not sent** | Invalid token | Check FONNTE_TOKEN in .env |
| **Webhook not received** | URL misconfigured | Verify webhook URL in Fonnte dashboard |
| **Signature validation fails** | Wrong secret | Check FONNTE_WEBHOOK_SECRET |
| **Invalid phone format** | Missing country code | Use format: 62821234567 (not 0821234567) |
| **Rate limit hit** | Too many requests too fast | Implement delay (100ms) between requests |
| **Device disconnected** | WhatsApp logged out | Rescan QR code in Fonnte dashboard |

---

## Best Practices

✅ **Always validate** phone numbers before sending  
✅ **Implement retry logic** for failed sends  
✅ **Rate limit** to avoid hitting Fonnte limits  
✅ **Use non-blocking** operations for notifications  
✅ **Log all** requests for debugging  
✅ **Validate webhooks** to ensure they're from Fonnte  
✅ **Handle media carefully** - ensure URLs are publicly accessible  
✅ **Monitor status** updates to track delivery  

---

## Security

- ✅ **Validate webhook signatures** always
- ✅ **Keep FONNTE_TOKEN secret** (never commit to repo)
- ✅ **Rate limit** to prevent abuse
- ✅ **Sanitize user input** before sending
- ✅ **Log errors securely** (don't expose sensitive data)
- ✅ **Use environment variables** for all credentials
