# Elevan_Property Website Environment Concept — Module Split

Generated at: `2026-05-18T08:44:54Z`

This package restructures `website_env_concept` so the module skills are separated again, especially for:

```text
Home
About Us
Contact
Chatbot
```

## Source Review

The uploaded `website_env_concept.zip` contained **20 Markdown files**.

This version keeps the skill clean and non-repetitive, but separates the business modules so development guidance is easier to follow.

## Final Structure

```text
website_env_concept/
├─ README.md
├─ SKILL.md
├─ MERGE_REPORT.md
└─ docs/
   ├─ 01-project-architecture-and-scope.md
   ├─ 02-environment-packages-and-runtime.md
   ├─ 03-backend-api-database-and-services.md
   ├─ 04-home-module.md
   ├─ 05-about-us-module-json-catalog.md
   ├─ 06-contact-module-google-sheets-fonnte.md
   ├─ 07-chatbot-module-ai-skill-loader.md
   └─ 08-install-test-and-troubleshooting.md
```

## Important Folder Names

Correct response skill folders:

```text
skills/chat_gpt_responds
skills/claude_responds
```

The old typo folder `chat_gpt_reponds` should only be treated as backward compatibility.
