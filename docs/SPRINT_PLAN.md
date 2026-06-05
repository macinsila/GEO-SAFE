# GeoSafe — Sprint Plan

**Product:** GeoSafe — Neighborhood-scale Smart Disaster Logistics & Decision Support System
**Last updated:** 2026-06-06
**Companion doc:** `PRODUCT_BACKLOG.md` (story definitions, acceptance criteria, estimates)
**Status tracker:** `proje_durumu.md` (detailed per-sprint completion notes)

---

## 1. Planning assumptions

- **Team:** small (≈3 developers, part-time). Roles flex across backend/frontend.
- **Velocity:** ~21 story points per sprint (sustained across S1–S10 actuals).
- **Cadence:** 2-week sprints. Sprint planning Monday (day 1), review + retro Friday (day 10).
- **Theme arc:** *Foundation → Real-time safety → Guidance & coordination → Reach & hardening → Research & depth.*

---

## 2. Sprint summary — all sprints

| Sprint | Theme | Points | Status | Headline outcome |
|--------|-------|------:|--------|------------------|
| **1** | Foundation & Trust | 21 | ✅ Done | CI live; security baseline; real earthquake data |
| **2** | Real-Time Safety | 21 | ✅ Done | SSE live alerts + refresh tokens + "I'm safe" check-in |
| **3** | Guidance & Coordination | 21 | ✅ Done | Real routing + supply transfers + zone needs + stock alerts |
| **4** | Reach & Hardening | 21 | ✅ Done | Web Push + i18n TR/EN + marker clustering + CSV/PDF reports |
| **5** | Security & Arch Foundation | 21 | ✅ Done | RBAC + audit log + password reset + CommsChannel abstraction |
| **6** | Smart Earthquake Notifications & Quality | 21 | ✅ Done | EQ prefs/dispatch + frontend test suite + abuse protection + metrics |
| **7** | Volunteer, Damage & E2E | 21 | ✅ Done | Volunteer task board + photo damage reports + Playwright E2E |
| **8** | Chat, Analytics & Battery | 21 | ✅ Done | Online chat + KPI dashboard + push-over-polling + low-power mode |
| **9** | Off-Grid Research & ADR | 21 | ✅ Done | BLE spikes (GS-130/131/132) + ADR-001 architecture decision |
| **10** | Accessibility, Live Inventory & Data | 21 | ✅ Done | WCAG 2.1 AA + live SSE inventory + bulk import + high-contrast mode |
| **11** | Offline QR, Quiet Hours & Seed Consolidation | 26 | ✅ Done | QR signing + EQ quiet hours + activity timeline + capacity routing |
| **12** | Geofencing, Offline Map & Community | 21 | ✅ Done | Geofenced incident push + offline tile cache + neighborhood channels |
| **13** | Data Intelligence & DevEx | 19 | ✅ Done | GS-051 ✅ · GS-063 ✅ · GS-091 ✅ · GS-093 ✅ · GS-112 ✅ |
| | **Completed total** | **276** | | 79% of backlog (350 pts) |

---

## 3. Completed sprints — S1–S10 (summary)

> Full details with file paths and migration numbers are in `proje_durumu.md`.

### Sprint 1 — Foundation & Trust ✅
GS-001 CI, GS-002 pre-commit, GS-012 security headers, GS-060 earthquake feed, GS-092 config validation, GS-016 KVKK/GDPR.

### Sprint 2 — Real-Time Safety ✅
GS-010 refresh tokens, GS-020 SSE live channel, GS-040 "I'm safe" check-in, GS-005 Sentry error tracking.

### Sprint 3 — Guidance & Coordination ✅
GS-030 ORS turn-by-turn routing, GS-052 transfer requests, GS-053 zone needs intake, GS-081 low-stock SSE alert.

### Sprint 4 — Reach & Hardening ✅
GS-021 Web Push (VAPID), GS-071 i18n TR/EN, GS-062 marker clustering, GS-082 CSV/PDF reports.

### Sprint 5 — Security & Arch Foundation ✅
GS-095 CommsChannel abstraction, GS-011 password reset + email verify, GS-013 RBAC, GS-014 audit log, GS-006 JSON logging, GS-015 pip-audit + gitleaks CI.

