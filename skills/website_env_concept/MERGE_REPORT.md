# website_env_concept Module Split Report

Generated at: `2026-05-18T08:44:54Z`

## Source

Uploaded file:

```text
website_env_concept.zip
```

Source Markdown count:

```text
20
```

## Output Goal

The previous optimized version was clean, but the user requested module separation again for:

```text
Home
About Us
Contact
Chatbot
```

This version keeps shared backend/frontend environment files compact while separating the main modules.

## Final Output

```text
README.md
SKILL.md
MERGE_REPORT.md
docs/01-project-architecture-and-scope.md
docs/02-environment-packages-and-runtime.md
docs/03-backend-api-database-and-services.md
docs/04-home-module.md
docs/05-about-us-module-json-catalog.md
docs/06-contact-module-google-sheets-fonnte.md
docs/07-chatbot-module-ai-skill-loader.md
docs/08-install-test-and-troubleshooting.md
```

## Category Logic

| File | Purpose |
|---|---|
| `01-project-architecture-and-scope.md` | global architecture and scope |
| `02-environment-packages-and-runtime.md` | backend/frontend `.env`, packages, runtime |
| `03-backend-api-database-and-services.md` | backend shared API/database/services |
| `04-home-module.md` | Home-specific development skill |
| `05-about-us-module-json-catalog.md` | About Us and JSON catalog skill |
| `06-contact-module-google-sheets-fonnte.md` | Contact, Google Sheets, and Fonnte skill |
| `07-chatbot-module-ai-skill-loader.md` | Chatbot, AI providers, skill loader, catalog matching |
| `08-install-test-and-troubleshooting.md` | installation, testing, and troubleshooting |

## Redundancy Control

Repeated shared content was kept in shared docs:

```text
environment
backend API
database
services
installation
troubleshooting
```

Module-specific behavior was separated into:

```text
Home
About Us
Contact
Chatbot
```

This keeps the skill easier to maintain without returning to a messy 20+ file structure.
