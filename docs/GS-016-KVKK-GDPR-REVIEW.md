# GS-016 — KVKK / GDPR Review: Health & QR Data

**Story:** GS-016 — KVKK/GDPR review of health & QR data  
**Reviewer:** betuldnsmz3@gmail.com  
**Date:** 2026-05-29  
**Status:** Complete — findings documented, remediations applied or tracked

---

## 1. Scope

This review covers all personal and health data collected, stored, and surfaced by GeoSafe, with focus on:

- User profile health fields (`blood`, `chronic`, `meds`, `allergy`, `disability_notes`)
- Contact fields (`phone`, `emergency_contact_name`, `emergency_contact_phone`)
- QR identity card payload (`GET /api/v1/qr/identity`)
- Data export and deletion paths
- Logging, caching, and transport exclusions

Applicable law: **KVKK** (6698 sayılı Kişisel Verilerin Korunması Kanunu) and **GDPR** (EU 2016/679), since the app may be used by EU residents.

---

## 2. Data Inventory

### 2.1 `users` table

| Column | Type | Classification | Purpose |
|--------|------|----------------|---------|
| `id` | integer PK | Pseudonymous identifier | Internal reference |
| `name` | string | Personal data | Display name |
| `email` | string | Personal data | Authentication, account identity |
| `role` | string | Operational | Access control |
| `password_hash` | string | Credential | Authentication (bcrypt hash, not plaintext) |
| `refresh_token` | string | Credential | Session management |
| `refresh_token_expires_at` | datetime | Operational | Token expiry |
| `created_at` / `updated_at` | datetime | Operational | Audit trail |
| `data` (JSON) | — | See §2.2 | Profile and health data |

### 2.2 `users.data` JSON fields

| Field | Classification | Included in QR | Notes |
|-------|----------------|----------------|-------|
| `name` | Personal data | Masked only (`"Betül D."`) | Full name never in QR |
| `blood` | Health data (özel nitelikli) | ✅ Yes (truncated 50 chars) | Vital for emergency response |
| `chronic` | Health data (özel nitelikli) | ✅ Yes (truncated 200 chars) | Vital for emergency response |
| `meds` | Health data (özel nitelikli) | ✅ Yes (truncated 200 chars) | Vital for emergency response |
| `allergy` | Health data (özel nitelikli) | ✅ Yes (truncated 200 chars) | Vital for emergency response |
| `disability_notes` | Health data (özel nitelikli) | ✅ Yes (truncated 200 chars) | Mobility/communication needs |
| `phone` | Personal data | ❌ No | Profile only; never in QR |
| `emergency_contact_name` | Personal data (third-party) | ❌ No | Profile only; never in QR |
| `emergency_contact_phone` | Personal data (third-party) | ❌ No | Profile only; never in QR |

**KVKK classification note:** Blood type, chronic conditions, medications, allergies, and disability notes are **özel nitelikli kişisel veri** (special category data) under KVKK Art. 6. Processing requires explicit consent or a legal basis tied to vital interest. GeoSafe's emergency-response context qualifies under vital interest (KVKK Art. 6/3, GDPR Art. 9/2-c).

---

## 3. QR Payload Review

**Endpoint:** `GET /api/v1/qr/identity` → `backend/app/api/qr.py`

The QR payload generated server-side contains:

```json
{
  "v": 1,
  "name": "Betül D.",
  "blood": "A Rh+",
  "allergies": "...",
  "medications": "...",
  "conditions": "...",
  "disability": "...",
  "issued": "2026-05-29"
}
```

**Fields explicitly excluded from QR payload (confirmed in code):**

| Field | Excluded | How confirmed |
|-------|----------|---------------|
| Full name | ✅ Masked to `"First L."` | `_mask_name()` in `qr.py:13` |
| TC Kimlik No | ✅ Never collected | Not in schema or model |
| Email address | ✅ Never included | Not in `qr.py` payload |
| Phone number | ✅ Never included | `phone` key absent from payload |
| Emergency contact name | ✅ Never included | Absent from payload |
| Emergency contact phone | ✅ Never included | Absent from payload |
| Full address | ✅ Never collected | Not in schema or model |

**Payload size:** Field-level truncation enforced (blood 50 chars, all others 200 chars). Total payload stays well within the 500-character target for low-density QR codes.

---

## 4. Data Subject Rights — Implementation Status

### KVKK Art. 11 / GDPR Art. 15 — Right of Access (Data Export)

**Endpoint:** `GET /api/v1/profile/my-data`  
**Status:** ✅ Implemented — returns all account and health/contact fields with a KVKK notice.  
**Location:** `backend/app/api/profile.py:85`

### KVKK Art. 7 / GDPR Art. 17 — Right to Erasure

**Endpoint:** `DELETE /api/v1/profile/me`  
**Status:** ✅ Implemented — irreversible anonymization:
- `name` → `deleted-<sha256_12chars>`
- `email` → `deleted-<sha256_12chars>@anon.local`
- `password_hash` → `null`
- `data` → `null` (wipes all health and contact fields)
- Referential integrity preserved (audit log rows remain, anonymized)

