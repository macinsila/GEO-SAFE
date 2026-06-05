/**
 * GS-033: Offline base-map control.
 *
 * Lets the user pre-cache the current map viewport for offline use. Reads the
 * live Leaflet bounds + zoom, plans a tile set across a small zoom band, and
 * streams the download through the service worker with a progress bar. Also
 * surfaces the current cache size and a clear action (storage budget hygiene).
 */

import React, { useCallback, useEffect, useState } from "react";
import type L from "leaflet";
import { useTranslation } from "react-i18next";
import {
  clearTileCache,
  estimateTileCount,
  getTileCacheInfo,
  precacheArea,
  type LatLngBounds,
  type TileCacheInfo,
} from "../offline/tileCache";

interface Props {
  map: L.Map | null;
}

// Cache the current zoom plus a couple of levels in for turn-by-turn detail,
// without exploding the tile count.
const ZOOM_BELOW = 1;
const ZOOM_ABOVE = 2;
const MAX_SAFE_TILES = 2000;

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${mb.toFixed(1)} MB`;
}

export const OfflineMapControl: React.FC<Props> = ({ map }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("");
  const [info, setInfo] = useState<TileCacheInfo | null>(null);

  const refreshInfo = useCallback(() => {
    getTileCacheInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  useEffect(() => {
    refreshInfo();
  }, [refreshInfo]);

  const currentBounds = (): { bounds: LatLngBounds; minZoom: number; maxZoom: number } | null => {
    if (!map) return null;
    const b = map.getBounds();
    const z = map.getZoom();
    return {
      bounds: {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      },
      minZoom: Math.max(1, z - ZOOM_BELOW),
      maxZoom: Math.min(19, z + ZOOM_ABOVE),
    };
  };

  const handleDownload = async () => {
    const area = currentBounds();
    if (!area) return;

    const planned = estimateTileCount(area.bounds, area.minZoom, area.maxZoom);
    if (planned > MAX_SAFE_TILES) {
      setStatus(t("offline.tooManyTiles"));
      return;
    }

    setBusy(true);
    setProgress(0);
    setStatus(t("offline.estimate", { count: planned }));
    try {
      const result = await precacheArea(
        area.bounds,
        area.minZoom,
        area.maxZoom,
        (p) => setProgress(Math.round((p.done / Math.max(1, p.total)) * 100))
      );
      setStatus(t("offline.downloaded", { cached: result.cached }));
      refreshInfo();
    } catch (err) {
      setStatus(t("offline.swUnavailable"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      await clearTileCache();
      setStatus(t("offline.cleared"));
      refreshInfo();
    } catch {
      setStatus(t("offline.swUnavailable"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="offline-map-control">
      <strong className="offline-map-title">{t("offline.title")}</strong>

      <button
        type="button"
        onClick={handleDownload}
        disabled={busy || !map}
        className="offline-map-btn"
      >
        {busy && progress !== null ? `${t("offline.downloading")} ${progress}%` : t("offline.downloadArea")}
      </button>

      {progress !== null && (
        <div className="offline-progress" aria-hidden="true">
          <div className="offline-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      )}

      {info && (
        <p className="offline-map-info">
          {t("offline.cachedTiles", { count: info.count, max: info.max })}
          <br />
          {t("offline.cacheSize", { size: formatBytes(info.estimateBytes) })}
        </p>
      )}

      {info && info.count > 0 && (
        <button type="button" onClick={handleClear} disabled={busy} className="offline-map-clear">
          {t("offline.clearCache")}
        </button>
      )}

      {status && (
        <p className="offline-map-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
};

export default OfflineMapControl;
