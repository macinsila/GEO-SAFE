# GeoSafe — Resilient & Off-Grid Communications Roadmap

**Status:** Research-first (spikes before commitment)
**Last updated:** 2026-05-24
**Companion docs:** `PRODUCT_BACKLOG.md` (Epics K–N + GS-095), `SPRINT_PLAN.md`, `FEASIBILITY_BLUETOOTH.md`

This roadmap covers the "communicate when networks fail" vision: smart earthquake notifications, in-app chat, battery resilience, and off-grid messaging (Bluetooth mesh, rescue beacons, LoRa, SMS, satellite). It is deliberately **phased with decision gates** — we prove feasibility before we build the expensive, risky parts.

---

## 1. The core constraint (read this first)

GeoSafe today is a **browser PWA** (React) + FastAPI. A web browser **cannot**:

- form a Bluetooth mesh, or act as a Bluetooth peripheral / advertise beacons (Web Bluetooth is central-only, foreground-only, requires a user tap, and is unsupported on iOS Safari);
- send SMS from the device;
- use Wi-Fi Direct / Wi-Fi Aware;
- talk to a LoRa radio (phones have no LoRa hardware at all).

Therefore the off-grid features split into three platform tiers:

| Tier | What it needs | Features it unlocks |
|------|---------------|---------------------|
| **T0 — PWA (today)** | Nothing new | Smart earthquake notifications, online chat, web push, battery-friendly behavior, satellite/cell-broadcast *hand-off* |
| **T1 — Native mobile app** | Capacitor / React Native / Flutter | BLE mesh text, BLE rescue beacons, device-originated SMS, Wi-Fi Direct |
| **T2 — Dedicated hardware** | LoRa nodes (Meshtastic-style) | Kilometer-range off-grid mesh, independent of phones and operators |

**Implication:** the high-value, low-risk work (T0) can start now. Everything radio-related (T1/T2) must clear a feasibility spike and an architecture decision (GS-137) first.

---

## 2. Foundational communication model — define now (architecture-safe)

**Principle: offline communication is a foundational communication *layer*, not a future feature.** Even though radio transports (BLE, LoRa) are implemented later, the **transport abstraction and the unified message schema are defined now** so that online and offline transports share one protocol model. This is architecture-safe preparation — it changes no current behavior and requires no redesign, but it prevents expensive rework when offline transports arrive. Backlog item: **GS-095 (Epic J, Must)**.

### 2.1 Transport abstraction — `CommsChannel`

All messaging flows through one transport-agnostic interface. Adding a new medium later means writing a new channel, not reworking the app.

| Channel | Transport | Tier / availability |
|---------|-----------|---------------------|
| `OnlineChannel` | SSE / WebSocket + REST, Web Push | T0 — now (GS-020, GS-021, GS-110) |
| `BleChannel` | Native BLE P2P / app-level mesh | T1 — later (GS-131, GS-138) |
| `LoraBridgeChannel` | External LoRa node via BLE/serial bridge | T1/T2 — later (GS-133) |
| `SmsChannel` | Device-originated SMS | T1 — later (GS-134) |
| `Satellite/CellBroadcast` | Hand-off only (receive/forward) | T0 hand-off (GS-135) |

A thin **`CommsRouter`** selects the best available channel (online preferred; falls back to offline) and reuses the existing offline queue for store-and-forward. Each channel advertises **capabilities** — `isAvailable`, `isOffline`, `maxPayloadBytes`, `supportsBroadcast`, `supportsMesh` — so the app degrades gracefully instead of assuming a transport.

### 2.2 Unified message envelope (shared schema)

One envelope for every transport (online and offline), defined as shared types — **TypeScript on the client, Pydantic on the backend** — from a single source of truth:

- `id` (UUID), `schemaVersion`, `type`, `priority`, `createdAt`, `expiresAt`
- `sender` — opaque pseudonymous device/user id (**no PII**); `scope` — `direct | group | area | broadcast`
- `mesh` — `originId`, `hopLimit`, `hopCount`, `seenBy[]` (enables multi-hop flooding + dedup)
- `geo` — optional **coarse** lat/lon (opt-in only)
- `payload` — typed by `type`
- `integrity` — `signature`/`hash` so relayed messages are tamper-evident (offline trust)
- `delivery` — `status`, `transportUsed`, `ackRequested`

