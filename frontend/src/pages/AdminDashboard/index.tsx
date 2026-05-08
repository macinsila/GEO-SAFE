import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI } from "../../services";
import { EmergencyRecord } from "../../services/api";
import { SafeZone, Warehouse, WarehouseInventoryData, WarehouseInventoryItem } from "../../types";

// ── types ────────────────────────────────────────────────────────────────────
type AdminTab = "warehouses" | "safezones" | "emergency";

// ── helpers ───────────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, React.CSSProperties> = {
  active:      { background: "#2E7D32", color: "#fff" },
  inactive:    { background: "#616161", color: "#fff" },
  risky:       { background: "#C62828", color: "#fff" },
  maintenance: { background: "#E65100", color: "#fff" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { background: "#9E9E9E", color: "#fff" };
  return <span style={{ ...s, padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{status}</span>;
}

function FillBar({ pct, lowStock }: { pct: number; lowStock: boolean }) {
  const color = pct < 20 ? "#C62828" : pct < 50 ? "#F9A825" : "#2E7D32";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, background: "#e0e0e0", borderRadius: 4, height: 10, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, background: color, height: "100%", transition: "width .3s" }} />
      </div>
      <span style={{ fontSize: 12, width: 44, textAlign: "right", color: lowStock ? "#C62828" : "#444", fontWeight: lowStock ? 700 : 400 }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function SummaryCard({ label, value, sub, warn }: { label: string; value: number; sub?: string; warn?: boolean }) {
  return (
    <div style={{ background: warn && value > 0 ? "#FFF8E1" : "#fff", border: `1px solid ${warn && value > 0 ? "#F9A825" : "#e0e0e0"}`, borderRadius: 8, padding: "16px 20px", flex: "1 1 160px", boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 28, fontWeight: 700, color: warn && value > 0 ? "#E65100" : "#1a237e" }}>{value}</div>
      <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const TH: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: "#555", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "10px 16px", verticalAlign: "middle" };

// ── AdminDashboard ─────────────────────────────────────────────────────────────
interface Props { onNavigateToMap?: () => void }

export default function AdminDashboard({ onNavigateToMap }: Props) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const goHome = onNavigateToMap ?? (() => navigate("/"));

  const [activeTab, setActiveTab] = useState<AdminTab>("warehouses");

  // ── Warehouse state ──
  const [warehouses, setWarehouses]   = useState<Warehouse[]>([]);
  const [safeZoneCount, setSzCount]   = useState(0);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [inventory, setInventory]     = useState<WarehouseInventoryData | null>(null);
  const [editRows, setEditRows]       = useState<{ item_id: number; item_name: string; item_unit: string; quantity: number }[]>([]);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState("");
  const [loading, setLoading]         = useState(true);
  const [invLoading, setInvLoading]   = useState(false);
  const [fillMap, setFillMap]         = useState<Record<number, number>>({});
  const [lowStockWh, setLowStockWh]   = useState<Set<number>>(new Set());

  // ── SafeZone state ──
  const [safeZones, setSafeZones]     = useState<SafeZone[]>([]);
  const [szLoading, setSzLoading]     = useState(false);
  const [selZoneId, setSelZoneId]     = useState<number | null>(null);
  const [, setZoneInv]                 = useState<Record<string, unknown>>({});
  const [zoneInvEdit, setZoneInvEdit] = useState<Record<string, unknown>>({});
  const [zoneSaving, setZoneSaving]   = useState(false);
  const [zoneSaveMsg, setZoneSaveMsg] = useState("");

  // ── Emergency state ──
  const [emergencies, setEmergencies] = useState<EmergencyRecord[]>([]);
  const [emLoading, setEmLoading]     = useState(false);
  const [clearing, setClearing]       = useState(false);

  // ── load warehouses ──
  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const [whs, szc] = await Promise.all([geoSafeAPI.fetchWarehouses(), geoSafeAPI.fetchSafeZoneCount()]);
      setWarehouses(whs);
      setSzCount(szc);
      const active = whs.filter(w => w.status === "active");
      const invs   = await Promise.all(active.map(w => geoSafeAPI.fetchWarehouseInventory(w.id).catch(() => null)));
      const fill: Record<number, number> = {};
      const low = new Set<number>();
      invs.forEach((inv, i) => {
        if (!inv) return;
        const wh = active[i];
        fill[wh.id] = Math.min(inv.items.reduce((s, it) => s + it.quantity, 0) / (inv.capacity || 1) * 100, 100);
        if (inv.items.some(it => it.low_stock)) low.add(wh.id);
      });
      setFillMap(fill);
      setLowStockWh(low);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadWarehouses(); }, [loadWarehouses]);

  // ── select warehouse ──
  const selectWarehouse = async (id: number) => {
    setSelectedId(id); setSaveMsg(""); setInvLoading(true);
    try {
      const inv = await geoSafeAPI.fetchWarehouseInventory(id);
      setInventory(inv);
      setEditRows(inv.items.map(it => ({ item_id: it.item_id, item_name: it.item_name, item_unit: it.item_unit, quantity: it.quantity })));
    } catch { setInventory(null); }
    finally { setInvLoading(false); }
  };

  const handleSave = async () => {
    if (selectedId === null) return;
    setSaving(true); setSaveMsg("");
    try {
      await geoSafeAPI.updateWarehouseInventory(selectedId, editRows.map(r => ({ item_id: r.item_id, quantity: r.quantity })));
      setSaveMsg("✅ Kaydedildi");
      await Promise.all([selectWarehouse(selectedId), loadWarehouses()]);
    } catch { setSaveMsg("❌ Kaydetme hatası"); }
    finally { setSaving(false); }
  };

  // ── load safe zones ──
  const loadSafeZones = useCallback(async () => {
    setSzLoading(true);
    try { setSafeZones(await geoSafeAPI.fetchSafeZones()); }
    catch { /* ignore */ }
    finally { setSzLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "safezones") loadSafeZones(); }, [activeTab, loadSafeZones]);

  const selectZone = async (id: number) => {
    setSelZoneId(id); setZoneSaveMsg("");
    try {
      const inv = await geoSafeAPI.fetchZoneInventory(id);
      setZoneInv(inv);
      setZoneInvEdit({ ...inv });
    } catch { setZoneInv({}); setZoneInvEdit({}); }
  };

  const saveZoneInventory = async () => {
    if (selZoneId === null) return;
    setZoneSaving(true);
    try {
      await geoSafeAPI.updateZoneInventory(selZoneId, zoneInvEdit as any);
      setZoneSaveMsg("✅ Kaydedildi");
      setTimeout(() => setZoneSaveMsg(""), 3000);
    } catch { setZoneSaveMsg("❌ Hata"); }
    finally { setZoneSaving(false); }
  };

  // ── load emergencies ──
  const loadEmergencies = useCallback(async () => {
    setEmLoading(true);
    try { setEmergencies(await geoSafeAPI.fetchEmergencies()); }
    catch { /* ignore */ }
    finally { setEmLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "emergency") loadEmergencies(); }, [activeTab, loadEmergencies]);

  const clearEmergencies = async () => {
    setClearing(true);
    try { await geoSafeAPI.clearEmergencies(); await loadEmergencies(); }
    catch { /* ignore */ }
    finally { setClearing(false); }
  };

  // ── summary ──
  const active   = warehouses.filter(w => w.status === "active").length;
  const inactive = warehouses.filter(w => w.status === "inactive").length;
  const risky    = warehouses.filter(w => w.status === "risky").length;
  const lowCount = lowStockWh.size;
  const selectedWarehouse = warehouses.find(w => w.id === selectedId);
  const selectedZone      = safeZones.find(z => z.id === selZoneId);

  // ── tab button helper ──
  const TabBtn = ({ id, label }: { id: AdminTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{ padding: "9px 22px", background: activeTab === id ? "#1a237e" : "transparent", color: activeTab === id ? "#fff" : "#555", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: "inherit", transition: "all .15s" }}
    >{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", fontFamily: "system-ui,sans-serif" }}>
      {/* header */}
      <header style={{ background: "linear-gradient(135deg,#1a237e,#283593)", color: "#fff", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🛡️ GeoSafe — Admin Panel</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: .85 }}>Depo, toplanma alanı ve acil bildirim yönetimi</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={goHome} style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.4)", color: "#fff", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
            ← Ana Sayfa
          </button>
          <button onClick={logout} style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600, fontFamily: "inherit" }}>
            Çıkış
          </button>
        </div>
      </header>

      <main style={{ padding: "24px 28px", maxWidth: 1300, margin: "0 auto" }}>
        {/* summary cards */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 24 }}>
          <SummaryCard label="Toplam Depo"           value={warehouses.length} />
          <SummaryCard label="Aktif Depo"            value={active}   sub="active"   />
          <SummaryCard label="Pasif Depo"            value={inactive} sub="inactive" />
          <SummaryCard label="Riskli Depo"           value={risky}    sub="risky"    />
          <SummaryCard label="Toplanma Alanı"        value={safeZoneCount} />
          <SummaryCard label="Düşük Stok Uyarısı"   value={lowCount} sub="stok < %20" warn />
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#e8e8e8", borderRadius: 10, padding: 4, width: "fit-content" }}>
          <TabBtn id="warehouses" label="📦 Depolar" />
          <TabBtn id="safezones"  label="🏕️ Toplanma Alanları" />
          <TabBtn id="emergency"  label="🚨 Acil Bildirimler" />
        </div>

        {/* ── TAB: WAREHOUSES ── */}
        {activeTab === "warehouses" && (
          loading ? <div style={{ textAlign: "center", padding: 60, color: "#666" }}>Yükleniyor…</div> : (
            <div style={{ display: "grid", gridTemplateColumns: selectedId ? "1fr 380px" : "1fr", gap: 20 }}>
              <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #e0e0e0", fontWeight: 600, fontSize: 15, color: "#1a237e" }}>Depo Listesi</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead><tr style={{ background: "#f5f5f5" }}>
                      {["İsim","Adres","Durum","Doluluk"].map(h => <th key={h} style={TH}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {warehouses.map(wh => {
                        const isLow = lowStockWh.has(wh.id);
                        const fill  = fillMap[wh.id] ?? 0;
                        const isSel = wh.id === selectedId;
                        return (
                          <tr key={wh.id} onClick={() => selectWarehouse(wh.id)} style={{ cursor: "pointer", background: isSel ? "#e8eaf6" : isLow ? "#FFF8E1" : "transparent", borderBottom: "1px solid #eee" }}
                            onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "#f3f4ff"; }}
                            onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = isLow ? "#FFF8E1" : "transparent"; }}>
                            <td style={TD}>{isLow && <span title="Düşük stok" style={{ marginRight: 4 }}>⚠️</span>}{wh.name}</td>
                            <td style={{ ...TD, color: "#666", fontSize: 12 }}>{wh.address ?? "—"}</td>
                            <td style={TD}><StatusBadge status={wh.status} /></td>
                            <td style={{ ...TD, minWidth: 140 }}>
                              {wh.status === "active" ? <FillBar pct={fill} lowStock={isLow} /> : <span style={{ color: "#aaa", fontSize: 12 }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedId && (
                <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #e0e0e0", fontWeight: 600, fontSize: 15, color: "#1a237e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>📦 {selectedWarehouse?.name}</span>
                    <button onClick={() => { setSelectedId(null); setInventory(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
                  </div>
                  <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
                    {invLoading ? (
                      <div style={{ textAlign: "center", color: "#999", padding: 30 }}>Yükleniyor…</div>
                    ) : !inventory || inventory.items.length === 0 ? (
                      <div style={{ color: "#aaa", padding: 20, textAlign: "center" }}>Envanter kaydı yok.</div>
                    ) : (
                      <>
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 10 }}>Mevcut Envanter</div>
                          {inventory.items.map((it: WarehouseInventoryItem) => (
                            <div key={it.id} style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 6, background: it.low_stock ? "#FFF8E1" : "#f9f9f9", border: `1px solid ${it.low_stock ? "#FFCA28" : "#eee"}` }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                                <span style={{ fontWeight: 500 }}>{it.item_name}</span>
                                <span style={{ color: "#666" }}>{it.quantity} {it.item_unit}</span>
                              </div>
                              <FillBar pct={it.capacity_pct} lowStock={it.low_stock} />
                              {it.low_stock && <div style={{ fontSize: 11, color: "#E65100", marginTop: 3 }}>⚠️ Düşük stok</div>}
                            </div>
                          ))}
                        </div>
                        <div style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 10 }}>Hızlı Güncelleme</div>
                          {editRows.map((row, i) => (
                            <div key={row.item_id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <label style={{ flex: 1, fontSize: 13, color: "#444" }}>{row.item_name}</label>
                              <input type="number" min={0} value={row.quantity}
                                onChange={e => { const v = Math.max(0, parseInt(e.target.value) || 0); setEditRows(rows => rows.map((r, idx) => idx === i ? { ...r, quantity: v } : r)); }}
                                style={{ width: 90, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13 }} />
                              <span style={{ fontSize: 12, color: "#888", width: 40 }}>{row.item_unit}</span>
                            </div>
                          ))}
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                            <button onClick={handleSave} disabled={saving} style={{ background: "#1a237e", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", cursor: saving ? "not-allowed" : "pointer", fontSize: 14, opacity: saving ? .7 : 1, fontFamily: "inherit" }}>
                              {saving ? "Kaydediliyor…" : "Kaydet"}
                            </button>
                            {saveMsg && <span style={{ fontSize: 13 }}>{saveMsg}</span>}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ── TAB: SAFE ZONES ── */}
        {activeTab === "safezones" && (
          szLoading ? <div style={{ textAlign: "center", padding: 60, color: "#666" }}>Yükleniyor…</div> : (
            <div style={{ display: "grid", gridTemplateColumns: selZoneId ? "1fr 360px" : "1fr", gap: 20 }}>
              <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #e0e0e0", fontWeight: 600, fontSize: 15, color: "#1a237e" }}>Toplanma Alanı Listesi</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead><tr style={{ background: "#f5f5f5" }}>
                    {["İsim","Kapasite","Durum"].map(h => <th key={h} style={TH}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {safeZones.map(z => (
                      <tr key={z.id} onClick={() => selectZone(z.id)} style={{ cursor: "pointer", background: z.id === selZoneId ? "#e8eaf6" : "transparent", borderBottom: "1px solid #eee" }}
                        onMouseEnter={e => { if (z.id !== selZoneId) (e.currentTarget as HTMLElement).style.background = "#f3f4ff"; }}
                        onMouseLeave={e => { if (z.id !== selZoneId) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                        <td style={TD}>{z.name}</td>
                        <td style={TD}>{z.capacity ?? "—"} kişi</td>
                        <td style={TD}><StatusBadge status={z.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selZoneId && (
                <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #e0e0e0", fontWeight: 600, fontSize: 15, color: "#1a237e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>🏕️ {selectedZone?.name}</span>
                    <button onClick={() => setSelZoneId(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999" }}>✕</button>
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 10 }}>Envanter Güncelle</div>
                    {(["water","food","med","blanket","ext"] as string[]).map(k => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <label style={{ flex: 1, fontSize: 13, color: "#444" }}>
                          {k === "water" ? "💧 Su" : k === "food" ? "🥫 Gıda" : k === "med" ? "🩹 Tıbbi" : k === "blanket" ? "🧣 Battaniye (adet)" : "🧯 Yangın Tüpü (adet)"}
                        </label>
                        <input
                          type={k === "blanket" || k === "ext" ? "number" : "text"}
                          value={String((zoneInvEdit as Record<string,unknown>)[k] ?? "")}
                          onChange={e => setZoneInvEdit(f => ({ ...f, [k]: k === "blanket" || k === "ext" ? parseInt(e.target.value) || 0 : e.target.value }))}
                          style={{ width: 110, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13 }}
                        />
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                      <button onClick={saveZoneInventory} disabled={zoneSaving} style={{ background: "#1a237e", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", cursor: zoneSaving ? "not-allowed" : "pointer", fontSize: 14, fontFamily: "inherit" }}>
                        {zoneSaving ? "Kaydediliyor…" : "Kaydet"}
                      </button>
                      {zoneSaveMsg && <span style={{ fontSize: 13 }}>{zoneSaveMsg}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* ── TAB: EMERGENCY ── */}
        {activeTab === "emergency" && (
          <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,.08)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: "#1a237e" }}>🚨 Acil Bildirimler</span>
              <button onClick={clearEmergencies} disabled={clearing} style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 6, padding: "6px 16px", cursor: clearing ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>
                {clearing ? "Temizleniyor…" : "Geçmişi Temizle"}
              </button>
            </div>
            {emLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#666" }}>Yükleniyor…</div>
            ) : emergencies.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#aaa" }}>Henüz acil bildirim yok.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead><tr style={{ background: "#f5f5f5" }}>
                    {["#","Durum","Saat","Konum","Harita"].map(h => <th key={h} style={TH}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {emergencies.map((em, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={TD}>{i + 1}</td>
                        <td style={{ ...TD, fontWeight: 600, color: "#b91c1c" }}>{em.durum}</td>
                        <td style={{ ...TD, fontSize: 12, color: "#666" }}>{em.saat}</td>
                        <td style={{ ...TD, fontSize: 12 }}>
                          {em.enlem != null ? `${Number(em.enlem).toFixed(4)}, ${Number(em.boylam).toFixed(4)}` : "—"}
                        </td>
                        <td style={TD}>
                          {em.harita_link ? (
                            <a href={em.harita_link} target="_blank" rel="noreferrer" style={{ color: "#1a237e", fontSize: 12, fontWeight: 600 }}>Haritada Gör →</a>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
