import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI, EarthquakeItem } from "../../services";
import { Map } from "../../components";
import {
  Announcement,
  CriticalStockRecord,
  EmergencyAdminRecord,
  EmergencyPayload,
  MapClickEvent,
  SafeZone,
  Warehouse,
} from "../../types";

const ANN_CACHE_KEY = "geosafe_announcements_v1";

function loadAnnouncementCache(): Announcement[] {
  try {
    const raw = localStorage.getItem(ANN_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { items: Announcement[] };
    return parsed.items ?? [];
  } catch {
    return [];
  }
}

function saveAnnouncementCache(items: Announcement[]) {
  try {
    localStorage.setItem(ANN_CACHE_KEY, JSON.stringify({ items, cachedAt: new Date().toISOString() }));
  } catch { /* ignore */ }
}

const ANN_PRIORITY_COLORS: Record<string, string> = {
  critical: "#b71c1c",
  high: "#e65100",
  normal: "#1565c0",
  low: "#616161",
};

const ANN_PRIORITY_LABELS: Record<string, string> = {
  critical: "Kritik",
  high: "Acil",
  normal: "Önemli",
  low: "Normal",
};

interface Profile {
  name?: string;
  blood?: string;
  chronic?: string;
  meds?: string;
  allergy?: string;
  phone?: string;
}

type Tone = "safe" | "warning" | "critical" | "info" | "neutral";
type NavItem = {
  label: string;
  icon: string;
  sectionId?: string;
  adminOnly?: boolean;
  path?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Panel", icon: "D", sectionId: "dashboard" },
  { label: "Harita", icon: "M", sectionId: "map-intelligence" },
  { label: "Barınma Alanları", icon: "S", sectionId: "shelter-zones" },
  { label: "Lojistik", icon: "L", sectionId: "logistics" },
  { label: "Envanter", icon: "I", sectionId: "inventory" },
  { label: "Uyarılar", icon: "A", sectionId: "alerts" },
  { label: "Yönetim", icon: "R", adminOnly: true },
  { label: "Raporlar", icon: "P", sectionId: "reports" },
  { label: "QR Kimlik", icon: "Q", path: "/qr-card" },
];

const SOS_OPTIONS = [
  { label: "Enkaz Altındayım", value: "Enkaz Altindayim" },
  { label: "Yaralıyım", value: "Yaraliyim" },
  { label: "Yangın Var", value: "Yangin Var" },
  { label: "Sel Var", value: "Sel Var" },
];

const SUPPORT_CARDS = [
  {
    title: "Gönüllü Havuzu",
    desc: "Saha destek kapasitesi ve uygunluk bilgisi toplayın.",
    action: "Başvuru akışına git",
    path: "/volunteer",
    tone: "safe" as Tone,
  },
  {
    title: "Barınma Kapasitesi",
    desc: "Geçici konaklama tekliflerini operasyon havuzuna alın.",
    action: "Teklif kaydı aç",
    path: "/shelter-offer",
    tone: "warning" as Tone,
  },
  {
    title: "Psikolojik Destek",
    desc: "Afetzede ve saha ekipleri için doğrulanmış kaynaklar.",
    action: "Kaynakları gör",
    path: "/psychological-support",
    tone: "info" as Tone,
  },
];

const VIDEO_CARDS = [
  {
    tag: "Hazırlık",
    title: "Afet ve acil durum çantası nasıl hazırlanır?",
    url: "https://youtu.be/K0keerAalYE",
    summary:
      "Acil durum çantası, ilk 72 saat boyunca temel ihtiyaçları karşılayacak şekilde sade ve taşınabilir olmalıdır.",
    guidance: [
      "Su, kuru gıda, el feneri, pil, powerbank, ilk yardım seti, ilaçlar ve hijyen malzemelerini aynı yerde tutun.",
      "Kimlik fotokopisi, önemli telefonlar, nakit para ve temel belgeleri su geçirmez bir kılıfta saklayın.",
      "Çantayı ailede herkesin bildiği, çıkışa yakın ve kolay erişilebilir bir noktada konumlandırın.",
    ],
  },
  {
    tag: "Deprem",
    title: "Deprem anında yapılması gerekenler",
    url: "https://youtu.be/oZeI0X40EEY",
    summary:
      "Deprem anında temel hedef, panik yapmadan düşen veya esneyen nesnelerden korunmak ve sarsıntı bitmeden hareket etmemektir.",
    guidance: [
      "Çök, kapan, tutun pozisyonu alın; pencere, dolap, raf ve ağır eşyalardan uzak durun.",
      "Merdiven, asansör veya balkonlara yönelmeyin; sarsıntı bitene kadar bulunduğunuz yerde korunun.",
      "Sarsıntı sonrası gaz, elektrik ve su risklerini kontrol edin; güvenli çıkış rotasını izleyin.",
    ],
  },
  {
    tag: "Yangın",
    title: "Yangın anında yapılması gerekenler",
    url: "https://youtu.be/yQjUhzNMNe8",
    summary:
      "Yangında hızlı karar, dumandan korunma ve kontrollü tahliye hayati önemdedir.",
    guidance: [
      "Duman varsa yere yakın ilerleyin, ağız ve burnu mümkünse nemli bezle kapatın.",
      "Kapı kolu sıcaksa kapıyı açmayın; alternatif çıkış veya pencere yanında yardım sinyali kullanın.",
      "Küçük ve başlangıç aşamasındaki yangın dışında müdahale etmeyin; 112'yi arayın ve tahliye olun.",
    ],
  },
  {
    tag: "Sel",
    title: "Sel anında yapılması gerekenler",
    url: "https://youtu.be/jy2yf7a5A10",
    summary:
      "Sel durumunda en büyük risk, hızlı akan suya girmek ve araçla geçiş denemektir.",
    guidance: [
      "Dere yatağı, alt geçit, bodrum ve su biriken yollardan uzaklaşın; yüksek ve güvenli noktalara çıkın.",
      "Araçla su birikintisinden geçmeye çalışmayın; az derinlikteki akıntı bile aracı sürükleyebilir.",
      "Elektrik temas riskine karşı priz, pano ve ıslak elektrikli cihazlardan uzak durun.",
    ],
  },
];

function magTone(magnitude: number): Tone {
  if (magnitude >= 5.0) return "critical";
  if (magnitude >= 4.0) return "warning";
  return "safe";
}

function toneLabel(tone: Tone) {
  return `tone-${tone}`;
}

function SectionHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="ops-section-header">
      <div>
        {eyebrow ? <span className="ops-eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
      </div>
      {meta ? <span className="ops-meta">{meta}</span> : null}
    </div>
  );
}

function StatusCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: Tone;
}) {
  return (
    <article className={`ops-card status-card ${toneLabel(tone)}`}>
      <span className="status-card-label">{label}</span>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function ResourceBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`resource-badge ${toneLabel(tone)}`}>{children}</span>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="ops-empty">{message}</div>;
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: Tone;
}) {
  return (
    <div className={`mini-metric ${toneLabel(tone)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function MainPage() {
  const { isAuthenticated, role, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState<Profile>({});
  const [profileMsg, setProfileMsg] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [criticalStock, setCriticalStock] = useState<CriticalStockRecord[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyAdminRecord[]>([]);
  const [earthquakes, setEarthquakes] = useState<EarthquakeItem[]>([]);
  const [opsLoading, setOpsLoading] = useState(true);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>(loadAnnouncementCache().slice(0, 3));

  const [sosOpen, setSosOpen] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [sosMsg, setSosMsg] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [selectedBriefTag, setSelectedBriefTag] = useState(VIDEO_CARDS[0].tag);
  const [, setClickedCoord] = useState<MapClickEvent | null>(null);
  const [stockFilter, setStockFilter] = useState<"all" | "critical" | "available">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;
    geoSafeAPI
      .fetchProfile()
      .then((data) => {
        setProfile(data as Profile);
        setProfileForm(data as Profile);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    let isMounted = true;

    const loadOperationalData = async () => {
      setOpsLoading(true);
      const [warehouseResult, zoneResult, earthquakeResult, criticalResult, emergencyResult] =
        await Promise.allSettled([
          geoSafeAPI.fetchWarehouses(),
          geoSafeAPI.fetchSafeZones(),
          geoSafeAPI.fetchEarthquakes(),
          role === "admin" ? geoSafeAPI.fetchCriticalStockAdmin() : Promise.resolve([]),
          role === "admin" ? geoSafeAPI.fetchEmergenciesAdmin("new") : Promise.resolve([]),
        ]);

      if (!isMounted) return;

      if (warehouseResult.status === "fulfilled") setWarehouses(warehouseResult.value);
      if (zoneResult.status === "fulfilled") setSafeZones(zoneResult.value);
      if (earthquakeResult.status === "fulfilled") setEarthquakes((earthquakeResult.value?.result ?? []).slice(0, 8));
      if (criticalResult.status === "fulfilled") setCriticalStock(criticalResult.value);
      if (emergencyResult.status === "fulfilled") setEmergencies(emergencyResult.value);
      setOpsLoading(false);
    };

    loadOperationalData();

    // Announcements: try to fetch fresh, fall back to cache silently
    geoSafeAPI.fetchAnnouncements().then((items) => {
      if (!isMounted) return;
      saveAnnouncementCache(items);
      setRecentAnnouncements(items.slice(0, 3));
    }).catch(() => { /* serve the already-loaded cache */ });

    return () => {
      isMounted = false;
    };
  }, [role]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const saveProfile = async () => {
    try {
      await geoSafeAPI.updateProfile(profileForm as Record<string, string>);
      setProfile(profileForm);
      setProfileEdit(false);
      setProfileMsg("Kaydedildi.");
      setTimeout(() => setProfileMsg(""), 3000);
    } catch {
      setProfileMsg("Hata oluştu.");
    }
  };

  const sendSOS = async (type: string) => {
    setSosSending(true);
    setSosMsg("Konum alınıyor...");

    const doSend = async (lat: number, lon: number) => {
      try {
        await geoSafeAPI.sendEmergency({
          durum: type,
          saat: new Date().toLocaleString("tr-TR"),
          harita_link: `https://www.google.com/maps?q=${lat},${lon}`,
          enlem: lat,
          boylam: lon,
        } satisfies EmergencyPayload);
        setSosMsg("Bildirim alındı. Operasyon ekibi tarafından değerlendirilecek.");
        setTimeout(() => {
          setSosOpen(false);
          setSosMsg("");
        }, 3000);
      } catch {
        setSosMsg("Gönderilemedi.");
      }
      setSosSending(false);
    };

    navigator.geolocation.getCurrentPosition(
      (position) => doSend(position.coords.latitude, position.coords.longitude),
      () => {
        setSosMsg("Konum alınamadı.");
        setSosSending(false);
      },
      { timeout: 7000 }
    );
  };

  const activeWarehouses = warehouses.filter((warehouse) => warehouse.status === "active").length;
  const activeSafeZones = safeZones.filter((zone) => zone.status === "active").length;
  const totalCapacity = safeZones.reduce((sum, zone) => sum + (zone.capacity ?? 0), 0);
  const majorEarthquakes = earthquakes.filter((earthquake) => earthquake.mag >= 4).length;
  const inactiveSafeZones = safeZones.filter((zone) => zone.status !== "active").length;
  const criticalWarehouseCount = new Set(criticalStock.map((item) => item.warehouse_id)).size;
  const selectedBrief = VIDEO_CARDS.find((card) => card.tag === selectedBriefTag) ?? VIDEO_CARDS[0];
  const lastUpdated = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  // Stok filtresi: "critical" → sıfır stoklu kalemler, "available" → stoku var ama düşük
  const filteredStock = criticalStock.filter((item) => {
    if (stockFilter === "critical") return item.quantity === 0;
    if (stockFilter === "available") return item.quantity > 0;
    return true;
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value.toLowerCase();
    setSearchQuery(q);
    if (q.length < 3) return;
    const sectionMap: [RegExp, string][] = [
      [/harita|map|intel/i, "map-intelligence"],
      [/depo|depot|lojistik|logistic/i, "logistics"],
      [/alan|zone|toplan|shelter/i, "shelter-zones"],
      [/stok|stock|inventory/i, "inventory"],
      [/alert|deprem|seismic|uyar/i, "alerts"],
      [/duyuru|announce/i, "announcements"],
    ];
    for (const [pattern, sectionId] of sectionMap) {
      if (pattern.test(q)) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(sectionId);
        break;
      }
    }
  };

  const handleNavClick = (item: NavItem) => {
    if (item.adminOnly) {
      navigate("/admin");
      return;
    }

    if (item.path) {
      navigate(item.path);
      return;
    }

    if (!item.sectionId) return;

    setActiveSection(item.sectionId);
    document.getElementById(item.sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar" aria-label="Primary navigation">
        <div className="ops-brand">
          <div className="ops-mark">GS</div>
          <div>
            <strong>GeoSafe</strong>
            <span>Acil Durum Lojistiği</span>
          </div>
        </div>
        <nav className="ops-nav">
          {NAV_ITEMS.map((item) => {
            const adminLocked = item.adminOnly && role !== "admin";
            const isActive = item.sectionId ? activeSection === item.sectionId : false;
            return (
              <button
                key={item.label}
                className={isActive ? "active" : ""}
                disabled={adminLocked}
                onClick={() => handleNavClick(item)}
                type="button"
              >
                <i aria-hidden="true">{item.icon}</i>
                <span>{item.label}</span>
                {item.label === "Uyarılar" && emergencies.length > 0 ? <b>{emergencies.length}</b> : null}
              </button>
            );
          })}
        </nav>
        <div className="ops-sidebar-footer">
          <span>Olay Modu</span>
          <strong>IST-OPS / Marmara</strong>
          <small>Canlı CBS ve lojistik görünümü</small>
        </div>
      </aside>

      <div className="ops-workspace">
        <header className="ops-topbar">
          <div className="topbar-brand">
            <div className="ops-mark">GS</div>
            <span>GeoSafe</span>
          </div>
          <div className="incident-context">
            <span className="ops-eyebrow">Aktif Olay Bağlamı</span>
            <strong>Marmara Bölgesel Hazırlığı</strong>
            <span>Operasyon paneli, harita analizi, barınma alanları ve depo görünürlüğü</span>
          </div>

          <label className="ops-search">
            <span className="sr-only">Operasyonlarda ara</span>
            <input
              type="search"
              placeholder="Alan, depo veya uyarı ara..."
              value={searchQuery}
              onChange={handleSearch}
            />
          </label>

          <div className="ops-topbar-actions">
            <ResourceBadge tone="safe">Sistem Çevrim İçi</ResourceBadge>
            <button className="ops-icon-button" type="button" aria-label="Bildirimler">
              {emergencies.length || 0}
            </button>
            <div ref={profileRef} className="profile-menu">
              <button className="profile-trigger" onClick={() => setProfileOpen((open) => !open)} type="button">
                <span>{(profile.name || "P").slice(0, 1).toUpperCase()}</span>
                <strong>{profile.name || "Profil"}</strong>
              </button>

              {profileOpen && (
                <div className="profile-popover">
                  <div className="profile-popover-head">
                    <strong>Kişisel Acil Durum Bilgileri</strong>
                    <span>Saha operasyonlarında doğrulanabilir bilgi</span>
                  </div>
                  <div className="profile-fields">
                    {(["name", "blood", "chronic", "meds", "allergy", "phone"] as (keyof Profile)[]).map((key) => (
                      <label key={key}>
                        <span>
                          {key === "name"
                            ? "Ad Soyad"
                            : key === "blood"
                              ? "Kan Grubu"
                              : key === "chronic"
                                ? "Kronik Rahatsızlık"
                                : key === "meds"
                                  ? "Kullanılan İlaçlar"
                                  : key === "allergy"
                                    ? "Alerjiler"
                                    : "Yakın Telefon"}
                        </span>
                        <input
                          type={key === "phone" ? "tel" : "text"}
                          readOnly={!profileEdit}
                          value={(profileForm as Record<string, string>)[key] ?? ""}
                          onChange={(event) => setProfileForm((form) => ({ ...form, [key]: event.target.value }))}
                        />
                      </label>
                    ))}
                  </div>
                  {profileMsg ? <div className="profile-message">{profileMsg}</div> : null}
                  <div className="profile-actions">
                    <button className="ops-button secondary" onClick={() => setProfileEdit(true)} type="button">
                      Güncelle
                    </button>
                    <button className="ops-button primary" onClick={saveProfile} type="button">
                      Kaydet
                    </button>
                  </div>
                  <div style={{ borderTop: "1px solid #374151", marginTop: "8px", paddingTop: "8px", display: "flex", gap: "8px" }}>
                    <button className="ops-button secondary" style={{ flex: 1 }} onClick={() => navigate("/profile")} type="button">
                      Profil
                    </button>
                    <button className="ops-button primary" style={{ flex: 1 }} onClick={() => navigate("/qr-card")} type="button">
                      QR Kimlik
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button className="ops-button danger" onClick={() => navigate("/emergency")} type="button">
              Acil Durum
            </button>
            <button className="ops-button secondary" onClick={logout} type="button">
              Çıkış
            </button>
          </div>
        </header>

        <main className="ops-main">
          <section id="dashboard" className="situation-strip ops-scroll-target" aria-label="Durum özeti">
            <div className="incident-hero">
              <span className="ops-eyebrow">Durum Özeti</span>
              <h1>Afet Operasyon Merkezi</h1>
              <p>
                Mahalle bazlı risk, stok, toplanma alanı ve yönlendirme görünürlüğü tek harita odaklı komuta ekranında toplanır.
              </p>
              <div className="incident-status-row">
                <ResourceBadge tone="safe">Canlı backend</ResourceBadge>
                <ResourceBadge tone={criticalStock.length ? "warning" : "info"}>Güncelleme {lastUpdated}</ResourceBadge>
              </div>
            </div>
            <div className="situation-metrics">
              <StatusCard label="Aktif Depolar" value={activeWarehouses} detail={`Toplam ${warehouses.length} depo`} tone="info" />
              <StatusCard label="Barınma Kapasitesi" value={totalCapacity || "-"} detail={`${activeSafeZones} aktif alan`} tone="safe" />
              <StatusCard label="Kritik Stok" value={criticalStock.length} detail="Eşik altındaki kalemler" tone={criticalStock.length ? "warning" : "safe"} />
              <StatusCard label="Açık Uyarılar" value={emergencies.length} detail="Yeni acil durum kayıtları" tone={emergencies.length ? "critical" : "neutral"} />
            </div>
          </section>

          <section className="ops-grid">
            <div className="ops-map-column">
              <section id="map-intelligence" className="ops-panel map-panel ops-scroll-target">
                <SectionHeader eyebrow="Harita Analizi" title="Canlı Operasyon Haritası" meta="Barınma / Depolar / Rota desteği" />
                <div className="map-command-row">
                  <ResourceBadge tone="safe">Barınma alanları</ResourceBadge>
                  <ResourceBadge tone="info">Depo işaretleri</ResourceBadge>
                  <ResourceBadge tone="warning">Rota bulucu</ResourceBadge>
                </div>
                <div className="map-floating-metrics" aria-label="Harita operasyon ölçümleri">
                  <MiniMetric label="Toplanma Alanı" value={activeSafeZones} tone="safe" />
                  <MiniMetric label="Kritik Depo" value={criticalWarehouseCount} tone={criticalWarehouseCount ? "critical" : "safe"} />
                  <MiniMetric label="Düşük Stok" value={criticalStock.length} tone={criticalStock.length ? "warning" : "safe"} />
                  <MiniMetric label="Riskli Bölge" value={inactiveSafeZones} tone={inactiveSafeZones ? "warning" : "info"} />
                </div>
                <Map onClickCoordinates={setClickedCoord} />
              </section>

              <section id="alerts" className="ops-panel ops-scroll-target">
                <SectionHeader eyebrow="Bölgesel Uyarılar" title="Sismik Aktivite" meta="Kandilli / son akış" />
                <div className="alert-timeline">
                  {(earthquakes.length ? earthquakes.slice(0, 3) : []).map((earthquake, index) => (
                    <article key={`${earthquake.title}-timeline-${index}`} className={`timeline-item ${toneLabel(magTone(earthquake.mag))}`}>
                      <span>{earthquake.mag}</span>
                      <div>
                        <strong>{earthquake.title}</strong>
                        <small>{earthquake.date} / {earthquake.depth} km</small>
                      </div>
                    </article>
                  ))}
                  {!opsLoading && earthquakes.length === 0 ? <EmptyState message="Uyarı zaman akışı boş." /> : null}
                </div>
                <div className="ops-table-wrap">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>Büyüklük</th>
                        <th>Konum</th>
                        <th>Tarih ve Saat</th>
                        <th>Derinlik</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opsLoading ? (
                        <tr>
                          <td colSpan={4}>
                            <EmptyState message="Operasyon akışı yükleniyor..." />
                          </td>
                        </tr>
                      ) : earthquakes.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <EmptyState message="Yakın tarihli M 3.5+ deprem kaydı yok." />
                          </td>
                        </tr>
                      ) : (
                        earthquakes.map((earthquake, index) => (
                          <tr key={`${earthquake.title}-${index}`}>
                            <td>
                              <ResourceBadge tone={magTone(earthquake.mag)}>{earthquake.mag}</ResourceBadge>
                            </td>
                            <td>
                              <strong>{earthquake.title}</strong>
                            </td>
                            <td>{earthquake.date}</td>
                            <td>{earthquake.depth} km</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="ops-side-column">
              <section id="logistics" className="ops-panel ops-scroll-target">
                <SectionHeader eyebrow="Kaynak Riski" title="Kritik Kaynak Panelleri" />
                <div className="risk-list">
                  <div className="risk-row">
                    <span>Depo kullanılabilirliği</span>
                    <ResourceBadge tone={activeWarehouses ? "safe" : "critical"}>{activeWarehouses}/{warehouses.length || 0}</ResourceBadge>
                  </div>
                  <div className="risk-row">
                    <span>Büyük sismik olaylar</span>
                    <ResourceBadge tone={majorEarthquakes ? "warning" : "safe"}>{majorEarthquakes}</ResourceBadge>
                  </div>
                  <div className="risk-row">
                    <span>Düşük stoklu kalemler</span>
                    <ResourceBadge tone={criticalStock.length ? "critical" : "safe"}>{criticalStock.length}</ResourceBadge>
                  </div>
                </div>
              </section>

              <section id="inventory" className="ops-panel ops-scroll-target">
                <SectionHeader eyebrow="Envanter Durumu" title="Öncelikli Stok" />
                <div className="filter-toolbar">
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
                    Sıfır Stok ({criticalStock.filter((i) => i.quantity === 0).length})
                  </button>
                  <button
                    type="button"
                    className={stockFilter === "available" ? "active" : ""}
                    onClick={() => setStockFilter("available")}
                  >
                    Düşük Stok ({criticalStock.filter((i) => i.quantity > 0).length})
                  </button>
                </div>
                {role !== "admin" ? (
                  <EmptyState message="Kritik stok ayrıntısı için admin rolü gerekir." />
                ) : criticalStock.length === 0 ? (
                  <EmptyState message="Şu anda kritik stok uyarısı yok." />
                ) : filteredStock.length === 0 ? (
                  <EmptyState message="Bu filtrede gösterilecek kalem yok." />
                ) : (
                  <div className="inventory-list">
                    {filteredStock.slice(0, 5).map((item) => (
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

              <section id="shelter-zones" className="ops-panel ops-scroll-target">
                <SectionHeader eyebrow="Saha Eylemleri" title="Destek Başvuruları" />
                <div className="support-stack">
                  {SUPPORT_CARDS.map((card) => (
                    <button key={card.title} className={`support-card ${toneLabel(card.tone)}`} onClick={() => navigate(card.path)} type="button">
                      <strong>{card.title}</strong>
                      <span>{card.desc}</span>
                      <b>{card.action}</b>
                    </button>
                  ))}
                </div>
              </section>

              <section id="reports" className="ops-panel ops-scroll-target">
                <SectionHeader eyebrow="Hazırlık" title="Eğitim Özetleri" />
                <div className="brief-list">
                  {VIDEO_CARDS.map((card) => (
                    <button
                      key={card.tag}
                      className={`brief-link ${selectedBriefTag === card.tag ? "active" : ""}`}
                      onClick={() => setSelectedBriefTag(card.tag)}
                      type="button"
                    >
                      <span>{card.tag}</span>
                      <strong>{card.title}</strong>
                    </button>
                  ))}
                </div>
                <article className="readiness-brief" aria-live="polite">
                  <div>
                    <span className="ops-eyebrow">{selectedBrief.tag}</span>
                    <h3>{selectedBrief.title}</h3>
                    <p>{selectedBrief.summary}</p>
                  </div>
                  <ul>
                    {selectedBrief.guidance.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <a href={selectedBrief.url} target="_blank" rel="noreferrer">
                    Kaynak videosunu aç
                  </a>
                </article>
              </section>

              <section id="announcements" className="ops-panel ops-scroll-target">
                <SectionHeader eyebrow="Resmi Bilgi" title="Son Duyurular" />
                {recentAnnouncements.length === 0 ? (
                  <EmptyState message="Henüz duyuru yok." />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {recentAnnouncements.map((ann) => {
                      const color = ANN_PRIORITY_COLORS[ann.priority] ?? "#1565c0";
                      return (
                        <div
                          key={ann.id}
                          style={{ display: "flex", gap: 10, background: "#f8f9ff", borderRadius: 8, padding: "10px 12px", borderLeft: `4px solid ${color}` }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              <span style={{ background: color, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                                {ANN_PRIORITY_LABELS[ann.priority] ?? ann.priority}
                              </span>
                              <span style={{ fontSize: 11, color: "#999" }}>
                                {ann.published_at ? new Date(ann.published_at).toLocaleDateString("tr-TR") : ""}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1a237e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {ann.title}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => navigate("/duyurular")}
                      style={{ background: "none", border: "1px solid #c5cae9", borderRadius: 8, padding: "7px 12px", color: "#1a237e", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "center" }}
                    >
                      Tüm Duyurular →
                    </button>
                  </div>
                )}
              </section>
            </aside>
          </section>
        </main>
      </div>

      <button className="sos-trigger" onClick={() => setSosOpen((open) => !open)} type="button" aria-expanded={sosOpen}>
        SOS
      </button>

      {sosOpen && (
        <div className="sos-panel" role="dialog" aria-label="Acil durum eylem paneli">
          <div className="sos-panel-head">
            <ResourceBadge tone="critical">Acil Durum Eylemi</ResourceBadge>
            <span>Konum bazlı acil bildirim</span>
          </div>
          <div className="sos-panel-body">
            {sosSending || sosMsg ? (
              <div className="sos-message">{sosMsg}</div>
            ) : (
              SOS_OPTIONS.map((option) => (
                <button key={option.value} onClick={() => sendSOS(option.value)} type="button">
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
