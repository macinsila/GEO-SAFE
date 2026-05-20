import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI } from "../../services";
import {
  CriticalStockRecord,
  EmergencyAdminRecord,
  InventoryItemAdmin,
  InventoryMovementAdminRecord,
  SafeZone,
  ShelterOfferAdmin,
  VolunteerApplicationAdmin,
  Warehouse,
  WarehouseInventoryData,
} from "../../types";

type AdminTab = "warehouses" | "safezones" | "emergency" | "volunteers" | "shelters";

type InventoryEditRow = {
  item_id: number;
  item_name: string;
  item_unit: string;
  quantity: number;
  originalQuantity: number;
};

type ItemDraft = {
  sku: string;
  name: string;
  unit: string;
  description: string;
  low_stock_threshold: string;
  is_active: boolean;
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active: { background: "#2E7D32", color: "#fff" },
  inactive: { background: "#616161", color: "#fff" },
  risky: { background: "#C62828", color: "#fff" },
  maintenance: { background: "#E65100", color: "#fff" },
  pending: { background: "#F9A825", color: "#fff" },
  approved: { background: "#2E7D32", color: "#fff" },
  rejected: { background: "#C62828", color: "#fff" },
  reviewing: { background: "#1565C0", color: "#fff" },
  resolved: { background: "#2E7D32", color: "#fff" },
  dismissed: { background: "#616161", color: "#fff" },
  spam: { background: "#6A1B9A", color: "#fff" },
};

const TH: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 13,
  color: "#555",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  verticalAlign: "middle",
  borderTop: "1px solid #eee",
  fontSize: 13,
};