**Message types (v1):** `chat`, `sos`, `presence`, `ack`, `announcement`, `beacon`. Each must serialize over both online and offline transports.

### 2.3 Rules that the schema must respect from day one

- **Compact + chunkable.** Offline MTUs are tiny (BLE write ≈ 20–512 B after negotiation; LoRa ≈ 200–240 B/frame). The envelope must stay small and support chunked payloads — designing this in now is the whole point of GS-095.
- **Versioned + forward-compatible.** `schemaVersion` present from v1; additive changes only without a major bump; unknown fields ignored.
- **Dedup for mesh.** `originId + id` identifies a message across hops to stop flooding loops.
- **Privacy by construction.** No PII, no health data, no tokens in the envelope — it may travel over untrusted relays.

### 2.4 What GS-095 delivers now (no radios, no native code)

Define the `CommsChannel` interface, the message envelope as shared TS + Pydantic types, the type taxonomy, and the versioning rules — plus an `OnlineChannel` reference implementation. The planned online features (GS-020 live channel, GS-110 chat) implement this interface; the later offline transports (GS-130/131/134/138) plug into the **same** model. Nothing in the current web sprint plan changes.

---

## 3. Feasibility matrix (honest assessment)

| Capability | Feasible? | Tier | Realistic limits |
|-----------|-----------|------|------------------|
| Earthquake notifications filtered by magnitude / distance / depth | **Yes** | T0 | Needs user location (coarse OK). Notification ≠ early warning. |
| Online chat panel (with internet) | **Yes** | T0 | Standard WebSocket chat. |
| Battery optimization (app-side) | **Yes (partial)** | T0/T1 | App can be efficient; true battery life is the OS's job. Native gives more control. |
| Web/SMS push alerts | **Yes** | T0/T1 | iOS web push needs installed PWA (16.4+). |
| Operator → users SMS broadcast | **Yes** | T0 (server) | Needs the server reachable; not an *offline* path for the user. |
| User → emergency **device-originated SMS** when data is down | **Yes** | **T1** | Needs cellular signal; native only. |
| Bluetooth **text** to nearby people | **Yes (limited)** | **T1** | ~10–30 m open air; far less through concrete/rubble. Text, not voice. |
| Bluetooth **multi-hop chain/mesh** | **Yes (limited)** | **T1** | Each hop short; reliability/latency degrade per hop; battery-hungry; needs device density. |
| Bluetooth **rescue beacon** to responders | **Yes** | **T1** | Helps locate phones near the surface; range collapses under deep rubble. |
| **Voice** under rubble via Bluetooth | **No (practically)** | — | BLE lacks bandwidth; 2.4 GHz heavily attenuated by concrete/rebar/bodies. |
| **LoRa** long-range off-grid (km) | **Yes** | **T2** | Phones have no LoRa; needs Meshtastic-style nodes. Low bitrate (text). Excellent battery. |
| **Satellite SOS** | **Yes (device-dependent)** | T0 hand-off | iPhone 14+/some Android 14; needs clear sky → useless under rubble, valuable above ground. |
| **Cell broadcast** (gov emergency alerts) | **Receive-only** | T0 | Operator/government controlled (AFAD). We coexist, not control. |
| Communicate with **internet AND operators both down** | **Yes, only via T1/T2** | T1/T2 | Short-range phone mesh (T1) or LoRa/satellite (T2). No software-only solution. |

### Physics reality check (under-rubble)
2.4 GHz (Bluetooth/Wi-Fi) is strongly absorbed by reinforced concrete, moisture, and bodies. Lower frequencies (LoRa at 433/868/915 MHz) penetrate better but are still limited. No consumer technology reliably carries **voice through meters of rubble**. What is realistic: **short-range text mesh** among survivors who are close or near openings, and **beacons** that help rescuers find buried phones near the surface.

### The battery tension
Continuous BLE advertising/scanning for mesh/beacons **drains battery** — directly opposing the battery-life goal. Resolution: mesh/beacon behavior is **opt-in, event-triggered, and duty-cycled**, with beacon intervals that lengthen as battery drops (coordinated with low-power mode, GS-121).

---

## 4. Phased plan with decision gates

