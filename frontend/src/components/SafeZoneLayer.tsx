import React, { useEffect, useState } from "react";
import { GeoJSON, Popup } from "react-leaflet";
import type { Feature, Polygon } from "geojson";
import { SafeZone, PolygonGeometry } from "../types";
import { geoSafeAPI } from "../services";

const SAFE_ZONE_STATUS_COLORS: Record<string, string> = {
  active: "#1B5E20",
  inactive: "#546E7A",
  closed: "#B71C1C",
};

function getSafeZoneColor(status: string): string {
  return SAFE_ZONE_STATUS_COLORS[status.toLowerCase()] || "#0D47A1";
}

function getSafeZoneGeometry(zone: SafeZone): PolygonGeometry | null {
  if (zone.geometry?.coordinates && zone.geometry.coordinates.length > 0) {
    return zone.geometry;
  }

  if (!zone.data) {
    return null;
  }

  try {
    const meta = typeof zone.data === "string" ? JSON.parse(zone.data) : zone.data;
    const bounds = meta?.bounds;

    if (!bounds) {
      return null;
    }

    const minLon = Number(bounds.minLon);
    const maxLon = Number(bounds.maxLon);
    const minLat = Number(bounds.minLat);
    const maxLat = Number(bounds.maxLat);

    if (
      [minLon, maxLon, minLat, maxLat].every((value) => Number.isFinite(value))
    ) {
      return {
        type: "Polygon",
        coordinates: [[
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat],
        ]],
      };
    }
  } catch (error) {
    console.error("Failed to parse safe zone metadata:", error);
  }

  return null;
}

export const SafeZoneLayer: React.FC = () => {
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadSafeZones = async () => {
      try {
        const data = await geoSafeAPI.fetchSafeZones();
        if (isMounted) {
          setSafeZones(data);
        }
      } catch (error) {
        console.error("SafeZoneLayer failed to load safe zones:", error);
      }
    };

    loadSafeZones();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      {safeZones.map((zone) => {
        const geometry = getSafeZoneGeometry(zone);
        if (!geometry) {
          return null;
        }

        const fillColor = getSafeZoneColor(zone.status);
        const feature: Feature<Polygon> = {
          type: "Feature",
          geometry: geometry as Polygon,
          properties: {
            id: zone.id,
            name: zone.name,
            status: zone.status,
            capacity: zone.capacity,
            capacityType: zone.capacity_type,
          },
        };

        return (
          <GeoJSON
            key={zone.id}
            data={feature}
            style={{
              color: fillColor,
              fillColor,
              fillOpacity: 0.24,
              weight: 2,
              opacity: 0.9,
            }}
          >
            <Popup>
              <div>
                <h3 style={{ margin: "0 0 6px 0" }}>{zone.name}</h3>
                <p style={{ margin: "4px 0" }}>
                  <strong>Durum:</strong> {zone.status}
                </p>
                {zone.capacity !== undefined && zone.capacity !== null && (
                  <p style={{ margin: "4px 0" }}>
                    <strong>Kapasite:</strong> {zone.capacity} {zone.capacity_type}
                  </p>
                )}
              </div>
            </Popup>
          </GeoJSON>
        );
      })}
    </>
  );
};

export default SafeZoneLayer;
