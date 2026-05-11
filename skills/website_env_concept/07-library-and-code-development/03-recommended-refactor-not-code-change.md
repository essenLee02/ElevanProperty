# Recommended Refactor Notes

This file is documentation only.

No code was changed.

## Recommended Backend Refactor

Move reusable logic from `contactController.js` into services later:

```text
googleSheetsService.js
validationService.js
```

Future service files:

```text
openaiService.js
fonnteService.js
sessionService.js
propertyRecommendationService.js
```

## Recommended Frontend Refactor

Use the existing central API service everywhere:

```text
frontend/src/services/api.js
```

Future service files:

```text
contactApi.js
aboutApi.js
chatbotApi.js
logApi.js
```

Future components:

```text
Navbar.vue
PortfolioCard.vue
PropertyFilter.vue
FloatingChatbot.vue
```

## Important

These are recommendations only and are not implemented in the current code.
