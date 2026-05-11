# Current Backend Models

## `Contact.js`

Table:

```text
contacts
```

Fields:

```text
name
email
phone
subject
message
createdAt
updatedAt
```

All main fields are required.

## `Log.js`

Table:

```text
logs
```

Fields:

```text
action
details
createdAt
updatedAt
```

Current code defines the model, but the current `logController.js` only logs to console and does not insert into the `logs` table.

## Models Not Yet Implemented

These models do not exist in the current code:

```text
ChatSession
ChatMessage
Property
```

They should be treated as planned development.
