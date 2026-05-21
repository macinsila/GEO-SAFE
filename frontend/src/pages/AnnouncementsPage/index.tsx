import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { geoSafeAPI } from "../../services";
import { Announcement } from "../../types";

const CACHE_KEY = "geosafe_announcements_v1";

interface AnnouncementCache {
  items: Announcement[];
  cachedAt: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  critical: "Kritik",
  high: "Acil",
  normal: "Önemli",
  low: "Normal",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#b71c1c",
  high: "#e65100",
  normal: "#1565c0",
  low: "#616161",
};

const KATEGORI_LABELS: Record<string, string> = {
  genel: "Genel",
  uyari: "Uyarı",
  tahliye: "Tahliye",
  saglik: "Sağlık",
  lojistik: "Lojistik",
  guvenlik: "Güvenlik",
};

function loadCache(): AnnouncementCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AnnouncementCache;
  } catch {
    return null;
  }
}

function saveCache(items: Announcement[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ items, cachedAt: new Date().toISOString() }));
  } catch {
    // localStorage may be unavailable (private mode, full storage) — fail silently
  }
}

function cacheAge(cachedAt: string): string {
  const diffMs = Date.now() - new Date(cachedAt).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "az önce";
  if (hours === 1) return "1 saat önce";
  return `${hours} saat önce`;
}

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [cacheTime, setCacheTime] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [kategoriFilter, setKategoriFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const items = await geoSafeAPI.fetchAnnouncements();
        setAnnouncements(items);
        setIsOffline(false);
        setCacheTime(null);
        saveCache(items);
      } catch {
        const cache = loadCache();
        if (cache) {
          setAnnouncements(cache.items);
          setIsOffline(true);
          setCacheTime(cache.cachedAt);
        } else {
          setAnnouncements([]);
          setIsOffline(true);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const filtered = announcements.filter((a) => {
    if (priorityFilter && a.priority !== priorityFilter) return false;
    if (kategoriFilter && a.kategori !== kategoriFilter) return false;
    return true;
  });

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{ background: "#1a237e", color: "#fff", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          ← Ana Sayfa
        </button>
        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>Duyurular</span>
        {isOffline && (
          <span style={{ marginLeft: "auto", background: "#ffa000", color: "#fff", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
            Çevrimdışı {cacheTime ? `— ${cacheAge(cacheTime)} güncellendi` : ""}
          </span>
        )}
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {/* Priority filter */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {[{ value: "", label: "Tümü" }, { value: "critical", label: "Kritik" }, { value: "high", label: "Acil" }, { value: "normal", label: "Önemli" }, { value: "low", label: "Normal" }].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPriorityFilter(opt.value)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  background: priorityFilter === opt.value ? "#1a237e" : "#e8ecf0",
                  color: priorityFilter === opt.value ? "#fff" : "#555",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <select
            value={kategoriFilter}
            onChange={(e) => setKategoriFilter(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 13, cursor: "pointer", marginLeft: "auto" }}
          >
            <option value="">Tüm Kategoriler</option>
            {Object.entries(KATEGORI_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#888" }}>Yükleniyor...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#888" }}>
            {announcements.length === 0 ? "Henüz duyuru yok." : "Bu filtreye uyan duyuru bulunamadı."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((ann) => {
              const color = PRIORITY_COLORS[ann.priority] ?? "#1565c0";
              const isExp = expanded.has(ann.id);
              const contentShort = ann.content.length > 200 ? ann.content.slice(0, 200) + "…" : ann.content;

              return (
                <div
                  key={ann.id}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    boxShadow: "0 2px 8px rgba(0,0,0,.08)",
                    display: "flex",
                    overflow: "hidden",
                  }}
                >
                  {/* Priority strip */}
                  <div style={{ width: 6, background: color, flexShrink: 0 }} />

                  <div style={{ padding: "16px 18px", flex: 1 }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ background: color, color: "#fff", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                        {PRIORITY_LABELS[ann.priority] ?? ann.priority}
                      </span>
                      {ann.kategori && (
                        <span style={{ background: "#e8ecf0", color: "#444", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                          {KATEGORI_LABELS[ann.kategori] ?? ann.kategori}
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "#999" }}>
                        {ann.published_at
                          ? new Date(ann.published_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })
                          : new Date(ann.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })}
                      </span>
                    </div>

                    <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#1a237e" }}>{ann.title}</h3>

                    <p style={{ margin: 0, fontSize: 14, color: "#444", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {isExp ? ann.content : contentShort}
                    </p>

                    {ann.content.length > 200 && (
                      <button
                        onClick={() => toggleExpand(ann.id)}
                        style={{ background: "none", border: "none", color: "#1565c0", cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "4px 0", marginTop: 4 }}
                      >
                        {isExp ? "Daha Az Göster" : "Devamını Gör"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
