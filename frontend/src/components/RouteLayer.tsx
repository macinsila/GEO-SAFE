import React, { useEffect, useState } from "react";
import { Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";

const API_BASE =
  (process.env.REACT_APP_API_BASE_URL as string | undefined) ||
  (process.env.REACT_APP_API_URL as string | undefined) ||
  "http://localhost:8000";

const targetIcon = new L.Icon({
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const waypointIcon = new L.Icon({
  iconRetinaUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface RouteStep {
  instruction: string;
  distance_m: number;
  duration_s: number;
}

interface RouteInfo {
  coordinates: [number, number][]; // [lng, lat] GeoJSON order
  distance_m: number;
  duration_s: number;
  steps: RouteStep[];
  fallback: boolean;
  accessibility: boolean;
  waypoint_count: number;
}

export interface RouteLayerProps {
  userPosition: [number, number] | null;   // [lat, lng] — Leaflet convention
  depotPosition: [number, number] | null;  // [lat, lng]
  depotName?: string;
  /** Intermediate stops in Leaflet [lat, lng] order. */
  waypoints?: [number, number][];
  /** Request a wheelchair-accessible (stair-free) route. */
  accessibility?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} dk`;
  return `${Math.floor(mins / 60)} sa ${mins % 60} dk`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export const RouteLayer: React.FC<RouteLayerProps> = ({
  userPosition,
  depotPosition,
  depotName,
  waypoints = [],
  accessibility = false,
}) => {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const waypointsKey = waypoints.map(([lat, lon]) => `${lat},${lon}`).join(";");

  useEffect(() => {
    if (!userPosition || !depotPosition) {
      setRoute(null);
      return;
    }

    const [fromLat, fromLon] = userPosition;
    const [toLat, toLon] = depotPosition;

    let url =
      `${API_BASE}/api/v1/routing/directions` +
      `?from_lat=${fromLat}&from_lon=${fromLon}` +
      `&to_lat=${toLat}&to_lon=${toLon}`;

    if (accessibility) {
      url += "&accessibility=true";
    }

    if (waypointsKey) {
      url += `&waypoints=${encodeURIComponent(waypointsKey)}`;
    }

    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (json.status !== "success") return;
        const feature = json.data?.features?.[0];
        if (!feature) return;
        const props = feature.properties;
        const coords: [number, number][] = feature.geometry.coordinates;
        setRoute({
          coordinates: coords,
          distance_m: props.distance_m,
          duration_s: props.duration_s,
          steps: props.steps ?? [],
          fallback: !!json.data.fallback,
          accessibility: !!props.accessibility,
          waypoint_count: props.waypoint_count ?? 0,
        });
      })
      .catch(() => {
        // Local straight-line fallback when fetch itself fails
        if (userPosition && depotPosition) {
          const [fLat, fLon] = userPosition;
          const [tLat, tLon] = depotPosition;
          const dlat = tLat - fLat;
          const dlon = tLon - fLon;
          const dist = Math.sqrt(dlat * dlat + dlon * dlon) * 111_320;
          setRoute({
            coordinates: [[fLon, fLat], [tLon, tLat]],
            distance_m: Math.round(dist),
            duration_s: Math.round(dist / 1.4),
            steps: [],
            fallback: true,
            accessibility: false,
            waypoint_count: 0,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [userPosition, depotPosition, accessibility, waypointsKey]);

  if (!userPosition || !depotPosition) return null;

  // Convert GeoJSON [lng, lat] → Leaflet [lat, lng]
  const polylinePositions: [number, number][] = route
    ? route.coordinates.map(([lng, lat]) => [lat, lng])
    : [userPosition, depotPosition];

  const routeColor = route?.accessibility
    ? "#2e7d32"   // green for accessible route
    : route?.fallback
    ? "#888"
    : "#1565c0";  // blue for standard walking

  return (
    <>
      <Polyline
        positions={polylinePositions}
        pathOptions={{
          color: routeColor,
          weight: 4,
          opacity: loading ? 0.4 : 0.85,
          dashArray: route?.fallback ? "8, 6" : undefined,
        }}
      />

      {/* Intermediate waypoint markers */}
      {waypoints.map((wp, idx) => (
        <Marker key={`wp-${idx}`} position={wp} icon={waypointIcon}>
          <Popup>
            <strong>Ara Durak {idx + 1}</strong>
            <div style={{ fontSize: 12, color: "#555" }}>
              {wp[0].toFixed(5)}, {wp[1].toFixed(5)}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Destination marker */}
      <Marker position={depotPosition} icon={targetIcon}>
        <Popup>
          <div style={{ minWidth: 180 }}>
            <strong>{depotName || "Hedef Depo"}</strong>

            {route?.accessibility && (
              <div
                style={{
                  marginTop: 4,
                  padding: "2px 6px",
                  background: "#e8f5e9",
                  color: "#2e7d32",
                  borderRadius: 4,
                  fontSize: 11,
                  display: "inline-block",
                }}
              >
                ♿ Erişilebilir rota
              </div>
            )}

            {route && (
              <div style={{ marginTop: 4, fontSize: 13 }}>
                <div>📍 {formatDistance(route.distance_m)}</div>
                <div>🕐 {formatDuration(route.duration_s)} yürüyüş</div>
                {route.waypoint_count > 0 && (
                  <div style={{ fontSize: 11, color: "#e65100", marginTop: 2 }}>
                    🔀 {route.waypoint_count} ara durak
                  </div>
                )}
                {route.fallback && (
                  <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                    (tahmini düz çizgi mesafe)
                  </div>
                )}
                {route.steps.length > 0 && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12 }}>
                      Yol tarifi ({route.steps.length} adım)
                    </summary>
                    <ol style={{ paddingLeft: 16, margin: "4px 0", fontSize: 11 }}>
                      {route.steps.slice(0, 8).map((s, i) => (
                        <li key={i} style={{ marginBottom: 2 }}>
                          {s.instruction}{" "}
                          <span style={{ color: "#666" }}>
                            ({formatDistance(s.distance_m)})
                          </span>
                        </li>
                      ))}
                      {route.steps.length > 8 && (
                        <li style={{ color: "#666" }}>
                          +{route.steps.length - 8} adım daha…
                        </li>
                      )}
                    </ol>
                  </details>
                )}
              </div>
            )}

            {loading && (
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Rota hesaplanıyor…
              </div>
            )}
          </div>
        </Popup>
      </Marker>
    </>
  );
};

export default RouteLayer;
