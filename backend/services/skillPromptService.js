const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_ROOT = path.join(PROJECT_ROOT, 'skills');

const DEFAULT_MAX_WEBSITE_SKILL_CHARACTERS = Number(process.env.SKILL_MAX_WEBSITE_CHARACTERS || 12000);
const DEFAULT_MAX_RESPONSE_SKILL_CHARACTERS = Number(process.env.SKILL_MAX_RESPONSE_CHARACTERS || 22000);
const DEFAULT_MAX_PROJECT_SKILL_CHARACTERS = Number(process.env.SKILL_MAX_PROJECT_CHARACTERS || 36000);

const SKILL_GROUPS = {
  website_env_concept: {
    name: 'website_env_concept',
    title: 'Website Environment Concept',
    paths: [
      path.join(SKILLS_ROOT, 'website_env_concept')
    ]
  },
  chatgpt: {
    name: 'chat_gpt_responds',
    title: 'ChatGPT Response Skill',
    paths: [
      // Correct folder name requested by user.
      path.join(SKILLS_ROOT, 'chat_gpt_responds'),

      // Backward compatibility for older typo folder, if any old project still has it.
      path.join(SKILLS_ROOT, 'chat_gpt_reponds')
    ]
  },
  claude: {
    name: 'claude_responds',
    title: 'Claude Response Skill',
    paths: [
      path.join(SKILLS_ROOT, 'claude_responds')
    ]
  }
};

function normalizeProvider(provider = 'shared') {
  const value = String(provider || 'shared').toLowerCase().trim();

  if (['chatgpt', 'chat_gpt', 'openai', 'gpt', 'qwen', 'deepseek'].includes(value)) return 'chatgpt';
  if (['claude', 'anthropic'].includes(value)) return 'claude';
  if (['private', 'private_agent', 'local'].includes(value)) return 'private_agent';

  return 'shared';
}

function pathExists(directoryPath) {
  try {
    return fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory();
  } catch (_) {
    return false;
  }
}

function getExistingSkillDirectories(groupKey) {
  const group = SKILL_GROUPS[groupKey];
  if (!group) return [];

  return group.paths.filter(pathExists);
}

function getMarkdownFiles(directoryPath) {
  if (!pathExists(directoryPath)) return [];

  const results = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((entry) => {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
          return;
        }

        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          results.push(fullPath);
        }
      });
  }

  walk(directoryPath);

  return results.sort((a, b) => {
    const rank = (filePath) => {
      const name = path.basename(filePath).toLowerCase();
      if (name === 'skill.md') return 0;
      if (name === 'readme.md') return 1;
      return 2;
    };

    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.localeCompare(b);
  });
}

// ─── Conditional Reference Files ──────────────────────────────────────────────
// Docs 11-13 are segment- or topic-scoped: the house/apartment pilot playbooks, the
// facility vocabulary, and the location-anchor/landmark tables. All are large and
// only useful when the conversation actually touches that topic or property segment.
// Concatenating everything in fixed filename order (01, 02, ...)
// means these ALWAYS lose to the core docs once the character budget is hit — they
// never reach the LLM regardless of relevance. Instead, only include them when the
// recent conversation text matches their trigger, freeing budget for the always-on
// core docs while still surfacing facility/landmark reference tables exactly when
// they matter.
//
// NOTE: keyed by exact filename. The v7.0 consolidation merged the former
// 16+18 (facilities) into 12-facilities-reference.md and 17+19 (location/landmark)
// into 13-locations-and-landmarks.md; each regex below is the union of the pair it
// replaced. Renaming either doc REQUIRES updating this map, or the doc silently
// becomes always-on and eats the budget the core docs need.
//
// `context` is optional (recent user message + a few history turns, lowercased).
// When NOT provided (e.g. skill-status checks that don't have a live conversation),
// every conditional file is included — preserves prior behavior for those callers.
const CONDITIONAL_FILE_TRIGGERS = {
  '11-house-pilots.md': /\b(rumah|rmh|house|apartemen|apartment|apart|kontrakan|perumahan|kpr|cicilan|dp\b|rumah123|listing|masih\s*ada)\b/i,
  '12-facilities-reference.md': /\b(fasilitas|facility|facilities|gym|kolam|pool|wifi|ac\b|parkir|parking|dapur|kitchen|furnish|kasur|bed|lemari|wardrobe|balkon|balcony|jacuzzi|sauna|yoga|mushola|laundry|elevator|lift\b)\b/i,
  '13-locations-and-landmarks.md': /\b(dekat|deket|near|patokan|anchor|landmark|di\s+jalan|di\s+sekitar|kawasan|wisata|mall|mal\b|pakuwon|tunjungan|grand\s*city)\b/i,
};

