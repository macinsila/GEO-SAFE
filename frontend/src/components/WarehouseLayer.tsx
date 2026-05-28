import React, { useEffect, useState } from "react";
import { Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "@changey/react-leaflet-markercluster";
import L from "leaflet";
import { Warehouse } from "../types";
import { geoSafeAPI } from "../services";

// Leaflet CSS for markercluster must be imported in the app shell
import "@changey/react-leaflet-markercluster/dist/styles.min.css";

const STATUS_COLORS: Record<string, string> = {
  active: "#2E7D32",
  risky: "#C62828",
  full: "#E65100",
  inactive: "#616161",
};

const makeIcon = (color: string) =>
  new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${colorToName(color)}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

function colorToName(hex: string): string {
  switch (hex) {
    case "#2E7D32": return "green";
    case "#C62828": return "red";
    case "#E65100": return "orange";
    default: return "grey";
  }
}

function getCoords(w: Warehouse): [number, number] | null {
  if (w.location?.coordinates?.length === 2) {
    const [lon, lat] = w.location.coordinates;
    return [lat, lon];
  }
  try {
    const meta = typeof w.data === "string" ? JSON.parse(w.data) : w.data;
    const lat = Number(meta?.location?.lat);
    const lon = Number(meta?.location?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
  } catch (_) {}
  return null;
}

// ── Viewport-aware wrapper ────────────────────────────────────────────────────

const ViewportWarehouseMarkers: React.FC<{ warehouses: Warehouse[] }> = ({ warehouses }) => {
  const map = useMap();
  const [bounds, setBounds] = useState(map.getBounds());

  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds()),
  });

  // Only render markers within the current viewport (+ 20% padding for smooth pan)
  const visible = warehouses.filter((w) => {
    const coords = getCoords(w);
    if (!coords) return false;
    return bounds.pad(0.2).contains(coords);
  });

  return (
    <MarkerClusterGroup chunkedLoading>
      {visible.map((w) => {
        const coords = getCoords(w);
        if (!coords) return null;
        const color = STATUS_COLORS[w.status?.toLowerCase()] ?? "#1565C0";
        return (
          <Marker key={w.id} position={coords} icon={makeIcon(color)}>
            <Popup>
              <div>
                <strong>{w.name}</strong>
                <div style={{ marginTop: 4, fontSize: 13 }}>
                  <div>Durum: {w.status}</div>
                  {w.capacity != null && <div>Kapasite: {w.capacity}</div>}
                  {w.address && <div>Adres: {w.address}</div>}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
};

// ── Public component ──────────────────────────────────────────────────────────

export const WarehouseLayer: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    let active = true;
    geoSafeAPI
      .fetchWarehouses()
      .then((data) => { if (active) setWarehouses(data); })
      .catch((err) => console.error("WarehouseLayer fetch error:", err));
    return () => { active = false; };
  }, []);

  return <ViewportWarehouseMarkers warehouses={warehouses} />;
};

export default WarehouseLayer;
