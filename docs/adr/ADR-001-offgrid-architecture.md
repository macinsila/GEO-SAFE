# ADR-001 — Off-Grid Communication Architecture

**Status:** Accepted  
**Date:** 2026-05-31  
**Deciders:** GeoSafe engineering team  
**Story:** GS-137 (synthesises GS-130, GS-131, GS-132)  
**Companion docs:** `docs/FEASIBILITY_BLUETOOTH.md`, `docs/COMMS_RESILIENCE_ROADMAP.md`

---

## Context

GeoSafe's core product is a React PWA + FastAPI backend. After completing the T0 online
feature set (Sprint 1–8: SSE, Web Push, chat, low-power mode, earthquake notifications),
the question is: **can GeoSafe extend into off-grid / disaster-radio territory, and if so,
how?**

Three time-boxed spikes (Sprint 9) investigated the minimum-viable path:

| Spike | Question answered |
|-------|-------------------|
| GS-130 | Which native shell framework lets us reuse the existing React codebase? |
| GS-131 | Can we build a BLE P2P flooding mesh and what are the real constraints? |
| GS-132 | Can we broadcast a BLE rescue beacon from a phone for responder detection? |

The decision gate (GS-137) is: **which capabilities are approved for productionisation,
and which remain parked?**

---

## Spike findings summary

### GS-130 — Native shell: Capacitor vs React Native

| Criterion | Capacitor | React Native |
|-----------|-----------|-------------|
| Reuses existing React + CSS + routing | **Yes** — thin webview wrapper | No — requires rewrite |
| Time to working native shell | ~1 day (`npx cap add android`) | Weeks (new codebase) |
| Access to native BLE APIs | `@capacitor-community/bluetooth-le` v5 | `react-native-ble-plx` |
| PWA web build still deployable | **Yes** — same `build/` output | No |
| Background BLE on Android | Yes (foreground service) | Yes |
| Background BLE on iOS | Partial (overflow UUID area) | Partial (same OS constraint) |
| Maintenance overhead | One React codebase + thin native plugins | Two codebases |

**Finding:** Capacitor is the correct choice. The entire React app (routing, CSS, offline queue,
SSE, auth context) works inside the webview without modification. The native companion is an
*additive* build, not a replacement.

---

### GS-131 — BLE P2P flooding mesh

The prototype (`src/hooks/useBLEMesh.ts`) implements:
- BLE GATT scan → connect → GATT notify/write
- App-level flooding with `originId + id` deduplication (GS-095 envelope spec)
- Hop-limited relay (default `hopLimit: 3`)
- 20-byte MTU chunking and reassembly

**Constraints confirmed:**

| Constraint | Evidence |
|-----------|----------|
| Native-only | Web Bluetooth cannot advertise; iOS has no Web Bluetooth at all |
| Range | ~10–30 m open air; 2.4 GHz heavily absorbed by reinforced concrete — collapses under rubble |
| Battery cost | Continuous scan + advertise is the largest BLE battery consumer |
| iOS backgrounding | Service UUID moves to "overflow area" — cross-platform background discovery is unreliable |
| Message size | BLE default MTU 20 B; chunking works but adds round-trips and increases collision risk |
| Device density | Multi-hop mesh is only useful when many devices are within range — not guaranteed |

**Spike verdict:** The code works on Android in the foreground. The hard constraints above mean
a production mesh requires:
1. A custom Capacitor plugin for peripheral/advertising role (community plugin v5 does not expose `startAdvertising`)
2. A native foreground service for Android background operation
3. Field measurement of real-world hop reliability and battery impact before committing

Full productionised mesh (GS-138) is **not approved this cycle**. Beacon-first (GS-132) is the
right sequencing because it validates the native stack and the Capacitor plugin integration
with far lower battery cost and implementation risk.

---

### GS-132 — BLE rescue beacon

The prototype (`src/hooks/useBLEBeacon.ts`) implements:
- Duty-cycled "would-advertise" loop integrated with PowerModeContext (GS-121)
- Compact JSON payload (≤20 B): device ID, SOS flag, battery %, coarse lat/lon
- Interval: 1 s normal / 10 s low-power / 1 s when sosActive overrides

**Constraints confirmed:** same native-peripheral limitation — `@capacitor-community/bluetooth-le`
v5 does not expose `startAdvertising()`. A custom Capacitor plugin is needed for the final
advertise call; the prototype is structurally complete, the missing piece is one native method.

**Spike verdict:** BLE beacon is the **recommended first native feature** because:
- It is unidirectional (broadcast only, no mesh state) — far simpler than GS-131
- It validates the Capacitor shell, plugin integration, and native BLE permissions end-to-end
- Its value (responder can detect a buried phone near the surface) is concrete
- Duty-cycling integrates naturally with the existing low-power mode (GS-121)

---

## Decision

### 1. Native shell: adopt Capacitor

Capacitor is adopted as the hybrid native shell. The build strategy:
- `npm run build` → React static files in `frontend/build/`
- `npx cap sync` → copies build into Android/iOS native projects
- Native companion published separately to app stores; PWA web build continues unchanged