function isConditionalFile(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return Object.prototype.hasOwnProperty.call(CONDITIONAL_FILE_TRIGGERS, name);
}

function shouldIncludeConditionalFile(filePath, context) {
  if (context == null) return true; // no context given → preserve old "include everything" behavior
  const name = path.basename(filePath).toLowerCase();
  const trigger = CONDITIONAL_FILE_TRIGGERS[name];
  if (!trigger) return true;
  return trigger.test(String(context));
}

function readSkillFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';

    const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').trim();
    if (!text) return '';

    return [
      '',
      `--- FILE: ${path.relative(PROJECT_ROOT, filePath)} ---`,
      text
    ].join('\n');
  } catch (error) {
    console.error('[SKILL FILE READ ERROR]', {
      filePath,
      message: error.message
    });
    return '';
  }
}

function trimForPrompt(text, maxCharacters = DEFAULT_MAX_PROJECT_SKILL_CHARACTERS) {
  const clean = String(text || '').replace(/\r\n/g, '\n').trim();
  if (clean.length <= maxCharacters) return clean;

  return `${clean.slice(0, maxCharacters)}\n\n[Skill text truncated for prompt size. Continue following the same rules from the loaded skill files.]`;
}

function loadSkillGroupPrompt(groupKey, options = {}) {
  const maxCharacters = Number(options.maxCharacters || DEFAULT_MAX_RESPONSE_SKILL_CHARACTERS);
  const directories = getExistingSkillDirectories(groupKey);
  const allFiles = directories.flatMap(getMarkdownFiles);
  // Conditional reference files (facilities/landmark tables) only load when the
  // conversation context actually mentions that topic — see CONDITIONAL_FILE_TRIGGERS.
  const files = allFiles.filter((f) => !isConditionalFile(f) || shouldIncludeConditionalFile(f, options.context));
  const loaded = files.map(readSkillFile).filter(Boolean).join('\n');

  if (!loaded.trim()) return '';

  const group = SKILL_GROUPS[groupKey] || { title: groupKey };
  return trimForPrompt(
    [
      `# LOADED SKILL GROUP: ${group.title}`,
      `Skill group key: ${groupKey}`,
      `Loaded markdown files: ${files.length}`,
      loaded
    ].join('\n\n'),
    maxCharacters
  );
}

function loadWebsiteEnvSkillPrompt(options = {}) {
  return loadSkillGroupPrompt('website_env_concept', {
    maxCharacters: options.maxCharacters || DEFAULT_MAX_WEBSITE_SKILL_CHARACTERS
  });
}

function loadResponseSkillPrompt(provider = 'shared', options = {}) {
  const normalizedProvider = normalizeProvider(provider);
  const maxCharacters = Number(options.maxCharacters || DEFAULT_MAX_RESPONSE_SKILL_CHARACTERS);
  const context = options.context;

  if (normalizedProvider === 'chatgpt') {
    return loadSkillGroupPrompt('chatgpt', { maxCharacters, context });
  }

  if (normalizedProvider === 'claude') {
    return loadSkillGroupPrompt('claude', { maxCharacters, context });
  }

  if (normalizedProvider === 'private_agent') {
    return trimForPrompt(
      [
        loadSkillGroupPrompt('chatgpt', { maxCharacters: Math.floor(maxCharacters / 2), context }),
        loadSkillGroupPrompt('claude', { maxCharacters: Math.floor(maxCharacters / 2), context })
      ].filter(Boolean).join('\n\n'),
      maxCharacters
    );
  }

  // Shared prompt loads both response skills so fallback providers have the same behavior.
  return trimForPrompt(
    [
      loadSkillGroupPrompt('chatgpt', { maxCharacters: Math.floor(maxCharacters / 2), context }),
      loadSkillGroupPrompt('claude', { maxCharacters: Math.floor(maxCharacters / 2), context })
    ].filter(Boolean).join('\n\n'),
    maxCharacters
  );
}

