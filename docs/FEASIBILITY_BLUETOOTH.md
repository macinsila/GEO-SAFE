# GeoSafe — Bluetooth / Offline Communication Feasibility

**Scope:** Can offline/disaster communication features (Bluetooth P2P, mesh, SOS broadcast, phone-to-phone, optional LoRa bridge) be added to the **current** GeoSafe architecture (React PWA + FastAPI) **without a redesign**?
**Status:** Research / decision-support. No redesign proposed here.
**Last updated:** 2026-05-24
**Companion docs:** `COMMS_RESILIENCE_ROADMAP.md` (§2 transport model), `PRODUCT_BACKLOG.md` (GS-095, GS-130–138), `SPRINT_PLAN.md`

---

## 1. Summary verdict

Of the five target features, **only the LoRa-bridge feature is partially doable in the PWA, and only on Android**. The four phone-to-phone features (device-to-device messaging, multi-hop mesh, SOS broadcast, offline P2P) are **not possible in any browser** — blocked by the Web Bluetooth specification itself, not by effort. Unlocking them requires a **native layer**, but **not** a redesign: a Capacitor hybrid shell reuses the existing React code, and the foundational communication model (transport abstraction + unified message schema, **GS-095**) is defined now so this remains additive.

| Target feature | In current PWA? | Native required? |
|---|---|---|
| Bluetooth device-to-device messaging | No | Yes |
| Simple Bluetooth mesh (multi-hop) | No | Yes |
| Offline SOS broadcast (advertise + detect) | No | Yes |
| Phone-to-phone messaging, internet down | No | Yes |
| Optional LoRa via external HW bridge | Partial — Android Chrome only | Preferred, not strictly |

---

## 2. Browser (PWA) limitations

The Web Bluetooth API is fundamentally limited for peer-to-peer use:

- **Central role only.** A browser can connect *to* a BLE peripheral; it **cannot advertise** as a peripheral. Two browsers can therefore never discover or talk to each other — this single fact kills device-to-device, mesh, SOS broadcast, and offline P2P in the browser.
- **No iOS support at all.** Every iOS browser uses WebKit, which has **no Web Bluetooth**. An iPhone PWA cannot do any Bluetooth. For a disaster app with significant iPhone usage, this alone disqualifies a browser-only approach.
- **Foreground-only.** Web Bluetooth stops when the tab is backgrounded or the screen locks; service workers have no Bluetooth access. Disaster comms must run in the background — browsers can't.
- **Manual pairing each time.** Every connection needs an explicit user gesture and chooser dialog; no silent auto-connect or auto-reconnect.
- **No peer scanning.** Scanning for advertisements (`requestLEScan`) is experimental/flagged and unavailable in practice.

**Conclusion:** the browser can act only as a central connecting to a *dedicated peripheral device* (e.g., a LoRa bridge), foreground, Android-only. Everything peer-to-peer is out.

---

## 3. Native requirements

Native platforms (iOS Core Bluetooth, Android BLE; and higher-level P2P: Apple Multipeer Connectivity, Android Nearby Connections / Wi-Fi Direct/Aware) are the **only** way to do peer-to-peer. Native can:

- act as both BLE **central and peripheral** (advertise) — required for device discovery and SOS beacons;
- **scan and relay in the background** via a foreground service — required for mesh and always-listening SOS;
- form an app-level flooding **mesh** (the Bridgefy/Briar pattern) or use the BLE Mesh profile;
- send **device-originated SMS** (GS-134) and use **Wi-Fi Direct/Aware** for higher-bandwidth transfers.

Features requiring native: **device-to-device messaging, multi-hop mesh, SOS broadcast, phone-to-phone offline messaging** (GS-131, GS-138, GS-132, GS-134).

---

## 4. BLE constraints (apply even on native)

Even with native, Bluetooth Low Energy has hard physical and platform limits that the design must respect:

- **Range:** ~10–30 m line of sight; far less through reinforced concrete, moisture, and bodies. Under deep rubble, useful range collapses to a few meters.
- **No voice:** BLE bandwidth suits **text/beacons**, not voice. Voice needs Wi-Fi Direct/Aware.
- **Mesh degradation:** each hop adds latency and loss; reliability needs **device density**; flooding requires **dedup** (`originId + id`).
- **Battery vs. always-on:** continuous advertising/scanning drains battery — directly opposing the battery-life goal. Mitigation: opt-in, event-triggered, **duty-cycled** beacons whose interval lengthens as battery drops (ties to low-power mode GS-121).
- **Tiny payloads:** BLE write ≈ 20 B default, up to ~512 B after MTU negotiation. Messages must be **compact and chunkable** — the reason the envelope schema (GS-095) is defined up front.
- **iOS background advertising caveats:** iOS moves the service UUID to an "overflow" area when backgrounded, reliably detectable mainly by other foregrounded iOS devices scanning for that UUID — cross-platform background discovery is unreliable.

