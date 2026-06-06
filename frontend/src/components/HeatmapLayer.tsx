/**
 * GS-063 — Demand/incident heatmap layer.
 * Uses leaflet.heat via @react-leaflet/core context so it integrates correctly
 * with LayersControl: the heat layer is added to the parent LayerGroup rather
 * than directly to the map, which ensures it is removed when the overlay is
 * unchecked.
 */
import { useEffect, useRef } from "react";
import { useLeafletContext } from "@react-leaflet/core";
import L from "leaflet";
import "leaflet.heat";
import { geoSafeAPI } from "../services";

const HEAT_OPTIONS: L.HeatLayerOptions = {
  radius: 30,
  blur: 20,
  maxZoom: 17,
  max: 1.0,
  gradient: { 0.3: "#3b82f6", 0.6: "#f59e0b", 1.0: "#ef4444" },
};

export function HeatmapLayer() {
  const context = useLeafletContext();
  const layerRef = useRef<L.HeatLayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = context?.layerContainer ?? context?.map;
    if (!container) return;

    const fetchFn = geoSafeAPI.fetchHeatmapPoints?.bind(geoSafeAPI);
    if (!fetchFn) return;

    fetchFn("both", 60)
      .then((points) => {
        if (cancelled) return;
        if (layerRef.current) {
          container.removeLayer(layerRef.current);
        }
        layerRef.current = L.heatLayer(points as [number, number, number?][], HEAT_OPTIONS);
        container.addLayer(layerRef.current);
      })
      .catch(() => {
        // heatmap is best-effort; silently skip on error
      });

    return () => {
      cancelled = true;
      if (layerRef.current) {
        container.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [context]);

  return null;
}