function loadProjectSkillPrompt(options = {}) {
  const provider = normalizeProvider(options.provider || 'shared');
  const websitePrompt = loadWebsiteEnvSkillPrompt({
    maxCharacters: Number(options.maxWebsiteCharacters || DEFAULT_MAX_WEBSITE_SKILL_CHARACTERS)
  });
  const responsePrompt = loadResponseSkillPrompt(provider, {
    maxCharacters: Number(options.maxResponseCharacters || DEFAULT_MAX_RESPONSE_SKILL_CHARACTERS),
    context: options.context
  });

  const loaded = [
    websitePrompt,
    responsePrompt
  ].filter(Boolean).join('\n\n');

  if (loaded.trim()) {
    return trimForPrompt(loaded, Number(options.maxCharacters || DEFAULT_MAX_PROJECT_SKILL_CHARACTERS));
  }

  return `
Property AI Website Skill Fallback

The assistant is a professional property assistant for a property rental and sales website.
It must help customers buy, sell, or rent houses, hotels, villas, apartments, boarding houses, shophouses, offices, and warehouses.
It must use backend property catalog data only, avoid inventing property names/prices/locations, reply in the same language as the customer's latest message, support multilingual responses such as Indonesian, English, Mandarin Chinese, Tagalog, Malay, Japanese, Korean, Thai, Vietnamese, Spanish, French, Arabic, Hindi, and other clear user languages, and keep the conversation focused on property topics.
If exact matches are available, recommend exact matches first. If exact matches are unavailable, clearly say there is no exact match and then offer closest alternatives from the backend catalog.
  `.trim();
}

function getSkillGroupStatus(groupKey) {
  const directories = getExistingSkillDirectories(groupKey);
  const files = directories.flatMap(getMarkdownFiles);
  const group = SKILL_GROUPS[groupKey];

  return {
    groupKey,
    name: group?.name || groupKey,
    title: group?.title || groupKey,
    configuredPaths: group?.paths.map((item) => path.relative(PROJECT_ROOT, item)) || [],
    existingDirectories: directories.map((item) => path.relative(PROJECT_ROOT, item)),
    exists: directories.length > 0,
    markdownFileCount: files.length,
    markdownFiles: files.map((file) => path.relative(PROJECT_ROOT, file))
  };
}

function getSkillRegistryStatus() {
  return {
    skillsRoot: path.relative(PROJECT_ROOT, SKILLS_ROOT),
    providerFolderMapping: {
      chatgpt: 'skills/chat_gpt_responds',
      qwen: 'skills/chat_gpt_responds',   // qwen → chatgpt skill set
      deepseek: 'skills/chat_gpt_responds',
      claude: 'skills/claude_responds',
      private_agent: ['skills/chat_gpt_responds', 'skills/claude_responds']
    },
    groups: {
      website_env_concept: getSkillGroupStatus('website_env_concept'),
      chat_gpt_responds: getSkillGroupStatus('chatgpt'),
      claude_responds: getSkillGroupStatus('claude')
    }
  };
}

module.exports = {
  PROJECT_ROOT,
  SKILLS_ROOT,
  SKILL_GROUPS,
  normalizeProvider,
  getMarkdownFiles,
  readSkillFile,
  trimForPrompt,
  loadSkillGroupPrompt,
  loadWebsiteEnvSkillPrompt,
  loadResponseSkillPrompt,
  loadProjectSkillPrompt,
  getSkillGroupStatus,
  getSkillRegistryStatus
};
