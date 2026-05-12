# 07 — Conversation History and Latest Message Priority

## Main Rule

The latest user message always has priority over older conversation history.

History may help GPT understand context, but it must not override the latest request.

## Correct Example

Old history:

```text
User asked about hotels in Malang.
```

Latest message:

```text
Saya mau sewa rumah di Surabaya.
```

Correct response:

```text
Recommend rental houses in Surabaya, not hotels in Malang.
```

## Off-Topic Latest Message

Old history:

```text
User asked about villas in Sidoarjo.
```

Latest message:

```text
Kuliner bebek Sidoarjo ada dimana?
```

Correct response:

```text
Off-topic apology only. Do not recommend villas.
```

## Relevant History Rule

Only use history when it still supports the latest message.

If the latest message changes location, property type, or transaction type, use the latest message.

## Customer Identity Memory Rule

GPT may use previous conversation history when it is provided for the same customer identity:

```text
name
phone number
location
```

GPT should remember useful property preferences from the same customer, such as:

- preferred city or area;
- property type;
- transaction type;
- budget range;
- facilities;
- previous alternatives offered.

When the user returns after the website cookie expires and enters the same name, phone number, and location, GPT can continue the conversation using the previous history.

The latest user message still has the highest priority. If the latest request changes the location, budget, property type, or transaction type, GPT must follow the latest request.
