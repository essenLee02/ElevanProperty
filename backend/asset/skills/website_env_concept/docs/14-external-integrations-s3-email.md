# 14. External Integrations — S3, Email, and Others

**Complete guide for AWS S3, Email service, Analytics, and other external integrations.**

---

## AWS S3 Integration

### Setup

```env
AWS_S3_BUCKET=elevan-properties
AWS_S3_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_S3_UPLOAD_DIR=property-images
```

### S3 Service Class

```javascript
// backend/services/s3Service.js

const AWS = require('aws-sdk');

class S3Service {
  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_S3_REGION
    });
    this.bucket = process.env.AWS_S3_BUCKET;
  }

  /**
   * Upload file to S3
   * @param {string} key - File path in S3 (e.g., property-images/123.jpg)
   * @param {Buffer} fileData - File content
   * @param {string} contentType - MIME type
   * @returns {Promise}
   */
  async uploadFile(key, fileData, contentType = 'image/jpeg') {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        Body: fileData,
        ContentType: contentType,
        ACL: 'public-read' // Make it publicly readable
      };

      const result = await this.s3.upload(params).promise();

      return {
        success: true,
        url: result.Location,
        key: result.Key,
        eTag: result.ETag
      };
    } catch (error) {
      logger.error('S3 upload error:', error.message);
      throw error;
    }
  }

  /**
   * Upload property image
   * @param {string} propertyId - Property ID
   * @param {Buffer} imageData - Image file data
   * @returns {Promise}
   */
  async uploadPropertyImage(propertyId, imageData) {
    const timestamp = Date.now();
    const key = `${process.env.AWS_S3_UPLOAD_DIR}/${propertyId}/${timestamp}.jpg`;

    return this.uploadFile(key, imageData, 'image/jpeg');
  }

  /**
   * Delete file from S3
   * @param {string} key - File path in S3
   * @returns {Promise}
   */
  async deleteFile(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key
      };

      await this.s3.deleteObject(params).promise();

      return { success: true, deleted: true };
    } catch (error) {
      logger.error('S3 delete error:', error.message);
      throw error;
    }
  }

  /**
   * Generate signed URL for temporary access
   * @param {string} key - File path in S3
   * @param {number} expiresIn - Expiry time in seconds
   * @returns {Promise}
   */
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        Expires: expiresIn
      };

      const url = this.s3.getSignedUrl('getObject', params);
      return { success: true, url };
    } catch (error) {
      logger.error('S3 signed URL error:', error.message);
      throw error;
    }
  }
}

module.exports = new S3Service();
```

---

## Email Service

### Setup with NodeMailer

```bash
npm install nodemailer
```

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@elevanproperties.id
```

### Email Service Class

```javascript
// backend/services/emailService.js

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Send confirmation email
   * @param {string} email - Recipient email
   * @param {string} name - Recipient name
   * @returns {Promise}
   */
  async sendConfirmationEmail(email, name) {
    const htmlContent = `
      <h2>Terima kasih, ${name}!</h2>
      <p>Kami telah menerima pertanyaan Anda.</p>
      <p>Tim kami akan menghubungi Anda segera melalui WhatsApp atau telepon.</p>
      <p>Salam,<br/>Tim ElevanLabs</p>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Terima kasih atas Pertanyaan Anda',
      html: htmlContent
    });
  }

  /**
   * Send property recommendation
   * @param {string} email - Recipient email
   * @param {object} property - Property data
   * @returns {Promise}
   */
  async sendPropertyRecommendation(email, property) {
    const htmlContent = `
      <h2>${property.name}</h2>
      <p><strong>Lokasi:</strong> ${property.location}</p>
      <p><strong>Harga:</strong> Rp ${property.price}</p>
      <p><strong>Luas:</strong> ${property.buildingArea}m²</p>
      <p><strong>Fasilitas:</strong> ${property.facilities.join(', ')}</p>
      <p><a href="https://yoursite.com/property/${property.id}">Lihat Detail</a></p>
    `;

    return this.sendEmail({
      to: email,
      subject: `Rekomendasi Properti: ${property.name}`,
      html: htmlContent
    });
  }

  /**
   * Generic send email
   * @param {object} options - Email options
   * @returns {Promise}
   */
  async sendEmail(options) {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM,
        ...options
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent:', info.messageId);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Email send error:', error.message);
      throw error;
    }
  }

  /**
   * Send in background (non-blocking)
   * @param {object} options - Email options
   */
  sendAsync(options) {
    this.sendEmail(options).catch(err => {
      logger.error('Background email error:', err.message);
    });
  }
}

module.exports = new EmailService();
```

---

## Analytics/Tracking

### Google Analytics Integration

```javascript
// Send page view
async function trackPageView(userId, pageName) {
  const data = {
    userId: userId,
    pageName: pageName,
    timestamp: new Date(),
    userAgent: req.headers['user-agent']
  };

  // Save to database or Sheets
  await sheetsService.appendRow(data, 'Analytics');
}

// Track conversion
async function trackConversion(userId, propertyId, action) {
  const data = {
    userId: userId,
    propertyId: propertyId,
    action: action, // 'view', 'inquiry', 'contact'
    timestamp: new Date()
  };

  await sheetsService.appendRow(data, 'Conversions');
}
```

---

## SMS Integration (Optional)

### Using Twilio

```bash
npm install twilio
```

```env
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### SMS Service

```javascript
// backend/services/smsService.js

const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  async sendSMS(toNumber, message) {
    try {
      const result = await this.client.messages.create({
        from: this.phoneNumber,
        to: toNumber,
        body: message
      });

      return { success: true, messageId: result.sid };
    } catch (error) {
      logger.error('SMS send error:', error.message);
      throw error;
    }
  }
}

