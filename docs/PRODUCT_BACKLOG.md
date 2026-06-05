# GeoSafe — Product Backlog

**Product:** GeoSafe — Neighborhood-scale Smart Disaster Logistics & Decision Support System
**Document type:** Engineering product backlog (epics, user stories, acceptance criteria, estimates)
**Last updated:** 2026-06-04
**Owner:** Product / Engineering team

---

## 1. How to read this backlog

**Priority (MoSCoW, for the current 8-week cycle)**

| Tag | Meaning |
|-----|---------|
| **Must** | Required for the cycle to be considered successful. Closes a real risk or core gap. |
| **Should** | High value, included if capacity allows. |
| **Could** | Desirable, scheduled only if everything above is on track. |
| **Won't (now)** | Explicitly out of scope this cycle; parked for later. |

**Estimation:** Story points on a Fibonacci scale (1, 2, 3, 5, 8, 13). 1 ≈ a few hours; 8 ≈ most of a sprint for one developer; 13 = too big, must be split.

**Status:** `New` · `Ready` · `In Progress` · `Done`. A story is *Ready* only when it meets the Definition of Ready (§7).

Story IDs (`GS-0xx`) are stable and referenced by the companion `SPRINT_PLAN.md`.

---

## 2. Current state snapshot (as of 2026-06-05 — S1–S12 complete)

**257 of 350 backlog points shipped (73%). All 8 Must items done.**

> **S11 (26 pts):** GS-094 docs, GS-043 signed offline QR, GS-102 EQ quiet hours, GS-090 seed consolidation, GS-083 activity timeline, GS-031 capacity routing, GS-122 low-power location, GS-044 multi-language QR.
> **S12 (21 pts):** GS-023 geofenced incident alerts (opt-in geofence + auto-dispatch on emergency), GS-033 offline base-map tile cache (SW cache-first + LRU + area download), GS-111 neighborhood channels + moderation (report/remove/mute + rate limit). Migrations 027–028.

### What's built
- **Backend** — FastAPI + SQLAlchemy 2.0 (async) + PostGIS/GeoAlchemy2. Alembic migrations 001–025. 25+ API routers including: `auth` (JWT + refresh tokens + RBAC + email verify + password reset), `warehouses`, `safe-zones`, `inventory`, `emergency` (+ photo upload), `earthquakes` (Kandilli feed + EQ notification prefs/dispatch), `spatial` (nearest-depot), `qr`, `announcements`, `sse` (live channel), `checkin`, `routing` (ORS + fallback), `transfers`, `zone_needs`, `push` (VAPID Web Push), `reports` (CSV/PDF), `volunteer_tasks`, `chat`, `kpi`, `admin_import` (bulk geo import), `observability` (/ready, /metrics). Structured JSON logging + Sentry + audit log + RBAC + CommsChannel abstraction.
- **Frontend** — React 18 + TS + Vite + Leaflet + react-i18next (TR/EN). Pages: Login, Emergency (+ photo), Profile, QR card/scan, Volunteer, Shelter, Announcements, Psych support, Admin dashboard (CRUD + bulk import + activity). Operations console: Dashboard (KPI + SSE live), Map (cluster + viewport), Logistics (live SSE inventory), Earthquakes (prefs), Announcements (SSE), Tasks, Chat panel. PWA service worker + Web Push + offline form queue. 103 frontend unit tests + Playwright E2E smoke suite.
- **Delivery** — Docker / docker-compose, Render (backend), Vercel (frontend), Supabase Postgres. GitHub Actions CI (pytest + ruff + eslint + playwright + pip-audit + gitleaks).

### Completed stories (55/73)
All Must items ✅, all S1–S12 Should items ✅. See `proje_durumu.md` for full per-story details.

### Remaining gaps (active backlog — 18 stories, ~93 pts)
- Skill matching (GS-051) · Donation intake (GS-054) · Missing-persons board (GS-041)
- Demand/incident heatmap (GS-063) · Accessibility multi-stop routes (GS-032)
- Presence/read receipts (GS-112) · SMS fallback op→user (GS-024)
- Typed API client (GS-091) · Prod Docker parity (GS-093) · Load test (GS-008) · Redis cache (GS-064)
- Native/hardware features (GS-133/134/136/138) pending ADR-001 pilot results

