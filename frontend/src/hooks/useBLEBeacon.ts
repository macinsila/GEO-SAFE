/**
 * GS-132: BLE rescue beacon spike (native-only prototype).
 *
 * Broadcasts a GeoSafe rescue beacon so responders can detect a survivor's phone.
 * Requires @capacitor-community/bluetooth-le — unavailable in the browser; gracefully
 * returns an error string instead of crashing the web build.
 *
 * Design constraints (from FEASIBILITY_BLUETOOTH.md §4):
 *  - Advertising requires native peripheral role; browsers cannot do this.
 *  - iOS moves service UUID to the "overflow" area when backgrounded.
 *  - Battery-aware duty cycling: normal 1 s interval → 10 s in low-power mode.
 *  - BLE write MTU ≈ 20 B default → payload must be compact (beacon flag + device ID fits).
 *
 * Integration with GS-121 low-power mode: interval doubles when lowPower is true.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePowerMode } from "../context/PowerModeContext";

export const GEOSAFE_BEACON_SERVICE_UUID = "0000a510-0000-1000-8000-00805f9b34fb";
export const GEOSAFE_BEACON_CHAR_UUID    = "0000a511-0000-1000-8000-00805f9b34fb";

const INTERVAL_NORMAL_MS    = 1_000;
const INTERVAL_LOW_POWER_MS = 10_000;
const BLE_MTU               = 20;

export interface BeaconPayload {
  /** Pseudonymous device identifier — no PII (see COMMS_RESILIENCE_ROADMAP.md §2.3) */
  deviceId: string;
  /** Coarse location, opt-in only */
  lat?: number;
  lon?: number;
  batteryPct?: number;
  sosActive: boolean;
  schemaVersion: 1;
}

export interface UseBLEBeaconResult {
  isAdvertising: boolean;
  /** Human-readable error, null when healthy */
  error: string | null;
  startBeacon: (payload: BeaconPayload) => Promise<void>;
  stopBeacon: () => Promise<void>;
}

export function useBLEBeacon(): UseBLEBeaconResult {
  const [isAdvertising, setIsAdvertising] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { lowPower } = usePowerMode();
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payloadRef = useRef<BeaconPayload | null>(null);
  const lowPowerRef = useRef(lowPower);

  useEffect(() => { lowPowerRef.current = lowPower; }, [lowPower]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const startBeacon = useCallback(async (payload: BeaconPayload) => {
    let BleClient: (typeof import("@capacitor-community/bluetooth-le"))["BleClient"];
    try {
      ({ BleClient } = await import("@capacitor-community/bluetooth-le"));
    } catch {
      setError("BLE plugin unavailable — requires native Capacitor build (GS-130)");
      return;
    }

    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      payloadRef.current = payload;
      setIsAdvertising(true);
      setError(null);

      const broadcast = async () => {
        if (!payloadRef.current) return;

        // Compact payload — truncated to MTU; full schema delivered via GATT read on connect
        const compact = {
          d: payloadRef.current.deviceId,
          s: payloadRef.current.sosActive ? 1 : 0,
          v: payloadRef.current.schemaVersion,
          ...(payloadRef.current.batteryPct !== undefined && { b: payloadRef.current.batteryPct }),
          ...(payloadRef.current.lat !== undefined && { la: Math.round(payloadRef.current.lat * 1000) / 1000 }),
          ...(payloadRef.current.lon !== undefined && { lo: Math.round(payloadRef.current.lon * 1000) / 1000 }),
        };

        const encoded = new TextEncoder().encode(JSON.stringify(compact)).slice(0, BLE_MTU);

        // NOTE: @capacitor-community/bluetooth-le does not expose a startAdvertising() API in v5.
        // In a production Capacitor plugin you would call a custom native method here, e.g.:
        //   await BleClient.startAdvertising({ serviceUuid: GEOSAFE_BEACON_SERVICE_UUID, data: encoded })
        // This stub logs the intent; replace with the actual native advertising call once the
        // custom plugin (or a future version of the community plugin) exposes it.
        console.debug("[GeoSafe beacon] would advertise", encoded);

        const interval = (payloadRef.current.sosActive || !lowPowerRef.current)
          ? INTERVAL_NORMAL_MS
          : INTERVAL_LOW_POWER_MS;

        timerRef.current = setTimeout(broadcast, interval);
      };

      await broadcast();
    } catch (err) {
      setError(String(err));
      setIsAdvertising(false);
    }
  }, []);

  const stopBeacon = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    payloadRef.current = null;
    setIsAdvertising(false);
  }, []);

  return { isAdvertising, error, startBeacon, stopBeacon };
}
