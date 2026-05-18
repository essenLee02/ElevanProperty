# 15 — Contact Form Public Submission and Google Sheets Non-Blocking Rule

## Purpose

The Contact Form is a public user-facing form.

Users should not need login, JWT, Google JWT, service-account knowledge, or any authentication token to submit the form.

## Backend Rule

The backend may use a Google Service Account JWT internally to write to Google Sheets, but that is not a user authentication requirement.

If Google Sheets fails because of:

```text
invalid_grant
Invalid JWT Signature
wrong service account key
private key formatting issue
Google API permission issue
```

the backend must:

1. log the technical error in the backend terminal;
2. save the contact submission to the database if possible;
3. return success to the frontend when the database save succeeds;
4. not show the raw Google JWT error to the user as a failed form submission.

## Recommended Flow

```text
User submits Contact Form
→ backend validates fields
→ backend saves to database first
→ backend tries Google Sheets sync
→ if Google Sheets fails, log backend error but continue
→ backend optionally sends WhatsApp AI reply
→ frontend shows success if database save succeeds
```

## Terminal Log Rule

Technical details should appear in terminal logs, for example:

```text
[CONTACT GOOGLE SHEETS NON-BLOCKING ERROR]
```

## User Message Rule

Do not show this kind of raw error to public users:

```text
invalid_grant: Invalid JWT Signature
```

Use a user-friendly message instead:

```text
Message received and saved successfully.
```
