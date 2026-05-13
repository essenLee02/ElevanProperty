# chat_gpt_reponds — Combined With property_responds

Generated at: `2026-05-13T09:16:05Z`

This folder is the corrected combined response-skill package.

## What Was Combined

This package uses `chat_gpt_reponds` as the main folder and combines it with the response logic from `property_responds.zip`.

The final result is only:

```text
chat_gpt_reponds/
```

There is no extra `skills/` wrapper folder and no separate `property_responds/` folder.

## Purpose

This skill teaches GPT how to respond as a property assistant for a property chatbot.

It focuses only on response behavior, including:

- property assistant role and style;
- property intent recognition;
- Indonesian property terminology;
- catalog-only recommendation rules;
- user identity and chat history;
- latest message priority;
- off-topic rejection;
- ambiguity control;
- budget, location, and facility matching;
- nearest alternative suggestions;
- multilingual behavior;
- transaction scope: rent, sale, purchase;
- response templates and bold formatting;
- negotiation and escalation;
- JSON property context handling;
- quality self-check before replying.

## Files

```text
chat_gpt_reponds/
├─ README.md
├─ SKILL.md
└─ docs/
   ├─ 01-role-scope-and-style.md
   ├─ 02-property-intent-and-terminology.md
   ├─ 03-catalog-recommendation-rules.md
   ├─ 04-history-memory-and-user-identity.md
   ├─ 05-off-topic-and-ambiguity-control.md
   ├─ 06-budget-location-facility-rules.md
   ├─ 07-response-templates-and-formatting.md
   ├─ 08-negotiation-and-escalation.md
   ├─ 09-nearest-alternative-suggestion.md
   ├─ 10-multilingual-llm-behavior.md
   ├─ 11-property-data-fields.md
   ├─ 12-transaction-scope-rent-sale-purchase.md
   ├─ 13-intelligent-response-patterns.md
   ├─ 14-clarification-strategy.md
   ├─ 15-quality-self-check.md
   └─ 16-json-context-and-property-suggestion.md
```
