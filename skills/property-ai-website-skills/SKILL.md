# SKILL.md — Property AI Website Documentation Index

This is the main index for the Property Rental & Sales Website skill documentation.

The documentation is split into multiple Markdown files so each area can be maintained clearly.

## Documentation Files

1. [Goal and Scope](docs/00-goal-and-scope.md)
2. [Environment and Security](docs/01-environment-and-security.md)
3. [Directory Structure](docs/02-directory-structure.md)
4. [Modules: Home, About Us, Contact](docs/03-modules-home-about-contact.md)
5. [Chatbot Skill](docs/04-chatbot-skill.md)
6. [Fonnte WhatsApp Flow](docs/05-fonnte-whatsapp-flow.md)
7. [OpenAI / GPT Integration](docs/06-openai-gpt-integration.md)
8. [Google Sheets Integration](docs/07-google-sheets-integration.md)
9. [Backend Controllers, Services, and Utilities](docs/08-backend-controllers-services.md)
10. [Database Models](docs/09-database-models.md)
11. [API Specification](docs/10-api-specification.md)
12. [Frontend Components and Views](docs/11-frontend-components.md)
13. [Testing and Deployment](docs/12-testing-and-deployment.md)
14. [Development Rules](docs/13-development-rules.md)

## Main Development Principle

The frontend should only handle user interface and API requests to the backend.

The backend must handle:

- Database operations
- Google Sheets integration
- OpenAI / ChatGPT integration
- Fonnte WhatsApp integration
- Session management
- Conversation history
- Property recommendation logic
- Secure environment variables and secret keys
