# GeoSafe — Sprint Plan (4 × 2 weeks)

**Product:** GeoSafe — Neighborhood-scale Smart Disaster Logistics & Decision Support System
**Cycle:** 4 sprints × 2 weeks = ~8 weeks
**Last updated:** 2026-05-24
**Companion doc:** `PRODUCT_BACKLOG.md` (story definitions, acceptance criteria, estimates)

---

## 1. Planning assumptions

- **Team:** small (≈3 developers, part-time). Roles flex across backend/frontend.
- **Velocity:** target **~21 story points per sprint** (conservative for a part-time team; re-baseline after Sprint 1's actuals).
- **Cadence:** 2-week sprints. Sprint planning Monday (day 1), review + retro Friday (day 10).
- **Theme arc:** *Foundation → Real-time safety → Guidance & coordination → Reach & hardening.* Each sprint mixes **new features** with **hardening** (the requested balanced focus).
- **Total committed:** 84 of 253 backlog points across 4 sprints (~33%). The rest stays in the backlog for future cycles.

---

## 2. Sprint summary

| Sprint | Theme | Points | Headline outcome |
|--------|-------|------:|------------------|
| **1** | Foundation & Trust | 21 | Quality gates live; security baseline; real earthquake data |
| **2** | Real-Time Safety | 21 | Live alerts + secure sessions + "I'm safe" check-in |
| **3** | Guidance & Coordination | 21 | Real routing + supply transfer/needs + stock alerts |
| **4** | Reach & Hardening | 21 | Push alerts + i18n + fast map + reports |
| | **Total** | **84** | |

---

## 3. Sprint 1 — Foundation & Trust (21 pts)

**Sprint goal:** Stand up the engineering safety net (CI, linting, config validation) and close the highest-trust gaps (security headers, lawful data handling, real earthquake data) so every later sprint ships on solid ground.

| ID | Story | Pri | Pts |
|----|-------|-----|----:|
| GS-001 | CI pipeline (tests + lint + build) | Must | 5 |
| GS-002 | Pre-commit hooks & linters | Should | 3 |
| GS-012 | Security headers, HTTPS & CORS tightening | Must | 3 |
| GS-060 | Real earthquake feed with caching | Must | 5 |
| GS-092 | Config validation on boot | Should | 2 |
| GS-016 | KVKK/GDPR review of health & QR data | Must | 3 |
| | **Total** | | **21** |

**Why these first:** CI (GS-001) is a hard dependency for trustworthy delivery in every later sprint; GS-002/GS-092 ride alongside it cheaply. The Must security/compliance items (GS-012, GS-016) and real data (GS-060) remove the biggest credibility risks for an emergency product.

**Dependencies:** GS-002 and GS-092 land into the GS-001 pipeline. No external blockers.

**Sprint demo:** PR shows green CI; a misconfigured env fails fast with a clear message; map displays live earthquakes; security-header scan passes.

**Risks:** earthquake upstream (AFAD/Kandilli) rate limits or schema quirks → mitigate with caching + a stubbed fixture for tests.

---

## 4. Sprint 2 — Real-Time Safety (21 pts)

**Sprint goal:** Turn GeoSafe from request/response into a live safety tool: secure long-lived sessions, instant announcements, and a citizen "I'm safe" check-in — all observable via error tracking.

| ID | Story | Pri | Pts |
|----|-------|-----|----:|
| GS-010 | Refresh tokens & session lifecycle | Must | 5 |
| GS-020 | Live announcement channel (SSE/WebSocket) | Should | 8 |
| GS-040 | "I'm safe" check-in | Should | 5 |
| GS-005 | Error tracking (Sentry) | Should | 3 |
| | **Total** | | **21** |

**Why now:** Real-time + check-in are the product's biggest user-facing value jump, and they're only safe to ship once CI (S1) and error tracking (GS-005) exist to catch regressions. GS-010 hardens auth before sessions carry more weight.

**Dependencies:** GS-005 benefits from GS-006 structured logging (backlog) but does not require it. GS-040 reuses the existing offline queue.

**Sprint demo:** announcement posted by an operator appears instantly on a citizen device; a session survives access-token expiry via refresh; a citizen marks "Safe" online and offline; a forced error appears in Sentry with request context.

**Risks:** SSE/WebSocket behaviour behind Render/Vercel proxies → validate transport early (spike on day 1–2); fall back to polling.

---

## 5. Sprint 3 — Guidance & Coordination (21 pts)

**Sprint goal:** Make the map actionable for citizens (real directions) and for operators (move supplies where they're needed, get warned before shortages).

| ID | Story | Pri | Pts |
|----|-------|-----|----:|
| GS-030 | Turn-by-turn routing to depot/safe zone | Should | 8 |
| GS-052 | Inter-warehouse transfer requests | Should | 5 |
| GS-053 | Safe-zone needs intake | Should | 5 |
| GS-081 | Low-stock & risk threshold alerts | Should | 3 |
| | **Total** | | **21** |

**Why now:** Routing upgrades the existing straight-line `RouteLayer` into real guidance. Transfers + needs intake + threshold alerts form one coherent logistics loop (demand → movement → warning) on top of the existing inventory/movement models.

**Dependencies:** GS-081 can push alerts via GS-020 (S2) if available, else in-app only. GS-052/GS-053 reuse `inventory_movement`.

**Sprint demo:** citizen searches and gets a real walking route + ETA; safe-zone lead requests supplies; operator approves a transfer and inventory updates; a low-stock threshold breach raises an alert.

**Risks:** routing engine choice (self-hosted OSRM vs hosted API) affects cost/latency → decide in sprint planning; ship with graceful straight-line fallback (already specified in GS-030).

---

## 6. Sprint 4 — Reach & Hardening (21 pts)

**Sprint goal:** Extend reach (push alerts, multilingual UI) and make the experience fast and shareable for a wider audience and larger events.

| ID | Story | Pri | Pts |
|----|-------|-----|----:|
| GS-021 | Web Push emergency alerts | Should | 8 |
| GS-071 | i18n framework + TR/EN strings | Should | 5 |
| GS-062 | Marker clustering & viewport loading | Should | 5 |
| GS-082 | Exportable reports (CSV/PDF) | Could | 3 |
| | **Total** | | **21** |

**Why now:** Push (GS-021) completes the alerting story started in S2 and depends on the PWA + live channel being stable. i18n and clustering broaden reach and scale; reports give managers takeaways. These are lower-coupling items, suitable for the end of the cycle.

**Dependencies:** GS-021 builds on the existing PWA service worker and the S2 real-time work. GS-062 is independent.

**Sprint demo:** device receives a push alert with the app closed; UI switches TR↔EN with no missing strings; map stays smooth with 1,000+ markers; manager exports an inventory report to PDF/CSV.

**Risks:** iOS Web Push constraints → document supported platforms and degrade to in-app + SMS (GS-024, future) where push is unavailable.

---

## 7. Capacity & burn-up

| Sprint | Committed | Cumulative | % of total backlog (253) |
|--------|----------:|-----------:|-----------------------:|
| 1 | 21 | 21 | 8% |
| 2 | 21 | 42 | 17% |
| 3 | 21 | 63 | 25% |
| 4 | 21 | 84 | 33% |

Re-baseline velocity after Sprint 1: if actual velocity differs by >20%, re-scope Sprints 2–4 (drop the lowest-priority story first — GS-082 in S4, then GS-081 in S3).

---

## 8. Cross-sprint dependency map

- **GS-001 (CI)** → enables trustworthy delivery of *every* later story.
- **GS-005 (Sentry)** → should land before/with the first real-time feature (GS-020).
- **GS-020 (live channel)** → transport reused by GS-021 (push), GS-022 (live inventory), GS-081 (alerts).
- **GS-010 (refresh tokens)** → precedes broader role/session work (GS-013, backlog).
- **PWA service worker (existing)** + **GS-020** → prerequisites for GS-021 (push).

---

## 9. Ceremonies & working agreements

- **Planning** (≈1.5 h, day 1): confirm sprint goal, pull stories meeting Definition of Ready, assign owners.
- **Daily async standup:** yesterday / today / blockers.
- **Mid-sprint check (day 5):** scope health; cut the lowest-priority story early if at risk rather than carrying debt.
- **Review (day 10):** demo against acceptance criteria.
- **Retro (day 10):** keep / drop / try.
- **Definition of Ready / Done:** as defined in `PRODUCT_BACKLOG.md` §7–8. Nothing is "done" without green CI and tests.

---

## 10. What's intentionally NOT in this cycle (Won't, this cycle)

Parked for a future cycle, with rationale:

- **GS-041 Missing-persons board, GS-054 Donation matching** — high value but large; need moderation/privacy design first.
- **GS-023 Geofenced alerts, GS-024 SMS fallback** — depend on stable push (GS-021) and a cost model.
- **GS-033 Offline base-map, GS-064 Redis cache, GS-070 WCAG audit, GS-072 Arabic RTL** — strong candidates for the *next* cycle once the foundation and real-time core are proven.

These remain in `PRODUCT_BACKLOG.md` and should be reconsidered at the next cycle's planning.

---

## 11. Related documents & foundational notes

- `PRODUCT_BACKLOG.md` — full story definitions (Epics A–N + GS-095).
- `COMMS_RESILIENCE_ROADMAP.md` — phased, spike-first plan for smart notifications, chat, battery, and off-grid communications (Epics K–N); **§2 defines the foundational communication model** (transport abstraction + unified message schema).
- `FEASIBILITY_BLUETOOTH.md` — browser-vs-native feasibility for Bluetooth/offline communication.

**Foundational note — GS-095 (transport abstraction & unified message schema).** Offline communication is treated as a foundational *layer*, so the transport abstraction and unified message schema are defined now (roadmap §2). GS-095 is a small (3-pt), architecture-safe design task — no radios, no native code, no runtime change. To honor "keep the current sprint plan unchanged," the four committed sprints above are **not** modified in this revision, which is why this Must-priority item is intentionally not yet placed in a sprint. GS-095 is a **prerequisite for GS-020 (live channel) and GS-110 (chat)** and should be scheduled immediately before whichever sprint first picks up real-time/chat work. Recommendation for the next planning session: slot GS-095 at the start of that sprint — it fits within the ~21-pt velocity by deferring one Could-priority item.

The off-grid radio features (Epics K–N beyond GS-095) remain **not** scheduled into these four sprints; they follow the research-first roadmap and feed a future cycle once the architecture decision (GS-137) is made.