function parseThreshold(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : Math.max(0, parsed);
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { background: "#9E9E9E", color: "#fff" };
  return (
    <span
      style={{
        ...style,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: number;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      style={{
        background: warn && value > 0 ? "#FFF8E1" : "#fff",
        border: `1px solid ${warn && value > 0 ? "#F9A825" : "#e0e0e0"}`,
        borderRadius: 8,
        padding: "16px 20px",
        flex: "1 1 160px",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: warn && value > 0 ? "#E65100" : "#1a237e",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>{label}</div>
      {sub ? <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid #eaeaea",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <strong style={{ color: "#1a237e", fontSize: 15 }}>{title}</strong>
        {action}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </section>
  );
}

interface Props {
  onNavigateToMap?: () => void;
}

export default function AdminDashboard({ onNavigateToMap }: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const goHome = onNavigateToMap ?? (() => navigate("/"));

  const [activeTab, setActiveTab] = useState<AdminTab>("warehouses");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [safeZoneCount, setSafeZoneCount] = useState(0);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null);
  const [warehouseInventory, setWarehouseInventory] = useState<WarehouseInventoryData | null>(null);
  const [inventoryRows, setInventoryRows] = useState<InventoryEditRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemAdmin[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockRecord[]>([]);
  const [movementHistory, setMovementHistory] = useState<InventoryMovementAdminRecord[]>([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [itemBusy, setItemBusy] = useState<number | "new" | null>(null);
  const [itemMsg, setItemMsg] = useState("");
  const [newItem, setNewItem] = useState<ItemDraft>({
    sku: "",
    name: "",
    unit: "unit",
    description: "",
    low_stock_threshold: "",
    is_active: true,
  });

  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [safeZonesLoading, setSafeZonesLoading] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [zoneInventory, setZoneInventory] = useState<Record<string, unknown>>({});
  const [zoneInventoryEdit, setZoneInventoryEdit] = useState<Record<string, unknown>>({});
  const [zoneSaveBusy, setZoneSaveBusy] = useState(false);
  const [zoneSaveMsg, setZoneSaveMsg] = useState("");

  const [emergencies, setEmergencies] = useState<EmergencyAdminRecord[]>([]);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [emergencyFilter, setEmergencyFilter] = useState("");
  const [clearingEmergencies, setClearingEmergencies] = useState(false);

  const [volunteers, setVolunteers] = useState<VolunteerApplicationAdmin[]>([]);
  const [volunteerLoading, setVolunteerLoading] = useState(false);
  const [volunteerFilter, setVolunteerFilter] = useState("");

  const [shelterOffers, setShelterOffers] = useState<ShelterOfferAdmin[]>([]);
  const [shelterLoading, setShelterLoading] = useState(false);
  const [shelterFilter, setShelterFilter] = useState("");

  const loadWarehouseOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [adminWarehouses, safeZonesData, items, critical, movements] = await Promise.all([
        geoSafeAPI.fetchAdminWarehouses(),
        geoSafeAPI.fetchSafeZones(),
        geoSafeAPI.fetchInventoryItemsAdmin(),
        geoSafeAPI.fetchCriticalStockAdmin(),
        geoSafeAPI.fetchInventoryMovementsAdmin(),
      ]);
      setWarehouses(adminWarehouses);
      setSafeZoneCount(safeZonesData.length);
      setInventoryItems(items);
      setCriticalStock(critical);
      setMovementHistory(movements);
    } finally {
      setLoading(false);
    }
  }, []);

  const buildInventoryRows = useCallback(
    (items: InventoryItemAdmin[], currentInventory: WarehouseInventoryData | null) => {
      const quantityByItem = new Map<number, number>();
      currentInventory?.items.forEach((row) => {
        quantityByItem.set(row.item_id, row.quantity);
      });

      return items
        .filter((item) => item.is_active)
        .map((item) => {
          const quantity = quantityByItem.get(item.id) ?? 0;
          return {
            item_id: item.id,
            item_name: item.name,
            item_unit: item.unit,
            quantity,
            originalQuantity: quantity,
          };
        });
    },
    []
  );

  const selectWarehouse = useCallback(
    async (warehouseId: number, nextItems?: InventoryItemAdmin[]) => {
      setSelectedWarehouseId(warehouseId);
      setSaveMsg("");
      setInventoryLoading(true);
      try {
        const inventory = await geoSafeAPI.fetchWarehouseInventory(warehouseId);
        setWarehouseInventory(inventory);
        setInventoryRows(buildInventoryRows(nextItems ?? inventoryItems, inventory));
      } catch {
        setWarehouseInventory(null);
        setInventoryRows(buildInventoryRows(nextItems ?? inventoryItems, null));
      } finally {
        setInventoryLoading(false);
      }
    },
    [buildInventoryRows, inventoryItems]
  );

  useEffect(() => {
    loadWarehouseOverview();
  }, [loadWarehouseOverview]);

  useEffect(() => {
    if (selectedWarehouseId !== null) {
      setInventoryRows(buildInventoryRows(inventoryItems, warehouseInventory));
    }
  }, [buildInventoryRows, inventoryItems, selectedWarehouseId, warehouseInventory]);

  const saveWarehouseInventory = async () => {
    if (selectedWarehouseId === null) {
      return;
    }

    const changedRows = inventoryRows.filter((row) => row.quantity !== row.originalQuantity);
    if (changedRows.length === 0) {
      setSaveMsg("Degisiklik yok.");
      return;
    }

    setSaveBusy(true);
    setSaveMsg("");
    try {
      await Promise.all(
        changedRows.map((row) =>
          geoSafeAPI.updateWarehouseInventoryAdmin(selectedWarehouseId, row.item_id, {
            quantity: row.quantity,
            movement_type: "adjustment",
            note: "Admin dashboard inventory update",
          })
        )
      );
      await loadWarehouseOverview();
      await selectWarehouse(selectedWarehouseId);
      setSaveMsg("Stok guncellendi.");
    } catch {
      setSaveMsg("Kaydetme hatasi.");
    } finally {
      setSaveBusy(false);
    }
  };

  const createInventoryItem = async () => {
    setItemBusy("new");
    setItemMsg("");
    try {
      const created = await geoSafeAPI.createInventoryItemAdmin({
        sku: newItem.sku.trim(),
        name: newItem.name.trim(),
        unit: newItem.unit.trim() || "unit",
        description: newItem.description.trim() || undefined,
        low_stock_threshold: parseThreshold(newItem.low_stock_threshold),
        is_active: newItem.is_active,
      });
      const nextItems = [...inventoryItems, created].sort((a, b) => a.name.localeCompare(b.name, "tr"));
      setInventoryItems(nextItems);
      setNewItem({
        sku: "",
        name: "",
        unit: "unit",
        description: "",
        low_stock_threshold: "",
        is_active: true,
      });
      if (selectedWarehouseId !== null) {
        setInventoryRows(buildInventoryRows(nextItems, warehouseInventory));
      }
      setItemMsg("Yeni stok kalemi eklendi.");
    } catch {
      setItemMsg("Stok kalemi eklenemedi.");
    } finally {
      setItemBusy(null);
    }
  };

  const saveInventoryItem = async (item: InventoryItemAdmin) => {
    setItemBusy(item.id);
    setItemMsg("");
    try {
      const updated = await geoSafeAPI.updateInventoryItemAdmin(item.id, {
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        description: item.description ?? "",
        low_stock_threshold: item.low_stock_threshold ?? null,
        is_active: item.is_active,
      });
      const nextItems = inventoryItems.map((row) => (row.id === updated.id ? updated : row));
      setInventoryItems(nextItems);
      if (selectedWarehouseId !== null) {
        setInventoryRows(buildInventoryRows(nextItems, warehouseInventory));
      }
      await loadWarehouseOverview();
      setItemMsg("Stok kalemi guncellendi.");
    } catch {
      setItemMsg("Stok kalemi guncellenemedi.");
    } finally {
      setItemBusy(null);
    }
  };

  const toggleInventoryItemActive = async (item: InventoryItemAdmin, isActive: boolean) => {
    setItemBusy(item.id);
    setItemMsg("");
    try {
      const updated = await geoSafeAPI.updateInventoryItemAdmin(item.id, { is_active: isActive });
      const nextItems = inventoryItems.map((row) => (row.id === updated.id ? updated : row));
      setInventoryItems(nextItems);
      if (selectedWarehouseId !== null) {
        setInventoryRows(buildInventoryRows(nextItems, warehouseInventory));
      }
      await loadWarehouseOverview();
      setItemMsg(isActive ? "Kalem tekrar aktif edildi." : "Kalem pasife alindi.");
    } catch {
      setItemMsg("Kalem durumu guncellenemedi.");
    } finally {
      setItemBusy(null);
    }
  };

  const deleteInventoryItem = async (itemId: number) => {
    setItemBusy(itemId);
    setItemMsg("");
    try {
      await geoSafeAPI.deleteInventoryItemAdmin(itemId);
      const nextItems = inventoryItems.filter((row) => row.id !== itemId);
      setInventoryItems(nextItems);
      if (selectedWarehouseId !== null) {
        setInventoryRows(buildInventoryRows(nextItems, warehouseInventory));
      }
      await loadWarehouseOverview();
      setItemMsg("Silme islemi tamamlandi.");
    } catch {
      setItemMsg("Silme islemi basarisiz.");
    } finally {
      setItemBusy(null);
    }
  };

  const loadSafeZones = useCallback(async () => {
    setSafeZonesLoading(true);
    try {
      setSafeZones(await geoSafeAPI.fetchAdminSafeZones());
    } finally {
      setSafeZonesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "safezones") {
      loadSafeZones();
    }
  }, [activeTab, loadSafeZones]);

  const selectZone = async (zoneId: number) => {
    setSelectedZoneId(zoneId);
    setZoneSaveMsg("");
    try {
      const inventory = await geoSafeAPI.fetchZoneInventory(zoneId);
      setZoneInventory(inventory);
      setZoneInventoryEdit({ ...inventory });
    } catch {
      setZoneInventory({});
      setZoneInventoryEdit({});
    }
  };

  const saveZoneInventory = async () => {
    if (selectedZoneId === null) {
      return;
    }
    setZoneSaveBusy(true);
    try {
      await geoSafeAPI.updateZoneInventory(selectedZoneId, zoneInventoryEdit as any);
      setZoneInventory(zoneInventoryEdit);
      setZoneSaveMsg("Alan envanteri guncellendi.");
    } catch {
      setZoneSaveMsg("Alan envanteri guncellenemedi.");
    } finally {
      setZoneSaveBusy(false);
    }
  };

  const loadEmergencies = useCallback(async () => {
    setEmergencyLoading(true);
    try {
      setEmergencies(await geoSafeAPI.fetchEmergenciesAdmin(emergencyFilter || undefined));
    } finally {
      setEmergencyLoading(false);
    }
  }, [emergencyFilter]);

  useEffect(() => {
    if (activeTab === "emergency") {
      loadEmergencies();
    }
  }, [activeTab, loadEmergencies]);

  const clearEmergencies = async () => {
    setClearingEmergencies(true);
    try {
      await geoSafeAPI.clearEmergencies();
      await loadEmergencies();
    } finally {
      setClearingEmergencies(false);
    }
  };

  const updateEmergencyStatus = async (id: number, status: string) => {
    await geoSafeAPI.updateEmergencyStatus(id, status);
    await loadEmergencies();
  };

  const loadVolunteers = useCallback(async () => {
    setVolunteerLoading(true);
    try {
      setVolunteers(await geoSafeAPI.fetchVolunteerApplicationsAdmin(volunteerFilter || undefined));
    } finally {
      setVolunteerLoading(false);
    }
  }, [volunteerFilter]);

  useEffect(() => {
    if (activeTab === "volunteers") {
      loadVolunteers();
    }
  }, [activeTab, loadVolunteers]);

  const updateVolunteerStatus = async (id: number, status: string) => {
    await geoSafeAPI.updateVolunteerStatus(id, status);
    await loadVolunteers();
  };

  const loadShelterOffers = useCallback(async () => {
    setShelterLoading(true);
    try {
      setShelterOffers(await geoSafeAPI.fetchShelterOffersAdmin(shelterFilter || undefined));
    } finally {
      setShelterLoading(false);
    }
  }, [shelterFilter]);

  useEffect(() => {
    if (activeTab === "shelters") {
      loadShelterOffers();
    }
  }, [activeTab, loadShelterOffers]);

  const updateShelterStatus = async (id: number, status: string) => {
    await geoSafeAPI.updateShelterStatus(id, status);
    await loadShelterOffers();
  };

  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === "active").length;
  const inactiveWarehouses = warehouses.filter((warehouse) => warehouse.status === "inactive").length;
  const riskyWarehouses = warehouses.filter((warehouse) => warehouse.status === "risky").length;
  const lowStockWarehouseCount = new Set(criticalStock.map((row) => row.warehouse_id)).size;
  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === selectedWarehouseId) ?? null;
  const selectedZone = safeZones.find((zone) => zone.id === selectedZoneId) ?? null;

  const TabBtn = ({ id, label }: { id: AdminTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: "9px 18px",
        background: activeTab === id ? "#1a237e" : "transparent",
        color: activeTab === id ? "#fff" : "#555",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: "system-ui, sans-serif" }}>
      <header
        style={{
          background: "linear-gradient(135deg,#1a237e,#283593)",
          color: "#fff",
          padding: "18px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>GeoSafe Admin Panel</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.88 }}>
            Depo, stok ve operasyon gorunurlugu
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={goHome}
            style={{
              background: "rgba(255,255,255,.15)",
              border: "1px solid rgba(255,255,255,.4)",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
            }}
          >
            Ana Sayfa
          </button>
          <button
            onClick={logout}
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cikis
          </button>
        </div>
      </header>

      <main style={{ padding: "24px 28px", maxWidth: 1360, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
          <SummaryCard label="Toplam Depo" value={warehouses.length} />
          <SummaryCard label="Aktif Depo" value={activeWarehouses} sub="active" />
          <SummaryCard label="Pasif Depo" value={inactiveWarehouses} sub="inactive" />
          <SummaryCard label="Riskli Depo" value={riskyWarehouses} sub="risky" />
          <SummaryCard label="Toplanma Alani" value={safeZoneCount} />
          <SummaryCard label="Kritik Stok Uyarisi" value={criticalStock.length} sub="kalem" warn />
          <SummaryCard label="Kritik Depo" value={lowStockWarehouseCount} sub="depo" warn />
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 20,
            background: "#e8e8e8",
            borderRadius: 10,
            padding: 4,
            width: "fit-content",
            flexWrap: "wrap",
          }}
        >
          <TabBtn id="warehouses" label="Depolar ve Stok" />
          <TabBtn id="safezones" label="Toplanma Alanlari" />
          <TabBtn id="emergency" label="Acil Bildirimler" />
          <TabBtn id="volunteers" label="Gonulluler" />
          <TabBtn id="shelters" label="Barinma Teklifleri" />
        </div>

        {activeTab === "warehouses" && (
          loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#666" }}>Yukleniyor...</div>
          ) : (
            <div style={{ display: "grid", gap: 20 }}>
              <SectionCard title="Kritik Stok Paneli">
                {criticalStock.length === 0 ? (
                  <div style={{ color: "#666" }}>Kritik stok kaydi bulunmuyor.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f5f5f5" }}>
                          <th style={TH}>Depo</th>
                          <th style={TH}>Kalem</th>
                          <th style={TH}>Mevcut</th>
                          <th style={TH}>Esik</th>
                          <th style={TH}>Oneri</th>
                        </tr>
                      </thead>
                      <tbody>
                        {criticalStock.map((row) => (
                          <tr key={`${row.warehouse_id}-${row.item_id}`}>
                            <td style={TD}>{row.warehouse_name}</td>
                            <td style={TD}>
                              <strong>{row.item_name}</strong>
                              <div style={{ color: "#777", fontSize: 12 }}>{row.item_sku}</div>
                            </td>
                            <td style={{ ...TD, color: "#C62828", fontWeight: 700 }}>
                              {row.quantity} {row.item_unit}
                            </td>
                            <td style={TD}>{row.threshold}</td>
                            <td style={{ ...TD, color: "#555" }}>{row.recommended_action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(360px, .9fr)", gap: 20 }}>
                <SectionCard title="Stok Kalemi Yonetimi">
                  <div style={{ display: "grid", gap: 12 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <input
                        value={newItem.sku}
                        onChange={(event) => setNewItem((state) => ({ ...state, sku: event.target.value }))}
                        placeholder="SKU"
                        style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                      />
                      <input
                        value={newItem.name}
                        onChange={(event) => setNewItem((state) => ({ ...state, name: event.target.value }))}
                        placeholder="Kalem adi"
                        style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                      />
                      <input
                        value={newItem.unit}
                        onChange={(event) => setNewItem((state) => ({ ...state, unit: event.target.value }))}
                        placeholder="Birim"
                        style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                      />
                      <input
                        value={newItem.low_stock_threshold}
                        onChange={(event) =>
                          setNewItem((state) => ({ ...state, low_stock_threshold: event.target.value }))
                        }
                        placeholder="Kritik esik"
                        style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                      />
                      <button
                        onClick={createInventoryItem}
                        disabled={itemBusy === "new" || !newItem.sku.trim() || !newItem.name.trim()}
                        style={{
                          background: "#1a237e",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {itemBusy === "new" ? "Ekleniyor..." : "Yeni Kalem"}
                      </button>
                    </div>
                    <input
                      value={newItem.description}
                      onChange={(event) => setNewItem((state) => ({ ...state, description: event.target.value }))}
                      placeholder="Aciklama"
                      style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
                    />
                    {itemMsg ? <div style={{ fontSize: 13, color: "#555" }}>{itemMsg}</div> : null}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f5f5f5" }}>
                            <th style={TH}>SKU</th>
                            <th style={TH}>Ad</th>
                            <th style={TH}>Birim</th>
                            <th style={TH}>Esik</th>
                            <th style={TH}>Durum</th>
                            <th style={TH}>Islem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryItems.map((item) => (
                            <tr key={item.id}>
                              <td style={TD}>
                                <input
                                  value={item.sku}
                                  onChange={(event) =>
                                    setInventoryItems((rows) =>
                                      rows.map((row) =>
                                        row.id === item.id ? { ...row, sku: event.target.value } : row
                                      )
                                    )
                                  }
                                  style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                                />
                              </td>
                              <td style={TD}>
                                <input
                                  value={item.name}
                                  onChange={(event) =>
                                    setInventoryItems((rows) =>
                                      rows.map((row) =>
                                        row.id === item.id ? { ...row, name: event.target.value } : row
                                      )
                                    )
                                  }
                                  style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                                />
                                <div style={{ color: "#777", fontSize: 12, marginTop: 4 }}>
                                  {item.description || "Aciklama yok"}
                                </div>
                              </td>
                              <td style={TD}>
                                <input
                                  value={item.unit}
                                  onChange={(event) =>
                                    setInventoryItems((rows) =>
                                      rows.map((row) =>
                                        row.id === item.id ? { ...row, unit: event.target.value } : row
                                      )
                                    )
                                  }
                                  style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                                />
                              </td>
                              <td style={TD}>
                                <input
                                  type="number"
                                  min={0}
                                  value={item.low_stock_threshold ?? ""}
                                  onChange={(event) =>
                                    setInventoryItems((rows) =>
                                      rows.map((row) =>
                                        row.id === item.id
                                          ? {
                                              ...row,
                                              low_stock_threshold:
                                                event.target.value === ""
                                                  ? null
                                                  : Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                                            }
                                          : row
                                      )
                                    )
                                  }
                                  style={{ width: 90, padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                                />
                              </td>
                              <td style={TD}>
                                <StatusBadge status={item.is_active ? "active" : "inactive"} />
                              </td>
                              <td style={TD}>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button
                                    onClick={() => saveInventoryItem(item)}
                                    disabled={itemBusy === item.id}
                                    style={{
                                      background: "#1a237e",
                                      color: "#fff",
                                      border: "none",
                                      borderRadius: 6,
                                      padding: "6px 10px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Kaydet
                                  </button>
                                  <button
                                    onClick={() => toggleInventoryItemActive(item, !item.is_active)}
                                    disabled={itemBusy === item.id}
                                    style={{
                                      background: "#FFF8E1",
                                      color: "#8D6E00",
                                      border: "1px solid #F9A825",
                                      borderRadius: 6,
                                      padding: "6px 10px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {item.is_active ? "Pasife Al" : "Aktif Et"}
                                  </button>
                                  <button
                                    onClick={() => deleteInventoryItem(item.id)}
                                    disabled={itemBusy === item.id}
                                    style={{
                                      background: "#fef2f2",
                                      color: "#b91c1c",
                                      border: "1px solid #fecaca",
                                      borderRadius: 6,
                                      padding: "6px 10px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Sil
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Depo Bazli Stok Guncelleme">
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gap: 8 }}>
                      {warehouses.map((warehouse) => {
                        const isSelected = warehouse.id === selectedWarehouseId;
                        const warehouseCriticalCount = criticalStock.filter(
                          (row) => row.warehouse_id === warehouse.id
                        ).length;
                        return (
                          <button
                            key={warehouse.id}
                            onClick={() => selectWarehouse(warehouse.id)}
                            style={{
                              textAlign: "left",
                              padding: "10px 12px",
                              borderRadius: 8,
                              border: `1px solid ${isSelected ? "#1a237e" : "#ddd"}`,
                              background: isSelected ? "#EEF2FF" : "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                              <strong>{warehouse.name}</strong>
                              <StatusBadge status={warehouse.status} />
                            </div>
                            <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                              {warehouse.address || "Adres yok"}
                            </div>
                            <div style={{ color: warehouseCriticalCount > 0 ? "#C62828" : "#666", fontSize: 12, marginTop: 4 }}>
                              {warehouseCriticalCount > 0
                                ? `${warehouseCriticalCount} kritik kalem`
                                : "Kritik kayit yok"}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {selectedWarehouseId === null ? (
                      <div style={{ color: "#666" }}>Guncellemek icin bir depo secin.</div>
                    ) : inventoryLoading ? (
                      <div style={{ color: "#666" }}>Depo stogu yukleniyor...</div>
                    ) : (
                      <div style={{ display: "grid", gap: 12 }}>
                        <div>
                          <strong>{selectedWarehouse?.name}</strong>
                          <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                            Tum aktif stok kalemleri listelenir. Sifir deger yeni kayit olusturabilir.
                          </div>
                        </div>
                        <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
                          {inventoryRows.map((row, index) => (
                            <div
                              key={row.item_id}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 110px 64px",
                                gap: 10,
                                alignItems: "center",
                                padding: "8px 0",
                                borderTop: index === 0 ? "none" : "1px solid #eee",
                              }}
                            >
                              <label style={{ fontSize: 13, color: "#333" }}>
                                {row.item_name}
                                <div style={{ color: "#777", fontSize: 12 }}>{row.originalQuantity} mevcut</div>
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={row.quantity}
                                onChange={(event) =>
                                  setInventoryRows((rows) =>
                                    rows.map((current) =>
                                      current.item_id === row.item_id
                                        ? {
                                            ...current,
                                            quantity: Math.max(
                                              0,
                                              Number.parseInt(event.target.value, 10) || 0
                                            ),
                                          }
                                        : current
                                    )
                                  )
                                }
                                style={{ padding: "7px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                              />
                              <span style={{ fontSize: 12, color: "#777" }}>{row.item_unit}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <button
                            onClick={saveWarehouseInventory}
                            disabled={saveBusy}
                            style={{
                              background: "#1a237e",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              padding: "8px 18px",
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            {saveBusy ? "Kaydediliyor..." : "Stok Kaydet"}
                          </button>
                          {saveMsg ? <span style={{ fontSize: 13, color: "#555" }}>{saveMsg}</span> : null}
                        </div>
                      </div>
                    )}
                  </div>
                </SectionCard>
              </div>

              <SectionCard title="Stok Hareket Gecmisi">
                {movementHistory.length === 0 ? (
                  <div style={{ color: "#666" }}>Stok hareketi bulunmuyor.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#f5f5f5" }}>
                          <th style={TH}>Tarih</th>
                          <th style={TH}>Depo</th>
                          <th style={TH}>Kalem</th>
                          <th style={TH}>Degisim</th>
                          <th style={TH}>Eski / Yeni</th>
                          <th style={TH}>Tip</th>
                          <th style={TH}>Not</th>
                          <th style={TH}>Actor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movementHistory.slice(0, 30).map((movement) => (
                          <tr key={movement.id}>
                            <td style={TD}>{new Date(movement.created_at).toLocaleString("tr-TR")}</td>
                            <td style={TD}>{movement.warehouse_name || "-"}</td>
                            <td style={TD}>
                              <strong>{movement.item_name}</strong>
                              <div style={{ color: "#777", fontSize: 12 }}>{movement.item_sku}</div>
                            </td>
                            <td style={{ ...TD, color: movement.quantity_change < 0 ? "#C62828" : "#2E7D32", fontWeight: 700 }}>
                              {movement.quantity_change > 0 ? "+" : ""}
                              {movement.quantity_change}
                            </td>
                            <td style={TD}>
                              {movement.old_quantity ?? "-"} / {movement.new_quantity ?? "-"}
                            </td>
                            <td style={TD}>{movement.movement_type}</td>
                            <td style={TD}>{movement.note || "-"}</td>
                            <td style={TD}>
                              {movement.actor_name ? `${movement.actor_name} (${movement.actor_role || "-"})` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )
        )}

        {activeTab === "safezones" && (
          safeZonesLoading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#666" }}>Yukleniyor...</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: selectedZoneId ? "1fr 360px" : "1fr", gap: 20 }}>
              <SectionCard title="Toplanma Alani Listesi">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={TH}>Isim</th>
                      <th style={TH}>Kapasite</th>
                      <th style={TH}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeZones.map((zone) => (
                      <tr
                        key={zone.id}
                        onClick={() => selectZone(zone.id)}
                        style={{
                          cursor: "pointer",
                          background: zone.id === selectedZoneId ? "#EEF2FF" : "#fff",
                        }}
                      >
                        <td style={TD}>{zone.name}</td>
                        <td style={TD}>{zone.capacity ?? "-"} kisi</td>
                        <td style={TD}>
                          <StatusBadge status={zone.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>

              {selectedZoneId !== null ? (
                <SectionCard title={selectedZone?.name || "Alan Envanteri"}>
                  <div style={{ display: "grid", gap: 10 }}>
                    {(["water", "food", "med", "blanket", "ext"] as string[]).map((key) => (
                      <div key={key} style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10, alignItems: "center" }}>
                        <label style={{ fontSize: 13, color: "#444" }}>{key}</label>
                        <input
                          type={key === "blanket" || key === "ext" ? "number" : "text"}
                          value={String(zoneInventoryEdit[key] ?? zoneInventory[key] ?? "")}
                          onChange={(event) =>
                            setZoneInventoryEdit((state) => ({
                              ...state,
                              [key]:
                                key === "blanket" || key === "ext"
                                  ? Number.parseInt(event.target.value, 10) || 0
                                  : event.target.value,
                            }))
                          }
                          style={{ padding: "7px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                        />
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                      <button
                        onClick={saveZoneInventory}
                        disabled={zoneSaveBusy}
                        style={{
                          background: "#1a237e",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "8px 18px",
                          cursor: "pointer",
                        }}
                      >
                        {zoneSaveBusy ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                      {zoneSaveMsg ? <span style={{ fontSize: 13 }}>{zoneSaveMsg}</span> : null}
                    </div>
                  </div>
                </SectionCard>
              ) : null}
            </div>
          )
        )}

        {activeTab === "emergency" && (
          <SectionCard
            title="Acil Bildirimler"
            action={
              <div style={{ display: "flex", gap: 10 }}>
                <select
                  value={emergencyFilter}
                  onChange={(event) => setEmergencyFilter(event.target.value)}
                  style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                >
                  <option value="">Tumu</option>
                  <option value="new">New</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="spam">Spam</option>
                </select>
                <button
                  onClick={clearEmergencies}
                  disabled={clearingEmergencies}
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#dc2626",
                    borderRadius: 6,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {clearingEmergencies ? "Temizleniyor..." : "Gecmisi Temizle"}
                </button>
              </div>
            }
          >
            {emergencyLoading ? (
              <div style={{ color: "#666" }}>Yukleniyor...</div>
            ) : emergencies.length === 0 ? (
              <div style={{ color: "#666" }}>Kayit bulunamadi.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={TH}>#</th>
                      <th style={TH}>Durum</th>
                      <th style={TH}>Saat</th>
                      <th style={TH}>Konum</th>
                      <th style={TH}>Harita</th>
                      <th style={TH}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emergencies.map((emergency) => (
                      <tr key={emergency.id}>
                        <td style={TD}>{emergency.id}</td>
                        <td style={TD}>{emergency.durum}</td>
                        <td style={TD}>{emergency.saat}</td>
                        <td style={TD}>
                          {emergency.enlem != null && emergency.boylam != null
                            ? `${Number(emergency.enlem).toFixed(4)}, ${Number(emergency.boylam).toFixed(4)}`
                            : "-"}
                        </td>
                        <td style={TD}>
                          {emergency.harita_link ? (
                            <a href={emergency.harita_link} target="_blank" rel="noreferrer">
                              Haritada Gor
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td style={TD}>
                          <select
                            value={emergency.status}
                            onChange={(event) => updateEmergencyStatus(emergency.id, event.target.value)}
                            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                          >
                            <option value="new">New</option>
                            <option value="reviewing">Reviewing</option>
                            <option value="resolved">Resolved</option>
                            <option value="dismissed">Dismissed</option>
                            <option value="spam">Spam</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {activeTab === "volunteers" && (
          <SectionCard
            title="Gonullu Basvurulari"
            action={
              <select
                value={volunteerFilter}
                onChange={(event) => setVolunteerFilter(event.target.value)}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
              >
                <option value="">Tumu</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="inactive">Inactive</option>
              </select>
            }
          >
            {volunteerLoading ? (
              <div style={{ color: "#666" }}>Yukleniyor...</div>
            ) : volunteers.length === 0 ? (
              <div style={{ color: "#666" }}>Kayit bulunamadi.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={TH}>Ad Soyad</th>
                      <th style={TH}>Ilce / Mahalle</th>
                      <th style={TH}>Beceriler</th>
                      <th style={TH}>Musaitlik</th>
                      <th style={TH}>Iletisim</th>
                      <th style={TH}>Tarih</th>
                      <th style={TH}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {volunteers.map((volunteer) => (
                      <tr key={volunteer.id}>
                        <td style={TD}>{volunteer.full_name}</td>
                        <td style={TD}>{[volunteer.district, volunteer.neighborhood].filter(Boolean).join(" / ") || "-"}</td>
                        <td style={TD}>{volunteer.skills?.join(", ") || "-"}</td>
                        <td style={TD}>{volunteer.availability_note || "-"}</td>
                        <td style={TD}>{volunteer.contact_info}</td>
                        <td style={TD}>
                          {volunteer.created_at ? new Date(volunteer.created_at).toLocaleString("tr-TR") : "-"}
                        </td>
                        <td style={TD}>
                          <select
                            value={volunteer.status}
                            onChange={(event) => updateVolunteerStatus(volunteer.id, event.target.value)}
                            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}

        {activeTab === "shelters" && (
          <SectionCard
            title="Barinma Teklifleri"
            action={
              <select
                value={shelterFilter}
                onChange={(event) => setShelterFilter(event.target.value)}
                style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
              >
                <option value="">Tumu</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="inactive">Inactive</option>
              </select>
            }
          >
            {shelterLoading ? (
              <div style={{ color: "#666" }}>Yukleniyor...</div>
            ) : shelterOffers.length === 0 ? (
              <div style={{ color: "#666" }}>Kayit bulunamadi.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={TH}>Ev Sahibi</th>
                      <th style={TH}>Konum</th>
                      <th style={TH}>Kapasite</th>
                      <th style={TH}>Tarih</th>
                      <th style={TH}>Adres Detayi</th>
                      <th style={TH}>Iletisim</th>
                      <th style={TH}>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shelterOffers.map((offer) => (
                      <tr key={offer.id}>
                        <td style={TD}>{offer.host_name}</td>
                        <td style={TD}>{[offer.city, offer.district, offer.neighborhood].filter(Boolean).join(" / ") || "-"}</td>
                        <td style={TD}>{offer.capacity}</td>
                        <td style={TD}>
                          {offer.available_from || offer.available_until
                            ? `${offer.available_from || "?"} - ${offer.available_until || "?"}`
                            : offer.duration_note || "-"}
                        </td>
                        <td style={TD}>{offer.address_detail || "-"}</td>
                        <td style={TD}>{offer.contact_info}</td>
                        <td style={TD}>
                          <select
                            value={offer.status}
                            onChange={(event) => updateShelterStatus(offer.id, event.target.value)}
                            style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc" }}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}
      </main>
    </div>
  );
}
