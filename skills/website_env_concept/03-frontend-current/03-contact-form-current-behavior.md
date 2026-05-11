# Current Contact Form Behavior

## File

```text
frontend/src/views/ContactView.vue
```

## Fields

```text
name
email
phone
subject
message
```

## Validation

The form validates:

```text
blank name
blank email
blank phone
blank subject
blank message
phone format
```

Phone allowed characters:

```text
numbers 0-9
+
-
space
```

## Current Submit Endpoint

```text
http://localhost:5000/api/contact
```

This is hardcoded inside `ContactView.vue`.

## Toast Library

Uses:

```text
vue3-toastify
```

## jQuery Behavior

The component loads jQuery from CDN:

```text
https://code.jquery.com/jquery-4.0.0.min.js
```

Important alignment note:

The project also has a local jQuery file at:

```text
frontend/public/assets/jquery-4.0.0/jquery-4.0.0.min.js
```

But the current ContactView code loads CDN jQuery, not the local file.

## Template Alignment Note

The template includes:

```text
alert.message
```

But the current script setup does not define `alert`.

This should be documented as a current alignment issue if runtime errors occur.
