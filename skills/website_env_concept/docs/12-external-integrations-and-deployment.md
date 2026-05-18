# 12. External Integrations & Deployment

## Fonnte WhatsApp Integration

```javascript
class FonnteService {
  async sendMessage(phoneNumber, message) {
    const response = await axios.post(
      'https://api.fonnte.com/send',
      {
        target: phoneNumber,
        message: message,
        countryCode: '62'
      },
      {
        headers: {
          'Authorization': process.env.FONNTE_TOKEN
        }
      }
    );
    return response.data;
  }

  validateWebhook(req) {
    // Verify webhook signature
    const signature = req.headers['x-webhook-signature'];
    const expected = hash(req.body + process.env.FONNTE_WEBHOOK_SECRET);
    return signature === expected;
  }
}
```

## Google Sheets Integration

```javascript
class SheetsService {
  async appendRow(rowData) {
    // Non-blocking append to Google Sheets
    // Used for contact form submissions
    // Returns immediately
  }
}
```

## AWS S3 Integration

```javascript
class S3Service {
  async uploadPropertyImage(file) {
    // Upload to S3
    // Return public URL
  }
}
```

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Skill files in place
- [ ] API keys validated
- [ ] SSL certificate ready

### Deployment
- [ ] Deploy backend to server
- [ ] Deploy frontend to CDN
- [ ] Update DNS records
- [ ] Configure WhatsApp webhook
- [ ] Test all integrations
- [ ] Monitor logs

### Post-Deployment
- [ ] Smoke tests passing
- [ ] Monitor performance
- [ ] Check error rates
- [ ] Verify WhatsApp functionality
- [ ] Test contact form flow

## Deployment Commands

```bash
# Backend
npm run migrate
npm start

# Frontend
npm run build
# Deploy dist/ folder to CDN
```

## Troubleshooting

**Issue**: WhatsApp messages not received
- Check Fonnte token
- Verify webhook URL
- Validate webhook signature

**Issue**: Contact form not saving
- Verify Google Sheets API
- Check service account credentials
- Confirm sheet permissions

**Issue**: High latency
- Check database performance
- Verify AI provider response time
- Optimize skill file size

**Issue**: Database errors
- Run migrations: npm run migrate
- Check connection string
- Verify database exists

## Performance Optimization

- Enable response caching
- Compress assets
- Minify code
- Optimize images
- Use CDN for static files
- Enable gzip compression

## Monitoring

- Application logs
- Error tracking
- Performance metrics
- User analytics
- API response times
- Database performance
