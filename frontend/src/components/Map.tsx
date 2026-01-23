/**
 * Map Component
 * Renders Leaflet map with warehouses and safe zones
 * Handles click events to capture coordinates
 */

import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  GeoJSON,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Warehouse, SafeZone, MapClickEvent } from "../types";
import { geoSafeAPI } from "../services";

// Fix Leaflet icon issue (required for React Leaflet)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapProps {
  onClickCoordinates?: (event: MapClickEvent) => void;
}

/**
 * Inner component to handle map click events
 * Must be inside MapContainer
 */
function MapClickHandler({
  onClickCoordinates,
}: {
  onClickCoordinates?: (event: MapClickEvent) => void;
}) {
  const map = useMapEvents({
    click(e) {
      console.log("Map clicked at:", e.latlng.lat, e.latlng.lng);
      if (onClickCoordinates) {
        onClickCoordinates({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          timestamp: new Date(),
        });
      }
    },
  });
  return null;
}

/**
 * Warehouse Marker Component
 */
function WarehouseMarker({ warehouse }: { warehouse: Warehouse }) {
  const [coords, setCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    // Extract coordinates from location GeoJSON
    if (warehouse.location && warehouse.location.coordinates) {
      const [lon, lat] = warehouse.location.coordinates;
      setCoords([lat, lon]); // Leaflet uses [lat, lon]
    } else if (warehouse.data) {
      // Fallback: try to extract from data JSON
      try {
        const data = typeof warehouse.data === "string" ? JSON.parse(warehouse.data) : warehouse.data;
        if (data.location) {
          setCoords([data.location.lat, data.location.lon]);
        }
      } catch (e) {
        console.error("Failed to parse warehouse data:", e);
      }
    }
  }, [warehouse]);

  if (!coords) {
    console.warn(`Warehouse ${warehouse.id} has no valid coordinates`);
    return null;
  }

  return (
    <Marker position={coords}>
      <Popup>
        <div>
          <h3 style={{ margin: "0 0 5px 0" }}>{warehouse.name}</h3>
          <p style={{ margin: "5px 0" }}>
            <strong>Status:</strong> {warehouse.status}
          </p>
          {warehouse.capacity && (
            <p style={{ margin: "5px 0" }}>
              <strong>Capacity:</strong> {warehouse.capacity}
            </p>
          )}
          {warehouse.address && (
            <p style={{ margin: "5px 0" }}>
              <strong>Address:</strong> {warehouse.address}
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

/**
 * Main Map Component
 */
export const Map: React.FC<MapProps> = ({ onClickCoordinates }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default map center (e.g., Istanbul, Turkey)
  const defaultCenter: [number, number] = [41.0082, 28.9784];
  const defaultZoom = 12;

  /**
   * Fetch data from backend on component mount
   */
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [warehousesData, safeZonesData] = await Promise.all([
          geoSafeAPI.fetchWarehouses(),
          geoSafeAPI.fetchSafeZones(),
        ]);

        setWarehouses(warehousesData);
        setSafeZones(safeZonesData);
        setError(null);
      } catch (err) {
        console.error("Failed to load map data:", err);
        setError("Failed to load map data. Check backend connection.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (error) {
    return (
      <div style={{ padding: "20px", color: "red" }}>
        <p>{error}</p>
        <small>Make sure backend is running on http://localhost:8000</small>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "10px", fontSize: "14px", color: "#666" }}>
        {loading ? (
          <p>Loading map data...</p>
        ) : (
          <p>
            Showing {warehouses.length} warehouses and {safeZones.length} safe
            zones. Click on map to get coordinates.
          </p>
        )}
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: "600px", width: "100%" }}
      >
        {/* OpenStreetMap tile layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Click handler */}
        <MapClickHandler onClickCoordinates={onClickCoordinates} />

        {/* Warehouse markers */}
        {warehouses.map((warehouse) => (
          <WarehouseMarker
            key={warehouse.id}
            warehouse={warehouse}
          />
        ))}

        {/* Safe zones as GeoJSON polygons */}
        {safeZones.map((zone) => (
          <GeoJSON
            key={zone.id}
            data={
              {
                type: "Feature",
                geometry: zone.geometry,
                properties: {
                  name: zone.name,
                  capacity: zone.capacity,
                  status: zone.status,
                },
              } as any
            }
            style={{
              color: "#ff7800",
              weight: 2,
              opacity: 0.6,
              fillOpacity: 0.2,
            }}
          >
            <Popup>
              <div>
                <h3 style={{ margin: "0 0 5px 0" }}>{zone.name}</h3>
                <p style={{ margin: "5px 0" }}>
                  <strong>Status:</strong> {zone.status}
                </p>
                {zone.capacity && (
                  <p style={{ margin: "5px 0" }}>
                    <strong>Capacity:</strong> {zone.capacity}{" "}
                    {zone.capacity_type}
                  </p>
                )}
              </div>
            </Popup>
          </GeoJSON>
        ))}
      </MapContainer>
    </div>
  );
};

export default Map;
