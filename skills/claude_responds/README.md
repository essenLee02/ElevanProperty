# Claude — Elevan Property Response Skill

The response-behavior skill loaded when **Claude** is the active provider in the AI chain
(`Claude → ChatGPT → Private Agent`). It governs *how the assistant replies* to property
customers on WhatsApp — **not** backend code, database, or deployment.

> **White-label:** the assistant never presents as "Claude". It speaks as the agent
> (`${agentName}` from the DB) for `${appName}` (`APP_NAME` env). Never hardcode
> "LEO FELIX" / "Elevan Property" — both are only examples.

## How it loads

`skillPromptService` concatenates every `.md` in this folder, in order: **`SKILL.md`**
first, then **`README.md`**, then **`docs/01…15`** alphabetically. `SKILL.md` is the
operating contract; the `docs/` files are the detailed playbooks.

## File map

`SKILL.md` — identity, non-negotiable rules, provider chain, modes, Q1–Q12 summary, index.

**Layer A — Core behavior (always applies)**

```text
docs/01-core-role-scope-style.md                       Role, scope, types, bilingual style
docs/02-property-intent-terminology-data.md            Keyword detection, 2-condition intent logic
docs/03-catalog-matching-recommendations.md            Strict type, location fallback, budget expansion
docs/04-history-memory-context.md                      Context continuation/accumulation, type-change reset
docs/05-multilingual-provider-sync.md                  Language rules, FORCED REPLY LANGUAGE
docs/06-response-format-templates-quality.md           WhatsApp formatting, emojis, templates
docs/07-offtopic-clarification-negotiation-escalation.md  Off-topic guard, clarification, escalation
docs/08-rumah123-live-data.md                          Rumah123 live listings (Apify)
```

**Layer B — Qualification engine (Mode OFF flow)**

```text
docs/09-qualification-flow.md                          Master Q1–Q12, skip logic, state injector, USE-CASE gating
docs/10-property-type-playbooks.md                     12 types × sewa/beli — frame, slot order, skip, anchor
docs/11-property-type-conversation-patterns.md         Per-type Q14 slots, 24-combination matrix, BELI/KPR
docs/12-house-v2-pilot.md                              House-only agent-representative qualifier + [BRIEF_READY]
```

**Layer C — Diagnosis & reference**

```text
docs/13-customer-conditions-and-tone.md                Tone adaptation per customer state, C1–C7 conditions
docs/14-intent-detection-diagnosis-response.md         Type/transaction disambiguation, topic-change focus
docs/15-date-money-parsing-reference.md                Deterministic date (35 rules) + money parsing strings
```

## Maintenance rule

This skill is **kept in sync** with `chat_gpt_responds/`. The two providers must stay
**byte-identical** except for provider-specific frontmatter in `SKILL.md` (`name`,
`provider`, `synced-with`) and the `# Claude …` / `# ChatGPT …` H1. When you change a
behavior here, apply the identical change to the matching file in the other provider.
