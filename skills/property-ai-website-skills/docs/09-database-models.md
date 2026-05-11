# 09 — Database Models

## 1. Contact Model

### File

```text
backend/models/Contact.js
```

### Purpose

Stores Contact Form submissions.

### Fields

```text
id
name
email
phone
subject
message
createdAt
updatedAt
```

## 2. ChatSession Model

### File

```text
backend/models/ChatSession.js
```

### Purpose

Stores customer identity and conversation sessions.

### Fields

```text
id
name
normalizedName
phone
normalizedPhone
source
lastMessageAt
createdAt
updatedAt
```

### Source Values

```text
website_chatbot
whatsapp_fonnte
contact_form
```

## 3. ChatMessage Model

### File

```text
backend/models/ChatMessage.js
```

### Purpose

Stores conversation history.

### Fields

```text
id
chatSessionId
role
message
channel
metadata
createdAt
updatedAt
```

### Role Values

```text
user
assistant
system
agent
```

### Channel Values

```text
website_chatbot
whatsapp
contact_form
```

## 4. Property Model

### File

```text
backend/models/Property.js
```

### Purpose

Stores portfolio data and property recommendation source data.

### Fields

```text
id
title
description
price
location
city
district
address
buildingArea
landArea
bedrooms
bathrooms
floors
parking
garden
buildingType
transactionType
facilities
furnishedStatus
style
imageUrl
status
createdAt
updatedAt
```

### Building Types

```text
house
villa
hotel
boarding_house
apartment
other
```

### Transaction Types

```text
sale
rent
purchase
```

### Status Values

```text
available
reserved
sold
rented
inactive
```

## 5. Log Model

### File

```text
backend/models/Log.js
```

### Purpose

Stores activity logs.

### Fields

```text
id
action
details
level
createdAt
updatedAt
```