### Phase 0 — Build the safe, high-value T0 features (now; runs on current PWA)
**Backlog:** GS-100, GS-101, GS-120, GS-121, GS-122, GS-110 (and supporting GS-060 real feed, GS-021 push from the base backlog).
- Smart earthquake notification preference center (magnitude/distance/depth).
- Per-user evaluation engine over the real earthquake feed.
- Battery: push-over-polling, low-power emergency mode, low-power location.
- Online chat panel.
**Exit:** users receive *filtered* quake alerts and can chat online; measured battery improvement. No platform change required.

### Phase 1 — Decide the native path (spikes; small, time-boxed)
**Backlog:** GS-130 (native shell), GS-103 (early-warning), GS-135 (satellite/cell-broadcast), GS-092-style config hygiene as needed.
- Evaluate Capacitor vs. React Native vs. Flutter for reusing the existing React app.
- Stand up a thin native shell wrapping the current app + one native proof.
- Assess satellite SOS / cell-broadcast hand-off (no build, just integration design).
**Gate G1:** Do we adopt a native app? If no → stop at T0; off-grid radio features are parked. If yes → proceed.

### Phase 2 — Prove the radios (spikes; the risky core)
**Backlog:** GS-131 (BLE mesh), GS-132 (BLE beacon), GS-136 (Wi-Fi Direct), GS-134 (device SMS — buildable, not just spike), GS-133 (LoRa/Meshtastic).
- Measure **real** range, multi-hop reliability, and battery cost through representative obstacles.
- LoRa: pair phone↔node, relay a message; capture hardware BOM, range, cost, and "who deploys nodes" operating model.
**Gate G2 → GS-137 (Architecture Decision Record):** consolidate all spike results into one decision: chosen native stack, which radios, whether LoRa hardware is in scope, and a phased delivery plan. **No off-grid build work starts before this ADR.**

### Phase 3 — Pilot the chosen architecture (build; only what G2 approved)
**Backlog:** GS-138 (offline mesh chat MVP — currently *Won't, this cycle*), plus beacon/SMS productionization, and (if approved) a LoRa node pilot.
- Field-test with a small device population; validate against real failure scenarios.
- Define operations: node deployment, maintenance, responder tooling/scanners.
**Exit:** a validated, documented off-grid capability with a clear cost and operating model — or a documented decision not to pursue T2.

---

## 5. Mapping your questions to this plan

| Your question | Answer | Where it lives |
|---------------|--------|----------------|
| Battery optimization for longer life | Yes (app-side); native gives more control | GS-120/121/122/123 (Phase 0) |
| Notify on quakes; filter by magnitude/distance/depth | Yes, buildable now | GS-100/101/102 (Phase 0) |
| Chat panel for users | Yes (online) | GS-110/111/112 (Phase 0) |
| GSM-fallback SMS to nearest aid / emergency teams | Yes, but native + device-originated | GS-134 (Phase 2); GS-024 for operator broadcast |
| Talk/message under rubble via Bluetooth | Text: limited (native mesh). Voice: no | GS-131 spike (Phase 2) |
| Periodic Bluetooth signals to rescue teams, LoRa-compatible | Beacon: native. LoRa: needs hardware | GS-132 + GS-133 spikes (Phase 2) |
| Bluetooth chain so rubble survivors relay to each other | Yes, limited multi-hop mesh, native | GS-131 → GS-138 (Phase 2→3) |
| Communicate if internet and operators both fail | Only via short-range phone mesh (T1) or LoRa/satellite (T2) | Epic N + GS-135 |

---

## 6. Recommendation

1. **Start Phase 0 immediately** — smart notifications, chat, and battery work are high-value and run on what you already have. These are also the most demo-able.
2. **Run Phases 1–2 as cheap, time-boxed spikes** in parallel with Phase 0 — they buy knowledge, not commitment.
3. **Treat GS-137 (the ADR) as the real decision point.** Only after the spikes do you commit to native and/or LoRa, with eyes open about cost, battery, range, and who deploys/maintains hardware.
4. **Set expectations honestly:** off-grid voice through rubble is not realistic; short-range text mesh and rescue beacons are; kilometer-range off-grid means hardware (Meshtastic/LoRa) or satellite.

---

*All story IDs (GS-1xx) are defined in `PRODUCT_BACKLOG.md` Epics K–N; the foundational transport/schema story is GS-095 (Epic J). Browser-vs-native detail lives in `FEASIBILITY_BLUETOOTH.md`.*