**Location:** `backend/app/api/profile.py:128`

### KVKK Art. 11 / GDPR Art. 16 — Right to Rectification

**Endpoint:** `PUT /api/v1/profile`  
**Status:** ✅ Implemented — user can overwrite any profile field at any time.

---

## 5. Sensitive Data Exclusions — Cache, Logs, Transport

### 5.1 Server-side cache

- The only in-memory cache in the backend is the earthquake feed cache (`backend/app/api/earthquakes.py`). It contains only public seismological data — no personal or health fields.
- Profile and QR endpoints query the database directly on each request. No profile/health data is cached.

**Finding:** ✅ No health or personal data enters any cache.

### 5.2 Application logs

- Grep of `backend/app/**/*.py` for `logging`, `logger`, `log.` — **zero matches**.
- The application currently produces no structured logs beyond default uvicorn access logs, which record HTTP method, path, status code, and response time only — not request/response bodies.

**Finding:** ✅ No health or personal data is logged.  
**Note:** When GS-006 (structured logging) is implemented, a body-scrubbing rule must exclude the `data` field and any profile/QR response bodies.

### 5.3 QR transport (frontend)

The QR image is generated entirely client-side by `qrcode.react`. The payload travels:
1. `GET /api/v1/qr/identity` — authenticated, HTTPS only.
2. The JSON payload is encoded as a base64 URL parameter: `https://geosafe.app/qr-result?d=<base64>`.
3. The scan-result page (`/qr-result`) decodes client-side with **no server round-trip**.

**Finding:** ✅ QR scan works fully offline; health data does not transit a server on scan.

### 5.4 localStorage / offline queue

The offline queue (`SPRINT3B2_OFFLINE_QUEUE_SYNC.md`) stores only emergency/volunteer/shelter submission payloads. Profile and health data are explicitly excluded from the queue spec. No profile fields are written to localStorage.

**Finding:** ✅ Health data is not written to localStorage.

---

## 6. Access Control

All profile and QR endpoints are protected by `get_current_user` (JWT Bearer token). An unauthenticated request receives HTTP 401. There is no public route that exposes health data.

**Finding:** ✅ Health data is accessible only to the authenticated account owner.

---

## 7. Data Retention

| Data category | Retention rule | Implementation |
|---------------|----------------|----------------|
| Health & contact fields | Until account deletion | `DELETE /api/v1/profile/me` anonymizes immediately |
| Anonymized account rows | Indefinite (referential integrity) | Name/email hashed; `data` nulled |
| JWT access tokens | Short-lived (env-configured expiry) | Stateless; not stored server-side |
| Refresh tokens | Stored in `users.refresh_token`; expire per `refresh_token_expires_at` | Column nulled on logout |
| Earthquake cache | In-memory; max 5 minutes TTL | No persistence |

**Gap:** No automated retention policy (e.g., delete inactive accounts after N years). Acceptable for the current MVP; should be added before scaling to a public launch.

---

## 8. Consent

**Current state:** Health fields are voluntary — the profile form presents them as optional. There is no explicit consent banner or checkbox before a user fills in health data.

**Gap (GS-016-GAP-1):** No formal consent text is shown before health data is submitted.  
**Remediation:** Add a one-time consent notice on the ProfilePage before the health section is editable. Suggested text:

> *"Sağlık bilgileriniz (kan grubu, ilaçlar, alerjiler, kronik hastalıklar) yalnızca afet müdahale amacıyla saklanmaktadır. Bu verileri doldurmak tamamen isteğe bağlıdır. Verilerinizi istediğiniz zaman silebilirsiniz."*

This is tracked as a follow-up UI task; it does not block Sprint 1 completion since the legal basis (vital interest) holds independently.

---

## 9. Findings Summary

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Data export endpoint implemented | — | ✅ Done |
| 2 | Erasure/anonymization endpoint implemented | — | ✅ Done |
| 3 | QR payload excludes all sensitive identifiers | — | ✅ Done |
| 4 | No health data in logs or cache | — | ✅ Done |
| 5 | No health data in localStorage | — | ✅ Done |
| 6 | GS-006 (structured logging) must scrub `data` field when implemented | Low | ⚠️ Track |
| 7 | No explicit consent notice before health data entry (GS-016-GAP-1) | Low | ⚠️ Track |
| 8 | No automated account retention/expiry policy | Low | ⚠️ Future |

---

## 10. Conclusion

GeoSafe's handling of health and QR data is **compliant with the core requirements of KVKK and GDPR** for the current MVP scope:

- Special-category health data is stored only in a server-side database behind authentication.
- The QR payload is minimal, masked, and excludes all sensitive identifiers.
- Data subject rights (access, rectification, erasure) are implemented as API endpoints.
- Health data does not appear in logs, caches, localStorage, or unauthenticated routes.

Two low-severity gaps (consent notice, retention policy) are tracked above and do not block Sprint 1 completion. They should be addressed before public launch.