---

## 3. Epic overview

| Epic | Theme | Stories | Points |
|------|-------|--------:|------:|
| **A** | Quality, CI/CD & Observability | 8 | 35 |
| **B** | Security, Auth & Compliance | 8 | 29 |
| **C** | Real-Time Operations & Alerting | 5 | 34 |
| **D** | Routing & Evacuation Guidance | 4 | 26 |
| **E** | Citizen Safety & Family Reunification | 5 | 24 |
| **F** | Volunteer & Resource Coordination | 5 | 31 |
| **G** | Data Integration & Map Intelligence | 5 | 25 |
| **H** | Accessibility & Localization | 3 | 16 |
| **I** | Admin Analytics & Reporting | 4 | 14 |
| **J** | Platform & Developer Experience | 6 | 17 |
| **K** | Smart Earthquake Notifications | 4 | 14 |
| **L** | In-App Chat & Community Messaging | 3 | 16 |
| **M** | Battery & Low-Power Resilience | 4 | 14 |
| **N** | Off-Grid & Resilient Communications | 9 | 55 |
| | **Total** | **73** | **350** |

---

## 4. Epics & user stories

> Format per story: ID · Title · Priority · Points — user story — acceptance criteria.

### Epic A — Quality, CI/CD & Observability

**GS-001 · CI pipeline · Must · 5**
As a developer, I want automated checks on every push/PR so regressions are caught before merge.
- GitHub Actions workflow runs backend `pytest`, frontend unit tests, and a frontend production build.
- Lint (Python + TS) runs as a separate job; failures block the PR.
- Badges/status visible on PRs; pipeline completes in under ~10 min.
- Runs against a disposable Postgres/PostGIS service container for backend tests.

**GS-002 · Pre-commit hooks & linters · Should · 3**
As a developer, I want consistent formatting/linting locally so style noise stays out of reviews.
- `ruff` + `black` for Python; `eslint` + `prettier` for the frontend.
- `pre-commit` config installs in one command; hooks run on staged files.
- Existing code reformatted in a single isolated commit (no behavior change).

**GS-003 · Frontend test coverage for critical flows · Should · 8**
As a maintainer, I want core UI flows tested so refactors are safe.
- Unit/component tests for login, emergency submit, nearest-depot search, QR render, offline queue.
- Coverage ≥ 60% on `src/services`, `src/context`, `src/offlineQueue`, and key pages.
- Tests run in CI (GS-001).

**GS-004 · E2E smoke tests · Should · 8**
As a release manager, I want end-to-end happy-path coverage so deploys are trustworthy.
- Playwright suite covering: citizen finds nearest depot; citizen files emergency report; admin updates inventory.
- Runs headless in CI against a seeded ephemeral stack.
- Flaky-test retry policy documented.

**GS-005 · Error tracking (Sentry) · Should · 3**
As an operator, I want runtime errors captured with context so incidents are diagnosable.
- Sentry (or equivalent) wired into FastAPI and React with environment + release tags.
- PII scrubbing on (no health fields, tokens, or coordinates of individuals).
- Source maps uploaded for frontend.

**GS-006 · Structured logging & request IDs · Should · 3**
As an operator, I want correlated JSON logs so I can trace a request across the stack.
- JSON log formatter; every request tagged with a generated request ID returned in a response header.
- Log level configurable via env; secrets never logged.

**GS-007 · Readiness/liveness & metrics endpoint · Could · 2**
As a platform owner, I want health and basic metrics so autoscaling/monitoring works.
- `/health` (liveness) and `/ready` (DB reachable) distinct.
- Prometheus-style `/metrics` (request count, latency, error rate).

**GS-008 · Load test of hot endpoints · Could · 3**
As an engineer, I want load baselines so we know capacity before a real event.
- k6/Locust scripts for `nearest-depot`, warehouses, safe-zones, earthquakes.
- Report p50/p95/p99 and error rate at target concurrency; results committed to `docs/`.

