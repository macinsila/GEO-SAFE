import React from "react";
import { Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";

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

interface RouteLayerProps {
  userPosition: [number, number] | null;
  depotPosition: [number, number] | null;
  depotName?: string;
}

export const RouteLayer: React.FC<RouteLayerProps> = ({
  userPosition,
  depotPosition,
  depotName,
}) => {
  if (!userPosition || !depotPosition) {
    return null;
  }

  return (
    <>
      <Polyline
        positions={[userPosition, depotPosition]}
        pathOptions={{
          color: "#1565c0",
          weight: 4,
          opacity: 0.85,
          dashArray: "8, 6",
        }}
      />

      <Marker position={depotPosition} icon={targetIcon}>
        <Popup>
          <div>
            <strong>Hedef Depo</strong>
            <div>{depotName || "Depo"}</div>
          </div>
        </Popup>
      </Marker>
    </>
  );
};

export default RouteLayer;
