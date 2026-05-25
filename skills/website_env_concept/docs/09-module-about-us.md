# 09. Module: About Us

## AboutView.vue
`frontend/src/views/AboutView.vue`

Static about page. Public — accessible to all users.

### Content Areas
- Company overview / mission / vision
- Team section (agents: Clarence, Desy, Nigel, Natasha, Leo)
- Why Choose Us / key differentiators
- Property highlights / statistics
- Call-to-action → Contact form or Chatbot

### Backend
`GET /api/about` → `aboutController.index`

No database queries — static data returned from controller.
