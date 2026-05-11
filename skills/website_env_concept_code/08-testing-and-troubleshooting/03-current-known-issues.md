# Current Known Issues and Alignment Notes

## ContactView `alert.message`

The ContactView template contains:

```text
alert.message
```

But the current script setup does not define `alert`.

If runtime errors occur, this is likely the cause.

## jQuery Source

The project contains local jQuery:

```text
frontend/public/assets/jquery-4.0.0/jquery-4.0.0.min.js
```

But ContactView currently loads jQuery from CDN:

```text
https://code.jquery.com/jquery-4.0.0.min.js
```

## About Portfolio Random Data

AboutView generates random portfolio price and area with `Math.random()`.

This means values can change after refresh.

## Log Model Not Used

The `Log` model exists, but `logController.js` only prints to console.

## Central API Service Not Used Everywhere

`frontend/src/services/api.js` exists, but AboutView and ContactView still use hardcoded Axios URLs.