---

## 5. LoRa bridge feasibility (kept deliberately narrow)

Phones have **no LoRa radio**, so LoRa always means an **external hardware bridge** (e.g., a Meshtastic-style ESP32+LoRa node) that the phone talks to over BLE/serial.

- **PWA path (Android only):** an Android-Chrome PWA can connect as a BLE central to the bridge and exchange messages — foreground-only, manual pairing, no iOS. Useful as a **cheap learning spike** (GS-133), not a shippable capability.
- **Native path:** stable pairing, background operation, the proper home for LoRa-bridge in production.
- **Scope guard:** this document does **not** propose a full LoRa ecosystem. LoRa stays "optional, via external bridge," gated behind the architecture decision (GS-137) and a who-deploys-the-nodes operating-model question.

LoRa's value: kilometer-range, very low power, text-only — the strongest *long-range* off-grid option, but a hardware program, not software.

---

## 6. Recommended incremental path — hybrid (web + native companion)

**Recommendation: hybrid.** Keep web-first as the default product (zero-install reach matters: citizens won't install an app mid-disaster), and add a **native companion app** for the offline radio features, built with **Capacitor** so it reuses the existing React codebase.

Why not the alternatives:
- *Web-only* — cannot deliver four of the five features at all.
- *Full native rewrite* — discards a working PWA for still-unproven capabilities; unjustified now.

Minimum architectural change (two tiers, neither a redesign):
- **Tier A (PWA-only spike):** isolated Web Bluetooth client module, Android-only, foreground, to learn the LoRa bridge (GS-133). No backend change.
- **Tier B (unlocks P2P):** wrap the existing React app in **Capacitor** + a **native BLE plugin**, shipped as a separate companion build. Everything routes through the `CommsChannel` abstraction and unified envelope (**GS-095**), so online (SSE/WebSocket) and offline (BLE/LoRa) share one protocol. Backend unchanged except an eventual offline-message sync endpoint reusing the existing queue.

Sequence (gated, reversible): current web sprints continue → define GS-095 (now, architecture-safe) → Tier-A LoRa-bridge spike → Capacitor companion shell spike (GS-130) → native BLE P2P + SOS beacon (GS-131/132) → evaluate mesh → GS-137 go/no-go decision → pilot only what's approved (GS-138).

---

## 7. Risks & tradeoffs

| Risk / tradeoff | Impact | Mitigation |
|---|---|---|
| iOS has no Web Bluetooth | Browser BLE excludes all iPhones | Use native companion (Capacitor) for any BLE feature |
| Background execution limits (OS) | Mesh/SOS may pause when app backgrounded | Native foreground service; set user expectations |
| BLE range under rubble | Off-grid reach is short | Position as short-range text mesh + locator beacons, not a cure-all; pair with LoRa for distance |
| Battery drain from advertising/scanning | Contradicts battery-life goal | Opt-in, event-triggered, duty-cycled radios (GS-121) |
| Voice expectation | Not achievable over BLE | Communicate text-only clearly; voice would need Wi-Fi Direct |
| Maintaining two builds (PWA + companion) | Added engineering/QA cost | Capacitor shares one React codebase; companion is thin |
| LoRa hardware logistics | Cost + "who deploys nodes" | Keep optional, decide at GS-137; pilot before scale |
| Schema rework if defined late | Expensive refactor across transports | **Define GS-095 now** (this is the whole point) |
| Tampered relayed messages | Trust in offline mesh | Signed/hashed envelope (`integrity` field in GS-095) |
| Privacy of relayed data | Messages cross untrusted relays | No PII/health/tokens in the envelope by construction |

---

## 8. Decisions locked by this analysis

1. Offline communication is a **foundational layer**; the transport abstraction + unified message schema (**GS-095**) are defined **now**, before any radio work.
2. Phone-to-phone features are **native-only**; the chosen native path is a **Capacitor companion** reusing the React app — **no redesign**.
3. LoRa stays **optional, external-bridge only**, gated behind **GS-137**.
4. The **current web sprint plan is unchanged**; all of the above proceeds as an isolated, gated research/experimental track.

---

*Story IDs referenced: GS-095 (foundational model), GS-130 (native shell), GS-131 (BLE mesh), GS-132 (SOS beacon), GS-133 (LoRa bridge), GS-134 (device SMS), GS-137 (architecture decision), GS-138 (offline mesh chat MVP). All defined in `PRODUCT_BACKLOG.md`.*
