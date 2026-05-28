import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI } from "../../services";
import { CriticalStockRecord, Warehouse } from "../../types";
import { EmptyState, ResourceBadge, SectionHeader, StatusCard } from "./opsUi";

export default function OperationsLogisticsPage() {
  const { role } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockFilter, setStockFilter] = useState<"all" | "critical" | "available">("all");

  useEffect(() => {
    let mounted = true;

    const loadLogistics = async () => {
      setLoading(true);
      const [warehouseResult, stockResult] = await Promise.allSettled([
        geoSafeAPI.fetchWarehouses(),
        role === "admin" ? geoSafeAPI.fetchCriticalStockAdmin() : Promise.resolve([]),
      ]);

      if (!mounted) return;
      if (warehouseResult.status === "fulfilled") setWarehouses(warehouseResult.value);
      if (stockResult.status === "fulfilled") setCriticalStock(stockResult.value);
      setLoading(false);
    };

    void loadLogistics();

    return () => {
      mounted = false;
    };
  }, [role]);

  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === "active").length;
  const inactiveWarehouses = warehouses.filter((warehouse) => warehouse.status !== "active").length;
  const criticalWarehouseCount = new Set(criticalStock.map((row) => row.warehouse_id)).size;
  const filteredStock = criticalStock.filter((item) => {
    if (stockFilter === "critical") return item.quantity === 0;
    if (stockFilter === "available") return item.quantity > 0;
    return true;
  });

  return (
    <div className="ops-page-stack">
      <section className="ops-metric-grid" aria-label="Lojistik özeti">
        <StatusCard
          label="Depo Kullanılabilirliği"
          value={loading ? "..." : activeWarehouses}
          detail={`Toplam ${warehouses.length || 0} depo`}
          tone="safe"
        />
        <StatusCard
          label="İzlenecek Depolar"
          value={loading ? "..." : inactiveWarehouses}
          detail="Aktif olmayan depo kayıtları"
          tone={inactiveWarehouses ? "warning" : "neutral"}
        />
        <StatusCard
          label="Kritik Depolar"
          value={loading ? "..." : criticalWarehouseCount}
          detail={role === "admin" ? "Kritik stok bulunan depolar" : "Admin görünümü"}
          tone={criticalWarehouseCount ? "critical" : "neutral"}
        />
      </section>

      <section className="ops-logistics-grid">
        <section className="ops-panel">
          <SectionHeader eyebrow="Kaynak Riski" title="Depo Durumu" />
          {warehouses.length === 0 && !loading ? (
            <EmptyState message="Depo kaydı bulunamadı." />
          ) : (
            <div className="ops-warehouse-list">
              {warehouses.map((warehouse) => (
                <article key={warehouse.id} className="risk-row">
                  <div>
                    <strong>{warehouse.name}</strong>
                    <span>{warehouse.address || "Adres bilgisi bekleniyor."}</span>
                  </div>
                  <ResourceBadge tone={warehouse.status === "active" ? "safe" : "warning"}>
                    {warehouse.status}
                  </ResourceBadge>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="ops-panel">
          <SectionHeader eyebrow="Envanter Durumu" title="Öncelikli Stok" />
          <div className="filter-toolbar" aria-label="Stok filtresi">
            <button
              type="button"
              className={stockFilter === "all" ? "active" : ""}
              onClick={() => setStockFilter("all")}
            >
              Tümü ({criticalStock.length})
            </button>
            <button
              type="button"
              className={stockFilter === "critical" ? "active" : ""}
              onClick={() => setStockFilter("critical")}
            >
              Sıfır Stok ({criticalStock.filter((item) => item.quantity === 0).length})
            </button>
            <button
              type="button"
              className={stockFilter === "available" ? "active" : ""}
              onClick={() => setStockFilter("available")}
            >
              Düşük Stok ({criticalStock.filter((item) => item.quantity > 0).length})
            </button>
          </div>
          {role !== "admin" ? (
            <EmptyState message="Kritik stok ayrıntısı için admin rolü gerekir." />
          ) : loading ? (
            <EmptyState message="Stok akışı yükleniyor..." />
          ) : criticalStock.length === 0 ? (
            <EmptyState message="Şu anda kritik stok uyarısı yok." />
          ) : filteredStock.length === 0 ? (
            <EmptyState message="Bu filtrede gösterilecek kalem yok." />
          ) : (
            <div className="inventory-list">
              {filteredStock.map((item) => (
                <article key={`${item.warehouse_id}-${item.item_id}`} className="inventory-item">
                  <div>
                    <strong>{item.item_name}</strong>
                    <span>{item.warehouse_name}</span>
                  </div>
                  <ResourceBadge tone={item.quantity === 0 ? "critical" : "warning"}>
                    {item.quantity}/{item.threshold} {item.item_unit}
                  </ResourceBadge>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
