# Backend Architecture

## Main Responsibility
The backend should orchestrate all message, property, and AI workflows.

## Main Components
- REST API
- webhook receiver for Fonnte
- conversation service
- AI service
- lead service
- property recommendation service
- history service
- logging/audit service

## Recommended Layering
- `routes/`
- `controllers/`
- `services/`
- `repositories/`
- `middleware/`
- `validators/`
- `jobs/`
- `utils/`

## Best Practice Additions
- keep provider integrations isolated
- implement retry logic for WhatsApp send failures
- separate AI orchestration from HTTP controllers
- store every inbound and outbound message event
