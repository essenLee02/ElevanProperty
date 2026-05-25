# 08. Module: Home

## HomeView.vue
`frontend/src/views/HomeView.vue`

The main landing page. Public — accessible to all users (logged in or not).

### Sections
- Hero section with property search CTA and "Chat with AI" button
- Featured property listings
- "How It Works" steps
- FloatingChatbot widget (bottom-right, always visible)

### Key Details
- Includes `<FloatingChatbot />` component
- No backend API call for page content — static layout
- Property catalog is loaded by FloatingChatbot on first chat message

## AboutView.vue
`frontend/src/views/AboutView.vue`

Static about page with company info, team, and property highlights. Public.

Backend route: `GET /api/about` → `aboutController.index`
