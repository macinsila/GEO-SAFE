# Sprint 3B-2 Offline Queue + Safe Sync MVP

## Scope

Sprint 3B-2 adds a minimal offline form queue for public submission flows only.

Supported forms:

- Emergency report form
- Volunteer application form
- Shelter offer form

This sprint does not add background sync, push notifications, admin offline flows, or service worker cache expansion.

## Storage Choice

This MVP uses browser `localStorage` for a small, explicit, user-approved temporary queue.

- The queue is separate from the service worker cache
- Tokens and JWT values are not written into queue items
- Admin responses and authenticated data are not stored in the queue
- Queue items are deleted after successful sync

## Queue Item Shape

Each queued item stores only the minimal request payload plus lightweight sync metadata:

- `id`
- `type`
- `payload`
- `createdAt`
- `status`
- `retryCount`
- `lastError` optional

## What Is Stored

Only the minimum public-create request payload for the supported forms:

- Emergency: `durum`, `saat`, `harita_link`, `enlem`, `boylam`
- Volunteer: `full_name`, `contact_info`, `district`, `neighborhood`, `skills`, `availability_note`
- Shelter: `host_name`, `contact_info`, `city`, `district`, `neighborhood`, `address_detail`, `capacity`, `available_from`, `available_until`, `duration_note`, `household_notes`, `suitability_notes`

## What Is Not Stored

- JWT or bearer token
- Passwords
- Profile data
- Admin data
- Admin status updates
- Server responses
- Volunteer, shelter, or emergency admin lists
- Cached authenticated responses

## User Consent

Offline queue writes require explicit user consent.

When the user is offline and tries to submit one of the supported forms, the UI shows a warning that:

- The form will be stored temporarily on this device
- Shared devices are risky
- The pending item can be deleted before sync

Without that consent, the form is not queued.

## Pending Queue Behavior

- Pending item count is shown in the UI
- Users can manually trigger sync
- The app may attempt a simple sync when the `online` event fires
- Users can delete any pending item locally
- Queue list summaries avoid showing full sensitive details such as full contact data or full shelter address detail

## Success and Failure Behavior

- Successful sync deletes the local queue item immediately
- Failed sync keeps the item locally
- Failed sync increments `retryCount`
- Failed sync stores a lightweight `lastError` message for user feedback

## Shared Device Risk

This MVP does not claim encryption at rest.

Because emergency location details, volunteer contact information, and shelter address detail can be sensitive, the UI explicitly warns users not to save these drafts on shared devices unless necessary.

## Known Risks

- `localStorage` is simple but not ideal for sensitive temporary drafts
- Duplicate submit risk still exists if the network is unstable during sync
- There is no server-side idempotency key in this sprint
- There is no expiry or TTL cleanup yet

## Future Hardening

- Encryption at rest
- Queue item expiry / TTL
- Conflict handling
- Server-side idempotency key
- Background sync
- Audit logging
