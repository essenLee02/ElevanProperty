# 10 — Database Models

## Contact

Stores Contact Form submissions.

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

## Log

Stores user/system activity logs if enabled.

```text
id
action
details
level
createdAt
updatedAt
```

## ChatSession

Stores chatbot user identity.

```text
id
name
normalizedName
phone
normalizedPhone
location
normalizedLocation
source
lastMessageAt
createdAt
updatedAt
```

## ChatMessage

Stores chatbot conversation messages.

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

## Property

Optional database model if JSON property catalog is later moved into MySQL.

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
facilities
buildingType
transactionType
imageUrl
status
createdAt
updatedAt
```

## JSON vs Database Rule

Current lightweight implementation may use JSON property data.

If properties become dynamic/admin-managed, move catalog into database.
