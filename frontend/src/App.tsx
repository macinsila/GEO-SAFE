/**
 * App Component (Main)
 * Orchestrates the map and UI
 */

import React, { useState } from "react";
import { Map } from "./components";
import { MapClickEvent } from "./types";
import "./styles/App.css";

function App() {
  const [clickedCoordinate, setClickedCoordinate] = useState<MapClickEvent | null>(null);

  const handleMapClick = (event: MapClickEvent) => {
    setClickedCoordinate(event);
    console.log(`Map clicked: Lat ${event.lat.toFixed(4)}, Lng ${event.lng.toFixed(4)}`);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🌍 GeoSafe</h1>
        <p>Neighborhood-based Disaster Safety & Logistics Management</p>
      </header>

      <main className="app-main">
        <div className="map-section">
          <Map onClickCoordinates={handleMapClick} />
        </div>

        {/* Display clicked coordinates */}
        {clickedCoordinate && (
          <div className="coordinates-panel">
            <h3>📍 Last Clicked Location</h3>
            <div className="coordinate-info">
              <p>
                <strong>Latitude:</strong> {clickedCoordinate.lat.toFixed(6)}°
              </p>
              <p>
                <strong>Longitude:</strong> {clickedCoordinate.lng.toFixed(6)}°
              </p>
              <p>
                <strong>Time:</strong>{" "}
                {clickedCoordinate.timestamp.toLocaleTimeString()}
              </p>
            </div>
            <div className="coordinate-copy">
              <code>
                {clickedCoordinate.lat.toFixed(6)},{clickedCoordinate.lng.toFixed(6)}
              </code>
              <button
                onClick={() => {
                  const text = `${clickedCoordinate.lat.toFixed(6)},${clickedCoordinate.lng.toFixed(6)}`;
                  navigator.clipboard.writeText(text);
                  alert("Coordinates copied to clipboard!");
                }}
                className="copy-button"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>🏠 Backend API: http://localhost:8000</p>
        <p>Built with React + Leaflet + FastAPI</p>
      </footer>
    </div>
  );
}

export default App;
