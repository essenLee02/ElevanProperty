# Fonnte WhatsApp Flow

## Current State
- Fonnte free version is being used
- a basic Node.js backend already exists
- current backend only catches incoming message requests

## Target Flow
1. Customer sends message from WhatsApp
2. Fonnte sends webhook request to backend
3. Backend validates and stores the event
4. Backend loads customer context and conversation history
5. Backend sends prompt + context to AI engine
6. AI engine returns a response
7. Backend sends the response to Fonnte send-message API
8. Fonnte delivers the message to WhatsApp user

## Required Features
- webhook verification
- duplicate event protection
- message logging
- conversation session handling
- outbound retry mechanism
- error fallback message
- escalation to human agent when needed
