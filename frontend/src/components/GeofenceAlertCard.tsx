/**
 * GS-023: Geofenced incident alerts — citizen opt-in card.
 *
 * Lets a signed-in user enable alerts for incidents near their location. Uses the
 * low-power location hook (GS-122) for a coarse, consented position — no continuous
 * tracking — and persists the geofence (center + radius) to the backend.
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { geoSafeAPI } from "../services";
import { useLocation } from "../hooks/useLocation";

export const GeofenceAlertCard: React.FC = () => {
  const { t } = useTranslation();
  const { lat, lon, status, requestLocation } = useLocation({ lowPower: true });

  const [enabled, setEnabled] = useState(false);
  const [radius, setRadius] = useState(5);
  const [savedRadius, setSavedRadius] = useState<number | null>(null);
  const [savedEnabled, setSavedEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Load current subscription
  useEffect(() => {
    let mounted = true;
    geoSafeAPI
      .fetchGeofenceSubscription()
      .then((sub) => {
        if (!mounted) return;
        setEnabled(sub.enabled);
        setSavedEnabled(sub.enabled);
        setRadius(sub.radius_km || 5);
        setSavedRadius(sub.enabled ? sub.radius_km : null);
      })
      .catch(() => {
        /* default off */
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setMessage("");
    // Enabling requires a known location.
    if (enabled && (lat === null || lon === null)) {
      requestLocation();
      setMessage(t("geofence.noLocation"));
      return;
    }
    setSaving(true);
    try {
      const sub = await geoSafeAPI.updateGeofenceSubscription({
        enabled,
        center_lat: enabled ? lat : null,
        center_lon: enabled ? lon : null,
        radius_km: radius,
      });
      setSavedEnabled(sub.enabled);
      setSavedRadius(sub.enabled ? sub.radius_km : null);
      setMessage(t("geofence.saved"));
    } catch {
      setMessage(t("geofence.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="geofence-card" aria-label={t("geofence.title")}>
      <h3>{t("geofence.title")}</h3>
      <p className="geofence-desc">{t("geofence.description")}</p>

      <div className="geofence-row">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{" "}
          {t("geofence.enable")}
        </label>
      </div>

      {enabled && (
        <>
          <div className="geofence-row">
            <button type="button" onClick={requestLocation} className="channel-join-btn">
              {t("geofence.useMyLocation")}
            </button>
            {lat !== null && lon !== null && (
              <span aria-hidden="true">
                📍 {lat.toFixed(3)}, {lon.toFixed(3)}
              </span>
            )}
          </div>

          <div className="geofence-row">
            <label htmlFor="geofence-radius">{t("geofence.radius")}</label>
            <input
              id="geofence-radius"
              type="range"
              min={1}
              max={50}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
            <strong>{radius}</strong>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || status === "unavailable"}
        className="offline-map-btn"
      >
        {t("common.save")}
      </button>

      <p className={`geofence-status ${savedEnabled ? "" : "off"}`} role="status" aria-live="polite">
        {savedEnabled && savedRadius !== null
          ? t("geofence.enabledAt", { radius: savedRadius })
          : t("geofence.disabled")}
      </p>
      {message && <p className="offline-map-status">{message}</p>}
    </section>
  );
};

export default GeofenceAlertCard;