### Epic B — Security, Auth & Compliance

**GS-010 · Refresh tokens & session lifecycle · Must · 5**
As a user, I want my session to refresh securely so I am not logged out mid-emergency or left with a long-lived token.
- Short-lived access token + rotating refresh token; refresh endpoint.
- Refresh rotation with reuse detection; logout revokes server-side.
- Frontend transparently refreshes and handles expiry (builds on existing expired-session handling).

**GS-011 · Password reset & email verification · Should · 5**
As a user, I want to verify my email and recover my password so my account is secure and recoverable.
- Email verification on register; reset via tokenized, expiring link.
- Tokens single-use; rate-limited; no account-existence leakage.

**GS-012 · Security headers, HTTPS & CORS tightening · Must · 3**
As a security owner, I want hardened HTTP responses so common web attacks are mitigated.
- HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy set.
- CORS reduced from wildcard methods/headers to an explicit allowlist per environment.
- Verified with a security-header scanner; documented in `docs/`.

**GS-013 · Granular RBAC audit · Should · 5**
As an admin, I want clearly scoped roles so users only access what their role permits.
- Roles defined and enforced server-side: citizen, volunteer, operator, admin.
- Every mutating endpoint asserts role; matrix documented and tested.
- Negative tests confirm forbidden access returns 403.

**GS-014 · Audit log for sensitive mutations · Should · 3**
As an admin, I want an append-only record of who changed what so actions are accountable.
- Audit entries for inventory changes, emergency status changes, role changes, admin CRUD.
- Captures actor, action, target, timestamp, request ID; queryable by admin.

**GS-015 · Dependency & secret scanning in CI · Should · 2**
As a maintainer, I want vulnerable deps and leaked secrets flagged automatically.
- Dependabot (or `pip-audit`/`npm audit`) + `gitleaks` in CI.
- High-severity findings block merge; policy documented.

**GS-016 · KVKK/GDPR review of health & QR data · Must · 3**
As a data owner, I want personal/health data handled lawfully so we meet KVKK/GDPR obligations.
- Data inventory of personal/health fields (profile, QR card) with retention rules.
- Consent text + data-deletion path; confirm sensitive fields excluded from caches/logs/QR payload.
- Findings + remediations recorded in `docs/`.

**GS-017 · Public-form abuse protection · Should · 3**
As an operator, I want public submission endpoints protected so they can't be flooded with junk during an event.
- Rate limiting + lightweight bot mitigation (e.g., proof-of-work/CAPTCHA fallback) on emergency/volunteer/shelter forms.
- Duplicate-submission suppression; abuse metrics surfaced.

### Epic C — Real-Time Operations & Alerting

**GS-020 · Live announcement channel (SSE/WebSocket) · Should · 8**
As a citizen/operator, I want announcements to appear instantly so I act on the latest information.
- Server push channel; clients receive new/updated announcements without polling.
- Graceful reconnect with backfill of missed messages; falls back to polling if unsupported.
- Works with existing `announcements` API and feed component.
- Implements the `CommsChannel` transport model and message envelope (GS-095) so the same protocol later carries offline messages.

**GS-021 · Web Push emergency alerts · Should · 8**
As a citizen, I want push alerts on my device so I'm warned even when the app is closed.
- Web Push (VAPID) subscription flow tied to the existing PWA service worker.
- Admin/operator can broadcast an alert; delivery + opt-out respected.
- Builds on the deferred S3 push scope; tokens stored securely.

**GS-022 · Live inventory on operations dashboard · Could · 5**
As an operator, I want stock levels to update live so coordination reflects reality.
- Inventory changes propagate to the dashboard in near real time (reuses GS-020 transport).
- Visual indicator for recently changed items.

**GS-023 · Geofenced incident alerts · Could · 8**
As a citizen, I want to be notified only about incidents near me so alerts are relevant.
- Notify subscribers within a radius of an incident/safe-zone change.
- Radius configurable; respects last-known/opt-in location only (privacy-preserving).

