/**
 * Map Component
 * Renders Leaflet map with warehouses and safe zones
 * Handles click events to capture coordinates
 */

import React from "react";
import {
  LayerGroup,
  LayersControl,
  MapContainer,
  TileLayer,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { geoSafeAPI } from "../services";
import { MapClickEvent, NearestDepotResult, Warehouse } from "../types";
import { CitizenSearch } from "./CitizenSearch";
import { RouteLayer } from "./RouteLayer";
import { WarehouseLayer } from "./WarehouseLayer";
import { SafeZoneLayer } from "./SafeZoneLayer";

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
  useMapEvents({
    click(e) {
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
 * Main Map Component
 */
export const Map: React.FC<MapProps> = ({ onClickCoordinates }) => {
  const [mapInstance, setMapInstance] = React.useState<L.Map | null>(null);
  const [userPosition, setUserPosition] = React.useState<[number, number] | null>(
    null
  );
  const [targetDepotPosition, setTargetDepotPosition] = React.useState<[
    number,
    number
  ] | null>(null);
  const [targetDepotName, setTargetDepotName] = React.useState<string>("");

  // Default map center (e.g., Istanbul, Turkey)
  const defaultCenter: [number, number] = [41.0082, 28.9784];
  const defaultZoom = 12;

  const handleMapRef = React.useCallback((instance: L.Map | null) => {
    if (instance) {
      setMapInstance(instance);
    }
  }, []);

  const extractWarehouseCoordinates = (
    warehouse: Warehouse
  ): [number, number] | null => {
    if (warehouse.location?.coordinates && warehouse.location.coordinates.length === 2) {
      const [lon, lat] = warehouse.location.coordinates;
      return [lat, lon];
    }

    if (!warehouse.data) {
      return null;
    }

    try {
      const meta =
        typeof warehouse.data === "string"
          ? JSON.parse(warehouse.data)
          : warehouse.data;
      const lat = Number(meta?.location?.lat);
      const lon = Number(meta?.location?.lon);

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return [lat, lon];
      }
    } catch (error) {
      console.error("Warehouse coordinate parse failed:", error);
    }

    return null;
  };

  const handleCitizenSearchResult = async ({
    userPosition: newUserPosition,
    result,
  }: {
    userPosition: [number, number];
    result: NearestDepotResult | null;
  }) => {
    setUserPosition(newUserPosition);

    if (!result) {
      setTargetDepotPosition(null);
      setTargetDepotName("");
      return;
    }

    try {
      const warehouses = await geoSafeAPI.fetchWarehouses();
      const matchedWarehouse = warehouses.find(
        (warehouse) => warehouse.id === result.depot.id
      );

      if (!matchedWarehouse) {
        alert("Hedef depo detayı bulunamadı.");
        return;
      }

      const coordinates = extractWarehouseCoordinates(matchedWarehouse);
      if (!coordinates) {
        alert("Depo koordinatı alınamadı.");
        return;
      }

      setTargetDepotPosition(coordinates);
      setTargetDepotName(result.depot.name);

      if (mapInstance) {
        mapInstance.flyTo(coordinates, 15);
      }
    } catch (error) {
      console.error("Target depot location fetch failed:", error);
      alert("Depo konumu yüklenirken API hatası oluştu.");
    }
  };

  return (
    <div className="geosafe-map">
      <div className="map-wrapper">
        <CitizenSearch onSearchResult={handleCitizenSearchResult} />

      <MapContainer
        ref={handleMapRef}
        center={defaultCenter}
        zoom={defaultZoom}
        className="map-container"
        style={{ width: "100%" }}
      >
        {/* OpenStreetMap tile layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Click handler */}
        <MapClickHandler onClickCoordinates={onClickCoordinates} />

        <LayersControl position="topright">
          <LayersControl.Overlay checked name="Toplanma Alanları">
            <LayerGroup>
              <SafeZoneLayer />
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Depolar">
            <LayerGroup>
              <WarehouseLayer />
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>

        <RouteLayer
          userPosition={userPosition}
          depotPosition={targetDepotPosition}
          depotName={targetDepotName}
        />
      </MapContainer>
      </div>
    </div>
  );
};

export default Map;
