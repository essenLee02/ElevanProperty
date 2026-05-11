# 13 — Development Rules and Definition of Done

## 1. Development Rules

1. Keep frontend and backend separated.
2. Put external API logic in `services/`.
3. Put request handling in `controllers/`.
4. Put routing in `routes/`.
5. Put reusable helper functions in `utils/`.
6. Put database structure in `models/`.
7. Do not expose secrets to frontend.
8. Use centralized Axios API service.
9. Keep AI focused on property topics.
10. Store chat history in the backend database.
11. Use clear success and error responses.
12. Use safe logging.
13. Avoid duplicate submit from frontend.
14. Normalize phone numbers before saving or sending to Fonnte.
15. Normalize names for history matching.
16. Reply in the same language used by the customer.

## 2. Error Handling Standard

### Google Sheets Error

```text
Google Sheets save failed. Please check service account permission and spreadsheet ID.
```

### OpenAI Error

```text
Contact saved, but AI response failed. Please check OpenAI API key, model, quota, or billing.
```

### Fonnte Error

```text
AI response generated, but WhatsApp send failed. Please check Fonnte token or target phone format.
```

### Database Error

```text
Database save failed. Please check MySQL connection and Sequelize model.
```

## 3. Definition of Done

A feature is complete when:

1. Frontend UI works.
2. Backend API works.
3. Validation works.
4. Data is saved correctly.
5. External API integration works.
6. Errors are handled clearly.
7. Secrets are not exposed.
8. Logs are available.
9. End-to-end user flow is tested.
10. Code follows this documentation.

## 4. Future Enhancements

### RAG / Knowledge Base

Future AI can read property data from:

- MySQL Property table
- Google Sheets
- Vector database
- Property catalog files
- Admin-managed database

### AI Agent Workflow

```text
Intent Detection
→ Requirement Collection
→ Property Search
→ Recommendation Ranking
→ Negotiation Support
→ Human Escalation
```

### Human Escalation

Escalate when:

- Customer wants final negotiation.
- Customer asks legal or compliance questions.
- Customer wants a site visit.
- Customer asks about contracts or payment details.
- AI confidence is low.

### Admin Dashboard

A future admin dashboard can manage:

- Contacts
- Properties
- Chat sessions
- WhatsApp messages
- Google Sheets sync
- AI logs
- Lead pipeline