**GS-024 · SMS fallback for critical alerts · Could · 5**
As an operator, I want SMS delivery so alerts reach users without data connectivity.
- Integration with an SMS provider (e.g., Twilio/Netgsm) for high-severity broadcasts.
- Cost guardrails + per-event send caps; delivery status tracked.

### Epic D — Routing & Evacuation Guidance

**GS-030 · Turn-by-turn routing to depot/safe zone · Should · 8**
As a citizen, I want real walking/driving directions, not just a straight line, so I can actually get there.
- Integrate a routing engine (OSRM/Valhalla or hosted) feeding the existing `RouteLayer`.
- Route reflects mode (walk/drive), shows distance + ETA, recalculates on re-search.
- Degrades to straight-line + distance if routing service is unavailable.

**GS-031 · Capacity-aware routing · Could · 5**
As a citizen, I want to be routed to a safe zone that isn't full so I'm not sent somewhere with no room.
- Routing/ranking considers safe-zone occupancy vs capacity.
- Full/over-capacity zones de-prioritized; reason shown to user.

**GS-032 · Accessibility-aware & multi-stop routes · Could · 5**
As a citizen with mobility needs, I want step-free routing options so the route is usable for me.
- Optional accessibility profile (avoid stairs/steep grades where data exists).
- Optional intermediate stop (e.g., pick up family/supplies).

**GS-033 · Offline evacuation base-map · Could · 8**
As a citizen, I want the map to work without signal so I can navigate during an outage.
- Pre-cache base tiles for a configurable area via the service worker.
- Offline indicator; cached safe zones/depots usable; storage budget enforced.

### Epic E — Citizen Safety & Family Reunification

**GS-040 · "I'm safe" check-in · Should · 5**
As a citizen, I want to mark myself safe and share it so loved ones stop worrying.
- One-tap status (Safe / Needs help) with optional coarse location and timestamp.
- Shareable status link; status visible to designated contacts.
- Works through the offline queue when offline.

**GS-041 · Missing-persons / reunification board · Could · 8**
As a family member, I want to post and search for missing people so we can reunite.
- Create/search entries with name, photo, last-seen area, status.
- Privacy controls + moderation; duplicate detection.

**GS-042 · Damage report with photo + geotag · Should · 5**
As a citizen, I want to attach a photo and location to a report so responders can triage accurately.
- Extend emergency report with image upload (size/type limits) and auto geotag.
- Images stored in object storage; thumbnails on the operations map.
- Queueable offline (metadata first, media on reconnect).

**GS-043 · Offline QR vital-info read · Should · 3**
As a responder, I want to read a victim's vital info from their QR even with no internet so I can act fast.
- QR encodes a minimal signed vital payload readable fully offline (no server round-trip).
- Sensitive identifiers excluded; payload validated/signed to prevent tampering.

**GS-044 · Multi-language QR vital card · Could · 3**
As a responder, I want vital info labelled in multiple languages so language isn't a barrier.
- QR/printout shows labels in TR/EN (+AR) for blood type, allergies, chronic conditions, meds.

### Epic F — Volunteer & Resource Coordination

**GS-050 · Volunteer task board & assignment · Should · 8**
As a coordinator, I want to assign tasks to volunteers and track them so effort isn't wasted or duplicated.
- Create tasks (location, skill, urgency); assign/claim; status lifecycle (open→in progress→done).
- Volunteer view of their tasks; coordinator board view.

**GS-051 · Skill/role matching · Could · 5**
As a coordinator, I want volunteers matched to needs by skill so the right people go to the right tasks.
- Volunteer profile skills/availability; suggested matches for open tasks.

**GS-052 · Inter-warehouse transfer requests · Should · 5**
As an operator, I want to request and approve stock transfers so supplies move where they're needed.
- Create transfer request (item, qty, from/to); approve/reject; updates inventory + movement log.
- Reuses existing `inventory_movement` model.

**GS-053 · Safe-zone needs intake · Should · 5**
As a safe-zone lead, I want to request supplies so depots know real demand.
- Submit needs (item, qty, priority) from a safe zone; visible on operations dashboard.
- Links demand to nearest depot via existing spatial query.