**Packages to add to `frontend/package.json` when adopting:**
```
@capacitor/core ^6
@capacitor/cli ^6
@capacitor/app ^6
@capacitor/geolocation ^6
@capacitor-community/bluetooth-le ^5
```

`frontend/capacitor.config.ts` (created in GS-130 spike) is the canonical config.

---

### 2. First native feature: BLE rescue beacon (GS-132)

The beacon is approved for productionisation with the following scope:

- Write a thin custom Capacitor plugin (`android/src/.../GeosafeBeaconPlugin.kt` + iOS equivalent) that exposes `startAdvertising(serviceUuid, data)` and `stopAdvertising()`
- Wire it into `useBLEBeacon.ts` replacing the `console.debug` stub
- Android: add foreground service so beacon survives backgrounding
- iOS: add `bluetooth-peripheral` background mode to Info.plist; document the overflow-UUID limitation for users
- UI: a "Kurtarma İşareti" toggle on the SOS panel (uses existing `sos-panel` CSS from OperationsLayout)
- Integrate with GS-121 low-power mode duty cycling (already wired in the hook)

**Not in scope for beacon productionisation:** responder scanner app (separate tooling decision).

---

### 3. BLE flooding mesh: deferred — GS-138 remains Won't this cycle

Full mesh (GS-138) requires field-validated hop reliability and battery measurements that
the spike alone cannot provide. The `useBLEMesh.ts` prototype is checked in as the reference
implementation; productionisation is gated on:

1. Beacon pilot completing and validating the native BLE advertising infrastructure
2. Field range/battery measurements on representative devices and building materials
3. A "device density" feasibility assessment for the Marmara operational zone

---

### 4. LoRa bridge (GS-133): proceed with hardware spike if beacon pilot succeeds

LoRa (Meshtastic-style external bridge) remains the strongest *long-range* off-grid option
(km range, excellent battery, text-only). It is not blocked by the browser-vs-native issue
in the same way (the Capacitor shell handles BLE pairing to the bridge). Gating condition:
beacon pilot must complete first to validate the native BLE stack before layering LoRa on top.

---

### 5. Transport abstraction (GS-095): canonical from this point

All new radio transports (`BleBeaconChannel`, future `BleChannel`, `LoraChannel`) must
implement the `CommsChannel` ABC and use the `MeshEnvelope` schema defined in `useBLEMesh.ts`.
Online transports (SSE, Web Push) already use this abstraction. No transport may bypass it.

---

## Consequences

### Positive

- Capacitor reuses 100% of existing React code; web PWA is unaffected by native work
- Beacon delivers concrete rescue value with manageable scope and a clear delivery path
- Deferring mesh prevents committing to battery-expensive always-on BLE before field data
- `MeshEnvelope` / `BeaconPayload` schema is defined now; no rework when mesh is productionised
- Low-power mode (GS-121) is already hooked into beacon duty-cycling at the architecture level

### Negative / risks

- Custom Capacitor plugin required (advertising API gap in community plugin) — adds ~1 sprint
- Two build targets (PWA + native) add CI and QA overhead; mitigated by shared React source
- iOS overflow-area limitation means beacon may not reliably wake another device from background
- Deep rubble collapses BLE range; beacon value is limited to near-surface / debris edge scenarios — must be communicated clearly in UX copy to avoid over-reliance

### Neutral

- GS-138 (offline mesh chat) remains *Won't, this cycle*; revisit after beacon pilot + field data
- GS-134 (device-originated SMS) is not blocked by this ADR; it is an independent native feature that does not depend on BLE
- GS-135/136 (satellite / Wi-Fi Direct) are unaffected

---

## Alternatives considered

### Alternative A: React Native instead of Capacitor

Discarded. Requires a full rewrite of the frontend; the existing React codebase (routing,
CSS, contexts, offline queue) would have to be re-implemented. Unjustified when Capacitor
achieves the same native access with a thin wrapper.

### Alternative B: Web Bluetooth only (no native)

Discarded. Web Bluetooth cannot advertise (central-only). iOS has no Web Bluetooth at all.
Both beacon and mesh are blocked by the specification, not by effort.

### Alternative C: Build mesh before beacon

Discarded. Mesh requires peripheral advertising (same native gap as beacon) plus scanning,
connection management, hop routing, chunking, and dedup — all in one step. Beacon-first
delivers value sooner, validates the advertising infrastructure, and gates the larger mesh
commitment on real field data.

### Alternative D: LoRa-first (skip BLE entirely)

Considered but deferred. LoRa hardware deployment has a "who maintains the nodes?" operating
model question that has not been resolved. BLE beacon requires only the phone — no external
infrastructure. LoRa remains on the roadmap for Phase 3, not Phase 2.

---

## Review schedule

This ADR should be revisited after:
1. Beacon productionisation is complete and field-tested
2. GS-133 (LoRa spike) field measurements are available
3. Any change in the `@capacitor-community/bluetooth-le` API surface (specifically: if/when `startAdvertising` is added to the community plugin, the custom native plugin may become unnecessary)
