/**
 * GS-122 — Low-power location strategy.
 *
 * Wraps the Geolocation API with:
 * - Coarse positioning (enableHighAccuracy: false) by default to minimise battery drain.
 * - Low-power mode integration: in PowerModeContext.lowPower mode a single one-shot
 *   reading is taken and the watch is not started.
 * - Explicit consent lifecycle tracked in localStorage so the permission prompt is only
 *   shown once per session unless explicitly reset.
 * - A 5-minute polling interval in normal mode (approximates significant-change behaviour
 *   without requiring a native API).
 */

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "geosafe-location-consent";
const NORMAL_POLL_MS = 5 * 60 * 1000; // 5 min

export type LocationConsent = "pending" | "granted" | "denied" | "unavailable";

export interface LocationState {
  lat: number | null;
  lon: number | null;
  accuracy: number | null;
  status: LocationConsent;
  error: string | null;
}

export interface UseLocationOptions {
  lowPower?: boolean;
  autoStart?: boolean;
}

export interface UseLocationReturn extends LocationState {
  requestLocation: () => void;
  clearLocation: () => void;
  resetConsent: () => void;
}

function readConsent(): LocationConsent {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "granted" || stored === "denied") return stored;
  return "pending";
}

function writeConsent(c: LocationConsent) {
  localStorage.setItem(STORAGE_KEY, c);
}

export function useLocation(options: UseLocationOptions = {}): UseLocationReturn {
  const { lowPower = false, autoStart = false } = options;

  const [state, setState] = useState<LocationState>({
    lat: null,
    lon: null,
    accuracy: null,
    status: navigator.geolocation ? readConsent() : "unavailable",
    error: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const applyPosition = useCallback((pos: GeolocationPosition) => {
    if (!mountedRef.current) return;
    writeConsent("granted");
    setState({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      status: "granted",
      error: null,
    });
  }, []);

  const applyError = useCallback((err: GeolocationPositionError) => {
    if (!mountedRef.current) return;
    const denied = err.code === err.PERMISSION_DENIED;
    const consent: LocationConsent = denied ? "denied" : "granted";
    writeConsent(consent);
    setState((prev) => ({
      ...prev,
      status: consent,
      error: denied ? "Konum erişimi reddedildi." : "Konum alınamadı.",
    }));
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    const opts: PositionOptions = {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: lowPower ? 300000 : 60000, // 5 min cache in low-power, 1 min normal
    };

    navigator.geolocation.getCurrentPosition(applyPosition, applyError, opts);

    if (!lowPower) {
      clearTimer();
      timerRef.current = setTimeout(() => {
        requestLocation();
      }, NORMAL_POLL_MS);
    }
  }, [lowPower, applyPosition, applyError, clearTimer]);

  const clearLocation = useCallback(() => {
    clearTimer();
    setState((prev) => ({ ...prev, lat: null, lon: null, accuracy: null, error: null }));
  }, [clearTimer]);

  const resetConsent = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState((prev) => ({ ...prev, status: "pending", error: null }));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (autoStart && state.status !== "denied" && state.status !== "unavailable") {
      requestLocation();
    }
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ...state, requestLocation, clearLocation, resetConsent };
}