**GS-054 · Donation intake & matching · Could · 8**
As a donor, I want to offer supplies and have them matched to needs so help reaches the right place.
- Donation offers (item, qty, location); matched against open needs; pickup/dropoff status.

### Epic G — Data Integration & Map Intelligence

**GS-060 · Real earthquake feed with caching · Must · 5**
As a citizen, I want accurate, current earthquake data so the map reflects reality.
- Integrate AFAD/Kandilli (and/or USGS) feed behind the existing `earthquakes` endpoint.
- Server-side cache + refresh interval; graceful handling of upstream outage.
- Magnitude/recency filters; timestamps in local time.

**GS-061 · Bulk import of safe zones / depots · Should · 5**
As an admin, I want to import official geo-data so we don't hand-enter locations.
- Import from GeoJSON/CSV (e.g., AFAD open data); validation + dry-run preview.
- Idempotent upsert by external key; import report with skipped/failed rows.

**GS-062 · Marker clustering & viewport loading · Should · 5**
As a user, I want the map to stay fast with many markers so it's usable during a large event.
- Clustering for warehouses/safe zones/incidents; data loaded per viewport/bbox.
- Smooth at 1,000+ points on mid-range mobile.

**GS-063 · Demand/incident heatmap · Could · 5**
As an operator, I want a heatmap of demand/incidents so I can see hotspots at a glance.
- Toggleable heatmap layer driven by reports/needs density.

**GS-064 · Redis caching layer · Could · 5**
As an engineer, I want hot read endpoints cached so we survive traffic spikes.
- Redis cache for warehouses/safe-zones/earthquakes with sane TTL + invalidation on write.
- Cache hit/miss metrics exposed.

### Epic H — Accessibility & Localization

**GS-070 · WCAG 2.1 AA audit & fixes · Should · 8**
As a user with disabilities, I want an accessible app so I can use it in an emergency.
- Audit (automated + manual) of contrast, keyboard nav, focus order, ARIA, screen-reader labels.
- Critical/serious issues fixed; a11y checks added to CI.

**GS-071 · i18n framework + TR/EN strings · Should · 5**
As a user, I want the app fully in my language so nothing is half-translated.
- i18n library integrated; all UI strings externalized; language switcher.
- Complete TR and EN catalogs; missing-key detection in CI.

**GS-073 · High-contrast / large-text emergency mode · Could · 3**
As a stressed or low-vision user, I want a high-contrast, large-text mode so I can read quickly.
- Toggle for high-contrast + enlarged typography; preference persisted.

### Epic I — Admin Analytics & Reporting

**GS-080 · Operations KPI dashboard · Should · 5**
As a manager, I want KPIs at a glance so I can make decisions fast.
- Cards/charts: total/active depots, low-stock count, open emergencies, volunteer load, response time.
- Date-range filter; reads from existing data.

**GS-081 · Low-stock & risk threshold alerts · Should · 3**
As an operator, I want to be alerted when stock or status crosses thresholds so I act before shortages.
- Configurable thresholds per item; visual + (optional) push alert when breached.

**GS-082 · Exportable reports (CSV/PDF) · Could · 3**
As a manager, I want to export reports so I can share them outside the app.
- Export inventory/incident summaries to CSV and PDF with current filters applied.

**GS-083 · Activity timeline · Could · 3**
As an admin, I want a chronological activity view so I can review what happened during an event.
- Timeline of key events (reports, transfers, status changes) backed by GS-014 audit log.

### Epic J — Platform & Developer Experience

**GS-090 · Consolidate seed scripts · Should · 3**
As a developer, I want one canonical seeding path so onboarding isn't confusing.
- Merge overlapping `seed_*.py` scripts into one source of truth (Postgres + SQLite modes).
- Documented; legacy scripts removed or clearly deprecated.

**GS-091 · Typed API client from OpenAPI · Could · 3**
As a frontend dev, I want a generated client so API calls are type-safe and in sync.
- Generate a TS client from the FastAPI OpenAPI schema; wired into `src/services`.

**GS-092 · Config validation on boot · Should · 2**
As an operator, I want the app to fail fast on bad config so misdeploys are caught immediately.
- Validate required env (JWT secret length, DB URL, CORS) at startup with clear errors.
- Builds on existing `validate_jwt_secret`.

