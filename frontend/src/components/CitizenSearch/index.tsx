import React, { useState } from "react";
import { NearestDepotResult, NearestSafeZoneResult, ReliefItemName } from "../../types";
import { geoSafeAPI } from "../../services";

const itemOptions: ReliefItemName[] = [
  "battaniye",
  "kuru_gida",
  "ilac",
  "su",
  "yangin_malzemesi",
];

interface CitizenSearchPayload {
  userPosition: [number, number];
  result: NearestDepotResult | null;
}

interface CitizenSearchProps {
  onSearchResult: (payload: CitizenSearchPayload) => void;
}

export const CitizenSearch: React.FC<CitizenSearchProps> = ({ onSearchResult }) => {
  const [selectedItem, setSelectedItem] = useState<ReliefItemName>("battaniye");
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NearestDepotResult | null>(null);

  const [safeZoneLoading, setSafeZoneLoading] = useState(false);
  const [safeZoneResults, setSafeZoneResults] = useState<NearestSafeZoneResult[]>([]);
  const [safeZoneError, setSafeZoneError] = useState("");

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Tarayıcı konum servisini desteklemiyor.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
        setUserPosition(coords);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          alert("Konum erişimi reddedildi.");
          return;
        }
        alert("Konum alınamadı.");
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handleSearchNearestDepot = async () => {
    if (!userPosition) {
      alert("Önce konumunuzu alın.");
      return;
    }

    setLoading(true);

    try {
      const response = await geoSafeAPI.fetchNearestDepot(
        userPosition[0],
        userPosition[1],
        selectedItem,
        10
      );

      if (!response.length) {
        setResult(null);
        onSearchResult({ userPosition, result: null });
        alert("10 km içinde uygun depo bulunamadı.");
        return;
      }

      const nearest = response[0];
      setResult(nearest);
      onSearchResult({ userPosition, result: nearest });
    } catch (error) {
      console.error("Nearest depot search failed:", error);
      alert("API hatası oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchNearestSafeZone = async () => {
    if (!userPosition) {
      alert("Önce konumunuzu alın.");
      return;
    }
    setSafeZoneLoading(true);
    setSafeZoneError("");
    setSafeZoneResults([]);
    try {
      const zones = await geoSafeAPI.fetchNearestSafeZone(userPosition[0], userPosition[1], 5);
      setSafeZoneResults(zones);
      if (!zones.length) setSafeZoneError("Yakında aktif toplanma alanı bulunamadı.");
    } catch {
      setSafeZoneError("Toplanma alanı araması başarısız oldu.");
    } finally {
      setSafeZoneLoading(false);
    }
  };

  return (
    <div className="citizen-search-panel">
      <h3>Vatandaş Araması</h3>

      <button className="citizen-button" onClick={handleUseMyLocation} type="button">
        Konumumu Kullan
      </button>

      {userPosition && (
        <p style={{ fontSize: 12, color: "#4caf50", margin: "4px 0 8px" }}>
          Konum alındı ({userPosition[0].toFixed(4)}, {userPosition[1].toFixed(4)})
        </p>
      )}

      {/* Depot search */}
      <label className="citizen-label" htmlFor="item-select">
        Malzeme
      </label>
      <select
        id="item-select"
        className="citizen-select"
        value={selectedItem}
        onChange={(event) => setSelectedItem(event.target.value as ReliefItemName)}
      >
        {itemOptions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <button
        className="citizen-button citizen-button-primary"
        onClick={handleSearchNearestDepot}
        type="button"
        disabled={loading}
      >
        {loading ? "Aranıyor..." : "En Yakın Depoyu Bul"}
      </button>

      <div className="citizen-result">
        {result ? (
          <>
            <p>
              <strong>Depo:</strong> {result.depot.name}
            </p>
            <p>
              <strong>Mesafe:</strong> {result.distance_km.toFixed(2)} km
            </p>
            <p>
              <strong>Stok:</strong> {result.item.quantity} {result.item.unit}
            </p>
          </>
        ) : (
          <p>Henüz sonuç yok.</p>
        )}
      </div>

      <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid #ddd" }} />

      {/* Safe zone search — GS-031 */}
      <button
        className="citizen-button"
        onClick={handleSearchNearestSafeZone}
        type="button"
        disabled={safeZoneLoading}
        style={{ width: "100%", marginBottom: 8 }}
      >
        {safeZoneLoading ? "Aranıyor..." : "En Yakın Toplanma Alanını Bul"}
      </button>

      {safeZoneError && (
        <p style={{ fontSize: 12, color: "#e53935", margin: "4px 0" }}>{safeZoneError}</p>
      )}

      {safeZoneResults.length > 0 && (
        <div className="citizen-result" style={{ marginTop: 8 }}>
          <strong style={{ fontSize: 13 }}>Toplanma Alanları</strong>
          {safeZoneResults.map((zone) => (
            <div
              key={zone.id}
              style={{
                padding: "6px 0",
                borderBottom: "1px solid #f0f0f0",
                opacity: zone.is_full ? 0.6 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{zone.name}</span>
                {zone.is_full && (
                  <span
                    style={{
                      fontSize: 11,
                      background: "#f44336",
                      color: "#fff",
                      borderRadius: 4,
                      padding: "2px 6px",
                    }}
                  >
                    Dolu
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                {zone.distance_km.toFixed(2)} km
                {zone.capacity != null ? ` · Kapasite: ${zone.capacity.toLocaleString("tr-TR")}` : ""}
                {zone.is_full ? " — Alternatif alan önerilmektedir" : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CitizenSearch;
