import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Map } from "../../components";
import { geoSafeAPI } from "../../services";
import { CriticalStockRecord, MapClickEvent, SafeZone, Warehouse } from "../../types";
import { MiniMetric, ResourceBadge, SectionHeader } from "./opsUi";

const WAREHOUSE_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  maintenance: "Bakım",
  inactive: "Pasif",
};

const SAFE_ZONE_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  full: "Dolu",
  inactive: "Pasif",
};

function countByStatus<T extends { status: string }>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});
}

export default function OperationsMapPage() {
  const { role } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockRecord[]>([]);
  const [clickedCoord, setClickedCoord] = useState<MapClickEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadMapMetrics = async () => {
      setLoading(true);
      setLoadErrors([]);

      const [warehouseResult, zoneResult, stockResult] = await Promise.allSettled([
        geoSafeAPI.fetchWarehouses(),
        geoSafeAPI.fetchSafeZones(),
        role === "admin" ? geoSafeAPI.fetchCriticalStockAdmin() : Promise.resolve([]),
      ]);

      if (!mounted) return;

      const nextErrors: string[] = [];

      if (warehouseResult.status === "fulfilled") setWarehouses(warehouseResult.value);
      else nextErrors.push("Depo verisi alınamadı.");

      if (zoneResult.status === "fulfilled") setSafeZones(zoneResult.value);
      else nextErrors.push("Barınma alanları alınamadı.");

      if (stockResult.status === "fulfilled") setCriticalStock(stockResult.value);
      else if (role === "admin") nextErrors.push("Kritik stok verisi alınamadı.");

      setLoadErrors(nextErrors);
      setLoading(false);
    };

    void loadMapMetrics();

    return () => {
      mounted = false;
    };
  }, [role]);

  const activeSafeZones = safeZones.filter((zone) => zone.status === "active").length;
  const inactiveSafeZones = safeZones.length - activeSafeZones;
  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === "active").length;
  const criticalWarehouseCount = new Set(criticalStock.map((item) => item.warehouse_id)).size;
  const totalSafeZoneCapacity = safeZones.reduce((total, zone) => total + (zone.capacity ?? 0), 0);
  const criticalStockPreview = criticalStock.slice(0, 4);
  const warehouseStatusBreakdown = countByStatus(warehouses);
  const zoneStatusBreakdown = countByStatus(safeZones);

  return (
    <section className="ops-panel map-panel">
      <SectionHeader
        eyebrow="Harita Analizi"
        title="Canlı Operasyon Haritası"
        meta={loading ? "Veri güncelleniyor" : "Barınma / Depolar / Rota desteği"}
      />

      <div className="map-command-row">
        <ResourceBadge tone="safe">Barınma alanları</ResourceBadge>
        <ResourceBadge tone="info">Depo işaretleri</ResourceBadge>
        <ResourceBadge tone="warning">Rota bulucu</ResourceBadge>
        {loadErrors.length ? <ResourceBadge tone="critical">Eksik veri</ResourceBadge> : null}
      </div>

      <div className="map-floating-metrics" aria-label="Harita operasyon ölçümleri">
        <MiniMetric label="Aktif Alan" value={activeSafeZones} tone="safe" />
        <MiniMetric label="Aktif Depo" value={activeWarehouses} tone="info" />
        <MiniMetric
          label="Kritik Depo"
          value={criticalWarehouseCount}
          tone={criticalWarehouseCount ? "critical" : "safe"}
        />
        <MiniMetric
          label="Riskli Alan"
          value={inactiveSafeZones}
          tone={inactiveSafeZones ? "warning" : "neutral"}
        />
      </div>

      <div className="map-ops-grid">
        <article className="map-ops-card">
          <span className="ops-eyebrow">Operasyon Odağı</span>
          <h3>Katman Önceliği</h3>
          <ul className="map-ops-list">
            <li>
              <strong>1. Barınma</strong>
              <span>
                {activeSafeZones} aktif alan, toplam {totalSafeZoneCapacity.toLocaleString("tr-TR")} kapasite
              </span>
            </li>
            <li>
              <strong>2. Depolar</strong>
              <span>
                {activeWarehouses} aktif depo, {criticalWarehouseCount} depoda kritik stok sinyali
              </span>
            </li>
            <li>
              <strong>3. Rota</strong>
              <span>Rota bulucu panelinden en yakın uygun depoyu işaretleyin</span>
            </li>
          </ul>
        </article>

        <article className="map-ops-card">
          <span className="ops-eyebrow">Durum Dağılımı</span>
          <h3>Saha Hazırlığı</h3>
          <div className="map-status-grid">
            <div>
              <strong>Depolar</strong>
              {Object.entries(warehouseStatusBreakdown).length ? (
                Object.entries(warehouseStatusBreakdown).map(([status, count]) => (
                  <span key={status}>
                    {WAREHOUSE_STATUS_LABELS[status] ?? status}: {count}
                  </span>
                ))
              ) : (
                <span>Veri yok</span>
              )}
            </div>
            <div>
              <strong>Alanlar</strong>
              {Object.entries(zoneStatusBreakdown).length ? (
                Object.entries(zoneStatusBreakdown).map(([status, count]) => (
                  <span key={status}>
                    {SAFE_ZONE_STATUS_LABELS[status] ?? status}: {count}
                  </span>
                ))
              ) : (
                <span>Veri yok</span>
              )}
            </div>
          </div>
        </article>

        <article className="map-ops-card">
          <span className="ops-eyebrow">Kritik Stok</span>
          <h3>Öncelikli Depolar</h3>
          {role !== "admin" ? (
            <p className="map-ops-muted">Kritik stok ayrıntıları admin yetkisi gerektirir.</p>
          ) : criticalStockPreview.length ? (
            <ul className="map-critical-list">
              {criticalStockPreview.map((item) => (
                <li key={`${item.warehouse_id}-${item.item_id}`}>
                  <strong>{item.warehouse_name}</strong>
                  <span>
                    {item.item_name}: {item.quantity} {item.item_unit}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="map-ops-muted">Kritik stok sinyali yok.</p>
          )}
        </article>

        <article className="map-ops-card">
          <span className="ops-eyebrow">Seçilen Nokta</span>
          <h3>Koordinat</h3>
          {clickedCoord ? (
            <div className="map-coordinate-card">
              <strong>
                {clickedCoord.lat.toFixed(5)}, {clickedCoord.lng.toFixed(5)}
              </strong>
              <span>
                {clickedCoord.timestamp.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <a
                className="ops-text-link"
                href={`https://www.google.com/maps?q=${clickedCoord.lat},${clickedCoord.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                Haritada aç
              </a>
            </div>
          ) : (
            <p className="map-ops-muted">Koordinat almak için haritada bir noktaya tıklayın.</p>
          )}
        </article>
      </div>

      {loadErrors.length ? (
        <div className="map-data-alert" role="status">
          {loadErrors.map((error) => (
            <span key={error}>{error}</span>
          ))}
        </div>
      ) : null}

      <Map onClickCoordinates={setClickedCoord} />
    </section>
  );
}