**GS-093 · Production Docker parity & healthchecks · Could · 3**
As a platform owner, I want prod-like containers so "works locally" means "works in prod."
- Compose profiles (dev/prod); container healthchecks; pinned base images.

**GS-094 · Documentation refresh · Should · 3**
As a new contributor, I want docs that match reality so I can ramp quickly.
- README/architecture updated to reflect all current routers/pages and the real feature set.
- One accurate "run locally" path verified end-to-end.

**GS-095 · Communication transport abstraction & unified message schema · Must · 3 (foundational)**
As an architect, I want one transport-agnostic communication model defined now so online and offline transports share the same protocol and we avoid rework when Bluetooth/LoRa arrive.
- **This is architecture-safe preparation, not a feature** — it changes no current runtime behavior and requires no redesign. Offline communication is treated as a foundational *layer*, not a future-only epic.
- Define a `CommsChannel` interface (send / subscribe / capabilities: `isAvailable`, `isOffline`, `maxPayloadBytes`, `supportsBroadcast`, `supportsMesh`) plus a thin `CommsRouter` that prefers online and falls back to the existing offline queue.
- Define a **unified message envelope** as a single source of truth → shared **TypeScript + Pydantic** types: `id`, `schemaVersion`, `type`, `priority`, `createdAt`, `expiresAt`, `sender` (opaque, no PII), `scope`, `mesh` (`originId`/`hopLimit`/`hopCount`/`seenBy`), optional coarse `geo`, `payload`, `integrity` (signature/hash), `delivery`.
- Message-type taxonomy v1: `chat`, `sos`, `presence`, `ack`, `announcement`, `beacon`.
- Schema rules: versioned + forward-compatible (unknown fields ignored); compact + chunkable for small offline MTUs (BLE ≈ 20–512 B, LoRa ≈ 200–240 B); mesh dedup by `originId + id`; no PII/health/tokens in the envelope.
- Deliverable: the interface, the shared types, the taxonomy, the versioning rules, and an `OnlineChannel` reference implementation. **No radios, no native code.**
- **Dependencies:** GS-020 (live channel) and GS-110 (chat) must implement this interface; GS-130/GS-131/GS-134/GS-138 implement additional channels against the same model. Detailed in `COMMS_RESILIENCE_ROADMAP.md` §2.

### Epic K — Smart Earthquake Notifications

> Buildable on the current PWA. Highest near-term value of the new requests.

**GS-100 · Earthquake notification preference center · Must · 5**
As a citizen, I want to choose which earthquakes notify me so I'm warned about what matters and not spammed.
- User sets thresholds: minimum magnitude, maximum distance from me (km), and depth band.
- Combinable rules (e.g., "M ≥ 4 within 100 km" OR "M ≥ 5.5 anywhere").
- Preferences stored per user; default sensible profile for new users.
- Notifications respect the rules and include magnitude, distance, depth, and time.

**GS-101 · Per-user evaluation & enrichment engine · Should · 3**
As the system, I want to evaluate each incoming quake against every user's rules so only matching users are notified.
- On each new quake (from GS-060 feed), compute distance to each subscriber's last-known/opt-in location and match rules.
- Efficient evaluation (indexed/bucketed by region); no notification if no match.
- Enriches the event with distance + human-readable severity before sending.

**GS-102 · Quiet hours & do-not-miss override · Could · 3**
As a citizen, I want quiet hours but never to miss a dangerous quake so I'm not woken for minor events yet still warned of major ones.
- Quiet-hours window suppresses low-severity notifications.
- A "critical override" threshold always breaks through (e.g., M ≥ 6 within 200 km).

**GS-103 · Early-warning provider integration spike · Could · 3 (spike)**
As a product owner, I want to know if true early warning (seconds before shaking) is feasible so we set the right expectation.
- Assess EEW providers / official APIs and the gap vs. detection-notification.
- Output: a short feasibility note + recommendation (build / partner / defer).

### Epic L — In-App Chat & Community Messaging (online)

