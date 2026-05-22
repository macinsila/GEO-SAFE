import React, { useState } from "react";
import { NearestDepotResult, ReliefItemName } from "../../types";
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
      }
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

  return (
    <div className="citizen-search-panel">
      <h3>Vatandaş Araması</h3>

      <button className="citizen-button" onClick={handleUseMyLocation} type="button">
        Konumumu Kullan
      </button>

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
    </div>
  );
};

export default CitizenSearch;
