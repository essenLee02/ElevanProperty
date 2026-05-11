# Logger Module

## Current Status

Partially implemented.

## Backend API

```text
POST /api/log
```

## Frontend Usage

Used by:

```text
router.afterEach()
AboutView.vue filter watcher
```

## Current Backend Behavior

The backend prints log messages to console.

## Current Limitation

The current `Log` model exists, but `logController.js` does not save logs into the database.