> Online chat over the planned real-time channel (GS-020). Offline/mesh chat lives in Epic N.

**GS-110 · Online chat panel · Should · 8**
As a user, I want to message others in the app so I can coordinate during/after an event.
- Direct and group chat over the real-time channel (WebSocket/SSE).
- Message persistence + history; delivery states; basic abuse reporting.
- Works for citizen↔volunteer↔operator within permitted scopes.
- Built on the `CommsChannel` abstraction and unified envelope (GS-095); chat messages use the shared `chat` message type.

**GS-111 · Neighborhood/area channels & moderation · Could · 5**
As a resident, I want a channel for my area so local information stays local and trustworthy.
- Auto-suggested area channels by location; join/leave.
- Moderation tools (mute, report, remove) and rate limiting.

**GS-112 · Presence, read receipts & search · Could · 3**
As a user, I want presence and history search so I can see who's around and find past messages.
- Online/last-seen presence; read receipts; searchable history.

### Epic M — Battery & Low-Power Resilience

**GS-120 · Push-over-polling refactor · Should · 3**
As a user, I want the app to stop draining my battery polling so it lasts longer in an emergency.
- Replace client polling (earthquakes/announcements) with server push where available.
- Measured reduction in background network wake-ups; documented before/after.

**GS-121 · Low-power emergency mode · Should · 5**
As a citizen with a dying battery, I want a stripped-down mode so my phone survives longer.
- Toggle (manual + auto below a battery threshold): dark/OLED theme, no animations, text-only, throttled updates, dimmed map.
- Clearly indicated; one tap to restore full mode.

**GS-122 · Low-power location strategy · Should · 3**
As a user, I want location used sparingly so it doesn't drain my battery.
- Use coarse/significant-change location instead of continuous GPS for notification matching.
- Configurable accuracy; explicit consent and visible status.

**GS-123 · Energy/battery instrumentation · Could · 3**
As an engineer, I want to measure energy use so optimizations are evidence-based.
- Capture battery/Battery Status API metrics and background activity; surface in dev diagnostics.

### Epic N — Off-Grid & Resilient Communications (Research → Pilot)

> **Platform note:** none of the radio items below are possible in a browser PWA. They require a **native mobile app** (BLE, Wi-Fi Direct, SMS) and, for long range, **dedicated LoRa hardware**. Per the chosen approach, this epic is **spike-first**: prove feasibility before committing to delivery. GS-138 stays *Won't (now)* until the spikes (and GS-137) conclude.

**GS-130 · Native mobile shell spike · Should · 5 (spike)**
As a team, we want to choose a native path so radio features become possible.
- Evaluate Capacitor vs. React Native vs. Flutter for reusing existing React/PWA work.
- Build a thin shell wrapping the current app + one native capability proof; document trade-offs.

**GS-131 · BLE peer-to-peer mesh messaging spike · Should · 8 (spike)**
As a survivor, I want to text nearby people without internet so we can coordinate.
- Prototype app-level BLE mesh (text); measure realistic range, multi-hop reliability, and battery cost.
- Test through representative obstacles (concrete/partition); record findings + go/no-go.

**GS-132 · BLE rescue beacon spike · Should · 5 (spike)**
As a buried victim, I want my phone to signal rescuers so I can be located.
- Prototype periodic BLE advertisement carrying a minimal signed ID/vital token.
- Validate detection by a scanner app; measure interval vs. battery; define a duty-cycle policy (ties to GS-121).

**GS-133 · LoRa / Meshtastic interoperability spike · Could · 8 (spike)**
As a planner, I want to know if phone↔LoRa relay works so we can reach km-range off-grid.
- Pair phone (BLE) to a Meshtastic-style LoRa node; relay a text message over LoRa to a base/team.
- Document hardware BOM, range, throughput, cost, and operational model (who deploys nodes).

**GS-134 · GSM/SMS fallback (device-originated) · Should · 5**
As a citizen with no data but cellular signal, I want to send my location/SOS by SMS so help still gets the message.
- Native app composes/sends an SMS with location + vital summary to an emergency number/short code when data is unavailable.
- Distinct from GS-024 (operator→users broadcast); this is user→emergency, device-originated.

