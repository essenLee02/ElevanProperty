# 09. Module: About Us

## About Page Structure

```
About Module
├── Company Overview
│   ├── Mission & Vision
│   └── Company history
│
├── Team Section
│   ├── Team members
│   └── Roles
│
├── Why Choose Us
│   ├── 3-4 key benefits
│   └── Trust indicators
│
└── Property Catalog
    ├── Featured listings
    └── Call to action
```

## Component Template

```vue
<template>
  <div class="about-module">
    <section class="company-overview">
      <h1>About ElevanLabs</h1>
      <p>{{ companyDescription }}</p>
    </section>

    <section class="team">
      <h2>Our Team</h2>
      <div class="team-grid">
        <TeamMember 
          v-for="member in team" 
          :key="member.id"
          :member="member"
        />
      </div>
    </section>

    <section class="why-us">
      <h2>Why Choose Us?</h2>
      <BenefitCard v-for="benefit in benefits" :key="benefit.id" :benefit="benefit" />
    </section>

    <section class="catalog">
      <h2>Our Properties</h2>
      <CatalogPreview />
    </section>
  </div>
</template>
```

## Content Areas

- Company mission/vision
- Team profiles
- Key differentiators
- Service highlights
- Property statistics
- Contact call-to-action

## JSON Catalog Integration

- Display property count by type
- Highlight featured listings
- Show transaction types
- Location availability

## Call to Actions

- "View All Properties" → Chatbot
- "Contact Us" → Contact form
- "Chat with AI" → Floating chatbot
