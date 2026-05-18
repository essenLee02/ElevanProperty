# 06. Skill Loader & Prompt Composition

## Loading Unified Skills

```javascript
class PromptService {
  async loadSkill(provider) {
    const skillPath = provider === 'chatgpt' 
      ? './skills/chat_gpt_responds'
      : './skills/claude_responds';

    let prompt = fs.readFileSync(`${skillPath}/SKILL.md`, 'utf8');

    for (let i = 1; i <= 7; i++) {
      const doc = fs.readFileSync(
        `${skillPath}/docs/${i.toString().padStart(2,'0')}-*.md`, 'utf8'
      );
      prompt += `\n\n---\n\n${doc}`;
    }

    return prompt;
  }
}
```

## Prompt Composition

```javascript
async composePrompt(userMessage, sessionData, propertyData) {
  // 1. Load skill
  const skill = await this.loadSkill(provider);

  // 2. Build context
  const context = `User: ${sessionData.name}, Location: ${sessionData.location}`;

  // 3. Format catalog
  const catalog = propertyData.map(p => 
    `${p.name}: ${p.type}, ${p.location}, ${p.price}`
  ).join('\n');

  // 4. Compose
  return `${skill}\n\nCONTEXT:\n${context}\n\nCATALOG:\n${catalog}\n\nUSER: ${userMessage}`;
}
```

## Token Optimization

- Keep skills consolidated
- Cache loaded skills
- Truncate history to last 3 messages
- Minimize repetition
- Use abbreviations

## Skill Files Structure

```
skills/
├── chat_gpt_responds/
│   ├── SKILL.md
│   └── docs/ (7 files: 01-07)
└── claude_responds/
    ├── SKILL.md
    └── docs/ (7 files: 01-07)
```

See unified skills documentation for complete skill file content.