module.exports = new SMSService();
```

---

## Slack Integration (For Notifications)

```bash
npm install slack-sdk
```

```env
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_CHANNEL_ID=C1234567890
```

### Slack Service

```javascript
// backend/services/slackService.js

const { WebClient } = require('@slack/web-api');

class SlackService {
  constructor() {
    this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
    this.channelId = process.env.SLACK_CHANNEL_ID;
  }

  async sendNotification(text, blocks = null) {
    try {
      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        text: text,
        blocks: blocks
      });

      return { success: true, timestamp: result.ts };
    } catch (error) {
      logger.error('Slack send error:', error.message);
      throw error;
    }
  }

  async sendPropertyAlert(property) {
    const text = `🏠 New Property Listed: ${property.name}`;
    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${property.name}*\n${property.location}\nRp ${property.price}`
        }
      }
    ];

    return this.sendNotification(text, blocks);
  }
}

module.exports = new SlackService();
```

---

## Database Backup (Optional)

### Automated Backups

```javascript
// Schedule daily backups
const cron = require('node-cron');
const backup = require('backup-sqlite');

// Every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const backupFile = `backups/database-${timestamp}.sqlite`;

    await backup.backup({
      src: './db/database.sqlite',
      dest: backupFile
    });

    logger.info(`Backup created: ${backupFile}`);
  } catch (error) {
    logger.error('Backup error:', error.message);
  }
});
```

---

## Error Monitoring (Sentry)

```bash
npm install @sentry/node
```

```env
SENTRY_DSN=https://your-key@sentry.io/1234567
```

### Setup

```javascript
// backend/server.js

const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

---

## Logging

### Winston Logger Setup

```bash
npm install winston
```

```javascript
// backend/config/logger.js

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

---

## Integration Checklist

- [ ] S3 configured for image uploads
- [ ] Email service configured
- [ ] Google Analytics or custom analytics setup
- [ ] Slack notifications (optional)
- [ ] SMS service (optional)
- [ ] Sentry error monitoring
- [ ] Logger setup with file output
- [ ] Backup strategy in place
- [ ] Rate limiting on all APIs
- [ ] Security keys in .env (never in code)

---

## Best Practices

✅ **Non-blocking**: Fire-and-forget for non-critical integrations  
✅ **Error handling**: Always wrap external API calls in try-catch  
✅ **Timeout**: Set reasonable timeouts for external services  
✅ **Retry logic**: Implement exponential backoff for failures  
✅ **Monitoring**: Log all integration events  
✅ **Fallback**: Have backup plan if external service fails  
✅ **Security**: Keep API keys in environment variables  
✅ **Testing**: Test all integrations with unit tests  
