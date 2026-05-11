# Floating Website Chatbot

## Placement
The chatbot should float at the bottom-right corner of every page.

## Initial User Input
Before starting the chat, the user should provide:
- name
- phone number

## Core Behavior
- the chatbot talks directly on the website UI
- the chatbot does not require the user to move to WhatsApp
- the chatbot uses OpenAI for response generation
- the chatbot stores conversation history linked to normalized user identity

## Memory Rules
The chatbot should recognize returning users by:
- normalized phone number
- normalized user name

## Normalization Requirements
### Phone Number
Examples below should be treated as the same number:
- +6282233556796
- 082233556796
- 82233556796

### Name
Examples below should be treated as the same person:
- Devy Herman
- devy herMAN
- DEvy hermaN

The system should:
- trim spaces
- collapse duplicate spaces
- compare names in case-insensitive mode

## Best Practice Additions
- show privacy notice before first chat
- support handoff to human agent
- add conversation reset button
- store last intent and last recommended properties
