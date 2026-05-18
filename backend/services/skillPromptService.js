const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const SKILL_FILES = [
  // Current code-aligned website skill. Keep this first so the LLM follows
  // the latest JSON catalog and first-chat propertyContext rules.
  path.join(PROJECT_ROOT, 'skills', 'website_env_concept', 'SKILL.md'),
  path.join(PROJECT_ROOT, 'skills', 'website_env_concept', '04-current-modules', '02-about-us-module.md'),
  path.join(PROJECT_ROOT, 'skills', 'website_env_concept', '06-planned-chatbot-openai-fonnte', '01-floating-chatbot-planned.md'),
  path.join(PROJECT_ROOT, 'skills', 'website_env_concept', '06-planned-chatbot-openai-fonnte', '02-property-catalog-planned.md'),
  path.join(PROJECT_ROOT, 'skills', 'website_env_concept', '06-planned-chatbot-openai-fonnte', '03-session-history-planned.md'),

  // ChatGPT response behavior skill.
  path.join(PROJECT_ROOT, 'skills', 'chat_gpt_reponds', 'SKILL.md'),
  path.join(PROJECT_ROOT, 'skills', 'chat_gpt_reponds', 'docs', '03-catalog-recommendation-rules.md'),
  path.join(PROJECT_ROOT, 'skills', 'chat_gpt_reponds', 'docs', '05-off-topic-and-ambiguity-control.md'),
  path.join(PROJECT_ROOT, 'skills', 'chat_gpt_reponds', 'docs', '06-budget-location-facility-rules.md'),
  path.join(PROJECT_ROOT, 'skills', 'chat_gpt_reponds', 'docs', '19-match-availability-response-rule.md'),
  path.join(PROJECT_ROOT, 'skills', 'chat_gpt_reponds', 'docs', '20-multilingual-llm-response-sync.md'),

  // Claude response behavior skill. Keep it synchronized with ChatGPT response behavior.
  path.join(PROJECT_ROOT, 'skills', 'claude_responds', 'SKILL.md'),
  path.join(PROJECT_ROOT, 'skills', 'claude_responds', 'docs', '03-catalog-recommendation-rules.md'),
  path.join(PROJECT_ROOT, 'skills', 'claude_responds', 'docs', '05-off-topic-and-ambiguity-control.md'),
  path.join(PROJECT_ROOT, 'skills', 'claude_responds', 'docs', '06-budget-location-facility-rules.md'),
  path.join(PROJECT_ROOT, 'skills', 'claude_responds', 'docs', '20-multilingual-llm-response-sync.md')
];

function readSkillFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const text = fs.readFileSync(filePath, 'utf8').trim();
    if (!text) return '';
    return `\n\n--- FILE: ${path.relative(PROJECT_ROOT, filePath)} ---\n${text}`;
  } catch (error) {
    return '';
  }
}

function trimForPrompt(text, maxCharacters = 26000) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
  if (clean.length <= maxCharacters) return clean;
  return `${clean.slice(0, maxCharacters)}\n\n[Skill text truncated for prompt size. Continue following the same rules.]`;
}

function loadProjectSkillPrompt() {
  const loaded = SKILL_FILES.map(readSkillFile).filter(Boolean).join('\n');

  if (loaded.trim()) {
    return trimForPrompt(loaded);
  }

  return `
Property AI Website Skill Fallback

The assistant is a professional property assistant for a property rental and sales website.
It must help customers buy, sell, or rent houses, hotels, villas, apartments, and boarding houses.
It must use backend property catalog data only, avoid inventing property names/prices/locations, reply in the same language as the customer's latest message, support multilingual responses such as Indonesian, English, Mandarin Chinese, Tagalog, Malay, Japanese, Korean, Thai, Vietnamese, Spanish, French, Arabic, Hindi, and other clear user languages, and keep the conversation focused on property topics.
If exact matches are available, recommend exact matches first. If exact matches are unavailable, clearly say there is no exact match and then offer closest alternatives from the backend catalog.
  `.trim();
}

module.exports = {
  loadProjectSkillPrompt
};