### Sprint 6 — Smart Earthquake Notifications & Quality ✅
GS-100 EQ notification prefs, GS-101 per-user matching engine, GS-003 frontend test suite (103 tests), GS-017 abuse protection, GS-007 /ready + /metrics endpoints.

### Sprint 7 — Volunteer, Damage & E2E ✅
GS-050 volunteer task board, GS-042 photo damage reports (Supabase storage), GS-004 Playwright E2E smoke tests.

### Sprint 8 — Chat, Analytics & Battery ✅
GS-110 online chat panel (SSE), GS-080 KPI dashboard, GS-120 push-over-polling refactor, GS-121 low-power emergency mode.

### Sprint 9 — Off-Grid Research & ADR ✅
GS-130 Capacitor native shell spike, GS-131 BLE mesh spike, GS-132 BLE beacon spike, GS-137 ADR-001 (Capacitor confirmed; beacon approved; mesh deferred).

### Sprint 10 — Accessibility, Live Inventory & Data ✅
GS-070 WCAG 2.1 AA audit + fixes, GS-022 live SSE inventory on operations dashboard, GS-061 bulk import (warehouses + safe zones), GS-073 high-contrast/large-text mode.

---

## 4. Sprint 11 — Offline QR, Quiet Hours & Seed Consolidation (active)

**Sprint goal:** Close the QR safety story (signed offline-readable payload), complete the earthquake notification trio (quiet hours), unify seed scripts, add activity timeline, and make routing capacity-aware.

| ID | Story | Pri | Pts |
|----|-------|-----|----:|
| GS-094 | Documentation refresh | Should | 3 |
| GS-043 | Offline QR vital-info read (HMAC-signed payload) | Should | 3 |
| GS-102 | Quiet hours + critical override for EQ notifications | Could | 3 |
| GS-090 | Consolidate seed scripts | Should | 3 |
| GS-083 | Activity timeline (audit log UI) | Could | 3 |
| GS-031 | Capacity-aware routing (nearest safe-zone endpoint) | Could | 5 |
| GS-122 | Low-power location strategy (coarse GPS + consent) | Should | 3 |
| GS-044 | Multi-language QR vital card (TR/EN labels) | Could | 3 |
| | **Total** | | **26** |

**Dependencies:** GS-043 builds on GS-016 (KVKK) ✅ and existing QR infrastructure. GS-102 extends GS-100/101 ✅. GS-031 extends GS-030 ✅ and safe_zone model. GS-083 reads GS-014 audit_log ✅.

---

## 4b. Sprint 12 — Geofencing, Offline Map & Community ✅

**Sprint goal:** Make alerting location-aware, keep the evacuation map usable with no signal, and give neighborhoods their own moderated channels — all on top of the existing push/SSE/chat layer.

| ID | Story | Pri | Pts |
|----|-------|-----|----:|
| GS-023 | Geofenced incident alerts (geofence subscription + auto-dispatch on emergency) | Could | 8 |
| GS-033 | Offline evacuation base-map (SW tile cache + LRU + area download) | Could | 8 |
| GS-111 | Neighborhood/area channels + moderation (report/remove/mute + rate limit) | Could | 5 |
| | **Total** | | **21** |

**Dependencies:** GS-023 builds on GS-021 (Web Push) ✅ + GS-100 (haversine matching) ✅. GS-033 extends the existing PWA service worker ✅. GS-111 builds on GS-110 (chat) ✅ + GS-020 (SSE) ✅. Migrations 027 (geofence_subscriptions) + 028 (chat_channels et al.).

## 4c. Sprint 13 — Data Intelligence & DevEx (active)

**Sprint goal:** Add intelligence to the volunteer layer and the ops map, establish typed API contracts, lock down production deployment parity, and close the chat experience loop.

| ID | Story | Pri | Pts | Status |
|----|-------|-----|----:|--------|
| GS-051 | Skill/role volunteer matching | Could | 5 | ✅ migration 029; `primary_role` on volunteer apps; `/volunteer-tasks/{id}/candidates`; TasksPage matching modal |
| GS-063 | Demand/incident heatmap | Could | 5 | ✅ `GET /spatial/heatmap`; `leaflet.heat`; `HeatmapLayer.tsx`; LayersControl toggle |
| GS-091 | Typed API client from OpenAPI | Could | 3 | ✅ `backend/export_openapi.py`; `docs/openapi.json` snapshot (95 paths); `src/types/api.generated.ts` (3 583 lines); `npm run gen:api` |
| GS-093 | Production Docker parity + healthchecks | Could | 3 | ✅ `Dockerfile.prod` (backend+frontend); `nginx/nginx.prod.conf`; `docker-compose.prod.yml`; `/ready` healthcheck; gunicorn workers; `.env.prod.example` |
| GS-112 | Presence, read receipts & search (chat) | Could | 3 | ✅ migration 030; `chat_read_receipts`; presence in-memory dict + SSE `presence_update`; `GET /messages?q=` ILIKE; unread badge on Sohbet button |
| | **Total** | | **19** | ✅ 19 / 19 pts — Sprint complete |

