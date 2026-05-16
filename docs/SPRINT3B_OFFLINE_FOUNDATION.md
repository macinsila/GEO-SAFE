# Sprint 3B-1 Offline Foundation

## Scope

Sprint 3B-1 rebuilds the GeoSafe PWA/offline foundation in a controlled way.
This sprint adds:

- A tracked web app manifest
- SVG app icons
- A safe offline fallback page
- A service worker with a narrow cache policy
- Minimal production-only service worker registration

This sprint does not add offline form queueing, background sync, or push notifications.

## What Is Cached

- Frontend shell assets such as `/`, `/index.html`, `/offline.html`, manifest, and SVG icons
- Same-origin static assets requested as `style`, `script`, `image`, or `font`
- A narrow public API allowlist:
  - `/api/v1/warehouses`
  - `/api/v1/safe-zones`
  - `/api/v1/earthquakes`
  - `/health`

Authenticated routes and auth-related API responses are not cached.

## What Is Not Cached

- Any request with an `Authorization` header
- Any request whose path includes `/admin`
- Any non-`GET` request
- Volunteer intake endpoints
- Shelter offer intake endpoints
- Emergency endpoints
- Auth endpoints
- Profile endpoints
- Inventory endpoints

## Sensitive Data Safety

The offline foundation intentionally avoids device-side storage of sensitive or user-submitted data.

- Volunteer data is not cached
- Shelter offer data is not cached
- Emergency create or moderation data is not cached
- Admin responses are not cached
- Authenticated responses are not cached
- Contact info is not cached
- Address detail is not cached
- Form payloads are not written to Cache Storage, localStorage, or IndexedDB by this sprint

## Offline Fallback Behavior

When a safe cached page is unavailable and the network fails, the user can be shown `offline.html`.
That fallback page:

- States that the app is offline
- Tells the user that the information is general in nature
- Directs the user to official channels such as `112`, `183`, AFAD, and local authorities
- Does not provide medical or therapeutic advice
- Does not ask for personal information

## Queue / Sync Deferred

Offline queue and sync are explicitly out of scope for Sprint 3B-1.

- No offline form queue
- No background sync
- No retry queue
- No IndexedDB submission store

## Security Notes For Future Queue/Sync Work

If a later sprint introduces offline submission queueing, it should first define:

- Data minimization rules for any locally stored payload
- Encryption or equivalent device-side protections where appropriate
- Clear expiration and secure deletion rules
- Separate handling rules for volunteer, shelter, emergency, and admin data
- Explicit reviewer coverage for privacy, abuse, and false-confidence risks