**GS-135 · Satellite SOS & cell-broadcast interop assessment · Could · 3 (spike)**
As a product owner, I want to know how to leverage satellite SOS and government cell-broadcast so we complement, not duplicate, them.
- Document device support (iPhone 14+/Android 14+, messengers) and AFAD cell-broadcast behavior.
- Recommend how GeoSafe should hand off to / coexist with these channels.

**GS-136 · Wi-Fi Direct/Aware data feasibility spike · Could · 5 (spike)**
As an engineer, I want to know if higher-bandwidth peer links are viable so richer offline data (e.g., voice/photos) is possible.
- Prototype Wi-Fi Direct/Aware transfer between two devices; measure range, throughput, battery.

**GS-137 · Resilient-comms architecture decision record · Must · 3**
As a team, we want one decision consolidating the spikes so we commit to a coherent off-grid architecture.
- ADR synthesizing GS-130–136: chosen native stack, which radios, hardware (if any), and phased delivery.
- Gates any build work in this epic.

**GS-138 · Offline mesh chat MVP · Could · 13 (Won't, this cycle)**
As a survivor, I want offline text chat that relays across nearby devices so we communicate with no infrastructure.
- Depends on GS-130/131/137 outcomes; sized as a placeholder and to be split once spikes conclude.
- Out of scope until feasibility is proven.

---

## 5. Backlog totals by priority

| Priority | Stories | Points |
|----------|--------:|------:|
| Must | 8 | 32 |
| Should | 37 | 182 |
| Could | 29 | 141 |
| **Total** | **74** | **355** |

*Must items: GS-001 (CI), GS-010 (refresh tokens), GS-012 (security headers/CORS), GS-016 (KVKK/GDPR review), GS-060 (real earthquake feed), GS-095 (transport abstraction & message schema), GS-100 (earthquake notification preferences), GS-137 (resilient-comms ADR). These are the non-negotiables for a trustworthy emergency product.*

> Note: Epic N is deliberately **spike-heavy** — most of its points buy *evidence and a decision* (GS-137), not shipped radio features. The buildable near-term value sits in Epics K, L, and M, which run on the current PWA. See `COMMS_RESILIENCE_ROADMAP.md` for the phased plan.

---

## 6. Non-functional requirements (apply to all stories)

- **Performance:** key read endpoints p95 < 300 ms under expected load; map interactive at 1,000+ markers on mid-range mobile.
- **Availability:** graceful degradation when an upstream (routing, SMS, earthquake feed) is down — never a hard crash.
- **Security & privacy:** no PII/health data/tokens in logs, caches, or QR payloads; least-privilege roles; secrets only via env.
- **Offline-first:** public citizen flows must behave sanely offline (queue or cached read).
- **Accessibility:** new UI meets WCAG 2.1 AA for critical flows.
- **Observability:** every feature is traceable via structured logs + error tracking once GS-005/006 land.

---

## 7. Definition of Ready (DoR)

A story may enter a sprint only when it has: a clear user story, testable acceptance criteria, an estimate, identified dependencies, and no open blocking questions.

## 8. Definition of Done (DoD)

- Code reviewed and merged via PR with green CI (tests + lint).
- Automated tests added/updated; meaningful coverage for the change.
- Acceptance criteria demonstrably met (demo or screenshot/test).
- No new high-severity security findings; secrets handled via env.
- Docs/CHANGELOG updated; feature flag or migration noted where relevant.

---

## 9. Technical-debt register (tracked, not all scheduled)

| Item | Risk | Related story |
|------|------|---------------|
| No CI/CD gate | Regressions reach prod | GS-001 |
| Light frontend tests | UI regressions invisible | GS-003, GS-004 |
| No error tracking | Blind to prod failures | GS-005 |
| Multiple overlapping seed scripts | Onboarding/data drift | GS-090 |
| Wildcard CORS methods/headers | Attack surface | GS-012 |
| Docs lag behind features | Slow onboarding, wrong assumptions | GS-094 |

---

*See `SPRINT_PLAN.md` for the scheduled four-sprint execution plan built from this backlog.*
