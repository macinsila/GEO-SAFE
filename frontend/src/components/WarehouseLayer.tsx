import React, { useEffect, useState } from "react";
import { CircleMarker, Popup } from "react-leaflet";
import { Warehouse } from "../types";
import { geoSafeAPI } from "../services";

const WAREHOUSE_STATUS_COLORS: Record<string, string> = {
  active: "#2E7D32",
  maintenance: "#EF6C00",
  inactive: "#616161",
};

function getWarehouseColor(status: string): string {
  return WAREHOUSE_STATUS_COLORS[status.toLowerCase()] || "#1565C0";
}

function getWarehouseCoordinates(warehouse: Warehouse): [number, number] | null {
  if (warehouse.location?.coordinates && warehouse.location.coordinates.length === 2) {
    const [lon, lat] = warehouse.location.coordinates;
    return [lat, lon];
  }

  if (!warehouse.data) {
    return null;
  }

  try {
    const meta = typeof warehouse.data === "string" ? JSON.parse(warehouse.data) : warehouse.data;
    const lat = Number(meta?.location?.lat);
    const lon = Number(meta?.location?.lon);

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return [lat, lon];
    }
  } catch (error) {
    console.error("Failed to parse warehouse metadata:", error);
  }

  return null;
}

export const WarehouseLayer: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadWarehouses = async () => {
      try {
        const data = await geoSafeAPI.fetchWarehouses();
        if (isMounted) {
          setWarehouses(data);
        }
      } catch (error) {
        console.error("WarehouseLayer failed to load warehouses:", error);
      }
    };

    loadWarehouses();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      {warehouses.map((warehouse) => {
        const coordinates = getWarehouseCoordinates(warehouse);
        if (!coordinates) {
          return null;
        }

        const markerColor = getWarehouseColor(warehouse.status);

        return (
          <CircleMarker
            key={warehouse.id}
            center={coordinates}
            radius={8}
            pathOptions={{
              color: markerColor,
              fillColor: markerColor,
              fillOpacity: 0.75,
              weight: 2,
            }}
          >
            <Popup>
              <div>
                <h3 style={{ margin: "0 0 6px 0" }}>{warehouse.name}</h3>
                <p style={{ margin: "4px 0" }}>
                  <strong>Durum:</strong> {warehouse.status}
                </p>
                {warehouse.capacity !== undefined && warehouse.capacity !== null && (
                  <p style={{ margin: "4px 0" }}>
                    <strong>Kapasite:</strong> {warehouse.capacity}
                  </p>
                )}
                {warehouse.address && (
                  <p style={{ margin: "4px 0" }}>
                    <strong>Adres:</strong> {warehouse.address}
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default WarehouseLayer;
