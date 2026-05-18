# 08. Module: Home

## Landing Page Structure

```
Home Module
├── Hero Section
│   ├── Title & CTA
│   ├── Search box (property type, location)
│   └── Featured properties carousel
│
├── Featured Listings
│   ├── Top 6 properties
│   └── "View More" link
│
├── How It Works
│   ├── 3-step explanation
│   └── Call to action
│
└── Chat Widget
    ├── Floating chatbot
    └── Encourage interaction
```

## Component Template

```vue
<template>
  <div class="home-module">
    <section class="hero">
      <h1>Find Your Perfect Property</h1>
      <p>Powered by AI in Indonesia</p>
      <button @click="openChatbot">Chat with AI</button>
    </section>

    <section class="featured">
      <h2>Featured Properties</h2>
      <PropertyCard 
        v-for="prop in featuredProperties" 
        :key="prop.id" 
        :property="prop"
      />
    </section>

    <FloatingChatbot />
  </div>
</template>
```

## Features

- Property search with AI assistance
- Featured listings display
- Quick property filters
- Floating chatbot widget
- Mobile responsive
- Fast loading (<2s)

## API Integration

- GET /api/catalog - Load featured properties
- POST /api/chatbot - Chat search

## SEO Optimization

- Meta tags for social sharing
- Structured data (schema.org)
- Sitemap inclusion
- Mobile-first design