**Dependencies:** GS-051 builds on GS-050 (volunteer task board) ✅. GS-112 builds on GS-110 (chat) ✅ + GS-111 (channels) ✅. GS-093 extends GS-007 (/ready + /metrics) ✅.

---

## 5. Upcoming backlog (S14+)

### Parked / Won't (this cycle, S13)
- **GS-041 Missing-persons board, GS-054 Donation matching** — need moderation/privacy design first.
- **GS-024 SMS fallback (op→user)** — needs Twilio/Netgsm account + cost model.
- **GS-064 Redis cache** — infrastructure cost; defer until load testing (GS-008) shows need.
- **GS-134 GSM/SMS device SOS, GS-136 Wi-Fi Direct** — require native Capacitor plugin (post-ADR-001).
- **GS-133 LoRa spike** — requires physical Meshtastic hardware.
- **GS-138 Offline mesh chat** — ADR-001 decision: deferred until BLE beacon pilot completes.
- **GS-032 Accessibility-aware multi-stop routes, GS-083 Activity timeline** — deprioritized; low coupling, schedule when S12 capacity permits.

---

## 6. Burn-up (cumulative)

| Sprint | Points | Cumulative | % of total (350 pts) |
|--------|-------:|-----------:|---------------------:|
| S1–S4 ✅ | 84 | 84 | 24% |
| S5 ✅ | 21 | 105 | 30% |
| S6 ✅ | 21 | 126 | 36% |
| S7 ✅ | 21 | 147 | 42% |
| S8 ✅ | 21 | 168 | 48% |
| S9 ✅ | 21 | 189 | 54% |
| S10 ✅ | 21 | 210 | 60% |
| S11 ✅ | 26 | 236 | 67% |
| S12 ✅ | 21 | 257 | 73% |
| S13 ✅ | 19 | 276 | 79% |

---

## 7. Cross-sprint dependency map (active dependencies)

- **GS-095 (CommsChannel)** ✅ → GS-110 chat ✅, future GS-130–136 radio channels.
- **GS-021 (Web Push)** ✅ + **GS-060 (EQ feed)** ✅ → GS-100/101 ✅ → **GS-102** (quiet hours, S11).
- **GS-014 (audit log)** ✅ → **GS-083** (activity timeline, S11).
- **GS-030 (routing)** ✅ → **GS-031** (capacity routing, S11).
- **GS-130/131/132 spikes** ✅ + **GS-137 ADR** ✅ → **GS-134** (device SMS, future native sprint).
- **GS-003 (frontend tests)** ✅ → **GS-004 E2E** ✅ → confidence for refactors in S11+.

---

## 8. Ceremonies & working agreements

- **Planning** (≈1.5 h, day 1): confirm sprint goal, pull stories meeting Definition of Ready, assign owners.
- **Daily async standup:** yesterday / today / blockers.
- **Mid-sprint check (day 5):** scope health; cut the lowest-priority story early if at risk.
- **Review (day 10):** demo against acceptance criteria.
- **Retro (day 10):** keep / drop / try.
- **Definition of Ready / Done:** as defined in `PRODUCT_BACKLOG.md` §7–8.

---

## 9. Related documents

- `PRODUCT_BACKLOG.md` — full story definitions (Epics A–N).
- `proje_durumu.md` — detailed completion state per sprint (Turkish, authoritative).
- `COMMS_RESILIENCE_ROADMAP.md` — phased plan for smart notifications, chat, battery, off-grid comms.
- `FEASIBILITY_BLUETOOTH.md` — browser-vs-native feasibility for BLE/offline communication.
- `adr/ADR-001-offgrid-architecture.md` — off-grid architecture decision (Capacitor, BLE beacon approved; mesh deferred).
