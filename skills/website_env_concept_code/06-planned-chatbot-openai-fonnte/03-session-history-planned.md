# Session History Planned Development

## Current Status

Not implemented in the current backend code.

## Planned Models

```text
ChatSession
ChatMessage
```

## Planned Purpose

Session history should support:

```text
remembering user name and phone
saving user messages
saving ChatGPT answers
loading recent history
prioritizing latest user request
```

## Planned Important Rule

The latest user message must always have priority over old history.

Example:

```text
Old history: user asked about hotel in Malang.
Latest message: user asks for rental house in Surabaya.
Correct answer: rental house in Surabaya.
```
