# API Design

## Example Internal Endpoints
- `POST /api/contact`
- `POST /api/chat/start`
- `POST /api/chat/message`
- `POST /api/webhooks/fonnte`
- `GET /api/properties/search`
- `GET /api/properties/:id`
- `POST /api/negotiation/offer`
- `GET /api/conversations/:id/history`

## Validation
Every write endpoint should validate:
- required fields
- phone format
- message length
- allowed enum values
- language code when provided
