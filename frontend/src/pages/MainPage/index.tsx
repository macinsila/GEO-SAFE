import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI, EarthquakeItem } from "../../services";
import { Map } from "../../components";
import {
  CriticalStockRecord,
  EmergencyAdminRecord,
  EmergencyPayload,
  MapClickEvent,
  SafeZone,
  Warehouse,
} from "../../types";

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
  { label: "Dashboard", icon: "D", sectionId: "dashboard" },
  { label: "Map Intelligence", icon: "M", sectionId: "map-intelligence" },
  { label: "Shelter Zones", icon: "S", sectionId: "shelter-zones" },
  { label: "Logistics", icon: "L", sectionId: "logistics" },
  { label: "Inventory", icon: "I", sectionId: "inventory" },
  { label: "Alerts", icon: "A", sectionId: "alerts" },
  { label: "Admin", icon: "R", adminOnly: true },
  { label: "Reports", icon: "P", sectionId: "reports" },
  { label: "QR Kimlik", icon: "Q", path: "/qr-card" },
];

const SOS_OPTIONS = [
  { label: "Enkaz Altindayim", value: "Enkaz Altindayim" },
  { label: "Yaraliyim", value: "Yaraliyim" },
  { label: "Yangin Var", value: "Yangin Var" },
  { label: "Sel Var", value: "Sel Var" },
];

const SUPPORT_CARDS = [
  {
    title: "Gonullu Havuzu",
    desc: "Saha destek kapasitesi ve uygunluk bilgisi toplayin.",
    action: "Basvuru akisina git",
    path: "/volunteer",
    tone: "safe" as Tone,
  },
  {
    title: "Barinma Kapasitesi",
    desc: "Gecici konaklama tekliflerini operasyon havuzuna alin.",
    action: "Teklif kaydi ac",
    path: "/shelter-offer",
    tone: "warning" as Tone,
  },
  {
    title: "Psikolojik Destek",
    desc: "Afetzede ve saha ekipleri icin dogrulanmis kaynaklar.",
    action: "Kaynaklari gor",
    path: "/psychological-support",
    tone: "info" as Tone,
  },
];

const VIDEO_CARDS = [
  {
    tag: "Hazirlik",
    title: "Afet ve acil durum cantasi nasil hazirlanir?",
    url: "https://youtu.be/K0keerAalYE",
    summary:
      "Acil durum cantasi, ilk 72 saat boyunca temel ihtiyaclari karsilayacak sekilde sade ve tasinabilir olmalidir.",
    guidance: [
      "Su, kuru gida, el feneri, pil, powerbank, ilk yardim seti, ilaclar ve hijyen malzemelerini ayni yerde tutun.",
      "Kimlik fotokopisi, onemli telefonlar, nakit para ve temel belgeleri su gecirmez bir kilifta saklayin.",
      "Cantayi ailede herkesin bildigi, cikisa yakin ve kolay erisilebilir bir noktada konumlandirin.",
    ],
  },
  {
    tag: "Deprem",
    title: "Deprem aninda yapilmasi gerekenler",
    url: "https://youtu.be/oZeI0X40EEY",
    summary:
      "Deprem aninda temel hedef panik yapmadan dusen/esneyen nesnelerden korunmak ve sarsinti bitmeden hareket etmemektir.",
    guidance: [
      "Cok, kapan, tutun pozisyonu alin; pencere, dolap, raf ve agir esyalardan uzak durun.",
      "Merdiven, asansor veya balkonlara yonelmeyin; sarsinti bitene kadar bulundugunuz yerde korunun.",
      "Sarsinti sonrasi gaz, elektrik ve su risklerini kontrol edin; guvenli cikis rotasini izleyin.",
    ],
  },
  {
    tag: "Yangin",
    title: "Yangin aninda yapilmasi gerekenler",
    url: "https://youtu.be/yQjUhzNMNe8",
    summary:
      "Yanginda hizli karar, dumandan korunma ve kontrollu tahliye hayati onemdedir.",
    guidance: [
      "Duman varsa yere yakin ilerleyin, agiz ve burnu mumkunse nemli bezle kapatin.",
      "Kapi kolu sicaksa kapıyı acmayin; alternatif cikis veya pencere yaninda yardim sinyali kullanin.",
      "Kucuk ve baslangic asamasindaki yangin disinda mudahale etmeyin; 112'yi arayin ve tahliye olun.",
    ],
  },
  {
    tag: "Sel",
    title: "Sel aninda yapilmasi gerekenler",
    url: "https://youtu.be/jy2yf7a5A10",
    summary:
      "Sel durumunda en buyuk risk hizli akan suya girmek ve aracla gecis denemektir.",
    guidance: [
      "Dere yatagi, alt gecit, bodrum ve su biriken yollardan uzaklasin; yuksek ve guvenli noktalara cikın.",
      "Aracla su birikintisinden gecmeye calismayin; az derinlikteki akinti bile araci surukleyebilir.",
      "Elektrik temas riskine karsi priz, pano ve islak elektrikli cihazlardan uzak durun.",
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

  const [sosOpen, setSosOpen] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [sosMsg, setSosMsg] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [selectedBriefTag, setSelectedBriefTag] = useState(VIDEO_CARDS[0].tag);
  const [, setClickedCoord] = useState<MapClickEvent | null>(null);

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
      setProfileMsg("Hata olustu.");
    }
  };

  const sendSOS = async (type: string) => {
    setSosSending(true);
    setSosMsg("Konum aliniyor...");

    const doSend = async (lat: number, lon: number) => {
      try {
        await geoSafeAPI.sendEmergency({
          durum: type,
          saat: new Date().toLocaleString("tr-TR"),
          harita_link: `https://www.google.com/maps?q=${lat},${lon}`,
          enlem: lat,
          boylam: lon,
        } satisfies EmergencyPayload);
        setSosMsg("Bildirim alindi. Operasyon ekibi tarafindan degerlendirilecek.");
        setTimeout(() => {
          setSosOpen(false);
          setSosMsg("");
        }, 3000);
      } catch {
        setSosMsg("Gonderilemedi.");
      }
      setSosSending(false);
    };

    navigator.geolocation.getCurrentPosition(
      (position) => doSend(position.coords.latitude, position.coords.longitude),
      () => {
        setSosMsg("Konum alinamadi.");
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
            <span>Emergency Logistics</span>
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
                {item.label === "Alerts" && emergencies.length > 0 ? <b>{emergencies.length}</b> : null}
              </button>
            );
          })}
        </nav>
        <div className="ops-sidebar-footer">
          <span>Incident Mode</span>
          <strong>IST-OPS / Marmara</strong>
          <small>Live GIS + logistics view</small>
        </div>
      </aside>

      <div className="ops-workspace">
        <header className="ops-topbar">
          <div className="topbar-brand">
            <div className="ops-mark">GS</div>
            <span>GeoSafe</span>
          </div>
          <div className="incident-context">
            <span className="ops-eyebrow">Active Incident Context</span>
            <strong>Marmara Regional Readiness</strong>
            <span>Operational dashboard, map intelligence, shelter and depot visibility</span>
          </div>

          <label className="ops-search">
            <span className="sr-only">Search operations</span>
            <input type="search" placeholder="Search zone, depot, alert..." />
          </label>

          <div className="ops-topbar-actions">
            <ResourceBadge tone="safe">System Online</ResourceBadge>
            <button className="ops-icon-button" type="button" aria-label="Notifications">
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
                    <strong>Kisisel Acil Durum Bilgileri</strong>
                    <span>Saha operasyonlarinda dogrulanabilir bilgi</span>
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
                                ? "Kronik Rahatsizlik"
                                : key === "meds"
                                  ? "Kullanilan Ilaclar"
                                  : key === "allergy"
                                    ? "Alerjiler"
                                    : "Yakin Telefon"}
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
                      Guncelle
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
              Cikis
            </button>
          </div>
        </header>

        <main className="ops-main">
          <section id="dashboard" className="situation-strip ops-scroll-target" aria-label="Situation summary">
            <div className="incident-hero">
              <span className="ops-eyebrow">Situation Summary</span>
              <h1>Afet Operasyon Merkezi</h1>
              <p>
                Mahalle bazli risk, stok, toplanma alani ve yonlendirme gorunurlugu tek map-first komuta ekraninda toplanir.
              </p>
              <div className="incident-status-row">
                <ResourceBadge tone="safe">Live backend</ResourceBadge>
                <ResourceBadge tone={criticalStock.length ? "warning" : "info"}>Updated {lastUpdated}</ResourceBadge>
              </div>
            </div>
            <div className="situation-metrics">
              <StatusCard label="Active Depots" value={activeWarehouses} detail={`${warehouses.length} total depot`} tone="info" />
              <StatusCard label="Shelter Capacity" value={totalCapacity || "-"} detail={`${activeSafeZones} active zones`} tone="safe" />
              <StatusCard label="Critical Stock" value={criticalStock.length} detail="items below threshold" tone={criticalStock.length ? "warning" : "safe"} />
              <StatusCard label="Open Alerts" value={emergencies.length} detail="new emergency records" tone={emergencies.length ? "critical" : "neutral"} />
            </div>
          </section>

          <section className="ops-grid">
            <div className="ops-map-column">
              <section id="map-intelligence" className="ops-panel map-panel ops-scroll-target">
                <SectionHeader eyebrow="Map Intelligence" title="Live Operational Map" meta="Shelters / Depots / Route support" />
                <div className="map-command-row">
                  <ResourceBadge tone="safe">Shelter zones</ResourceBadge>
                  <ResourceBadge tone="info">Depot markers</ResourceBadge>
                  <ResourceBadge tone="warning">Route finder</ResourceBadge>
                </div>
                <div className="map-floating-metrics" aria-label="Map operational metrics">
                  <MiniMetric label="Toplanma Alani" value={activeSafeZones} tone="safe" />
                  <MiniMetric label="Kritik Depo" value={criticalWarehouseCount} tone={criticalWarehouseCount ? "critical" : "safe"} />
                  <MiniMetric label="Dusuk Stok" value={criticalStock.length} tone={criticalStock.length ? "warning" : "safe"} />
                  <MiniMetric label="Riskli Bolge" value={inactiveSafeZones} tone={inactiveSafeZones ? "warning" : "info"} />
                </div>
                <Map onClickCoordinates={setClickedCoord} />
              </section>

              <section id="alerts" className="ops-panel ops-scroll-target">
                <SectionHeader eyebrow="Regional Alerts" title="Seismic Activity" meta="Kandilli / last feed" />
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
                  {!opsLoading && earthquakes.length === 0 ? <EmptyState message="Alert timeline is clear." /> : null}
                </div>
                <div className="ops-table-wrap">
                  <table className="ops-table">
                    <thead>
                      <tr>
                        <th>Magnitude</th>
                        <th>Location</th>
                        <th>Date & Time</th>
                        <th>Depth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opsLoading ? (
                        <tr>
                          <td colSpan={4}>
                            <EmptyState message="Operational feed loading..." />
                          </td>
                        </tr>
                      ) : earthquakes.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <EmptyState message="No recent M 3.5+ earthquake records." />
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
                <SectionHeader eyebrow="Resource Risk" title="Critical Resource Panels" />
                <div className="risk-list">
                  <div className="risk-row">
                    <span>Depot availability</span>
                    <ResourceBadge tone={activeWarehouses ? "safe" : "critical"}>{activeWarehouses}/{warehouses.length || 0}</ResourceBadge>
                  </div>
                  <div className="risk-row">
                    <span>Major seismic events</span>
                    <ResourceBadge tone={majorEarthquakes ? "warning" : "safe"}>{majorEarthquakes}</ResourceBadge>
                  </div>
                  <div className="risk-row">
                    <span>Low-stock items</span>
                    <ResourceBadge tone={criticalStock.length ? "critical" : "safe"}>{criticalStock.length}</ResourceBadge>
                  </div>
                </div>
              </section>

              <section id="inventory" className="ops-panel ops-scroll-target">
                <SectionHeader eyebrow="Inventory Health" title="Priority Stock" />
                <div className="filter-toolbar">
                  <button type="button" className="active">All resources</button>
                  <button type="button">Critical</button>
                  <button type="button">Available</button>
                </div>
                {role !== "admin" ? (
                  <EmptyState message="Admin role required for critical stock detail." />
                ) : criticalStock.length === 0 ? (
                  <EmptyState message="No critical stock warning at this time." />
                ) : (
                  <div className="inventory-list">
                    {criticalStock.slice(0, 5).map((item) => (
                      <article key={`${item.warehouse_id}-${item.item_id}`} className="inventory-item">
                        <div>
                          <strong>{item.item_name}</strong>
                          <span>{item.warehouse_name}</span>
                        </div>
                        <ResourceBadge tone="critical">
                          {item.quantity}/{item.threshold} {item.item_unit}
                        </ResourceBadge>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section id="shelter-zones" className="ops-panel ops-scroll-target">
                <SectionHeader eyebrow="Field Actions" title="Support Intake" />
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
                <SectionHeader eyebrow="Readiness" title="Training Briefs" />
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
                    Kaynak videosunu ac
                  </a>
                </article>
              </section>
            </aside>
          </section>
        </main>
      </div>

      <button className="sos-trigger" onClick={() => setSosOpen((open) => !open)} type="button" aria-expanded={sosOpen}>
        SOS
      </button>

      {sosOpen && (
        <div className="sos-panel" role="dialog" aria-label="Emergency action panel">
          <div className="sos-panel-head">
            <ResourceBadge tone="critical">Emergency Action</ResourceBadge>
            <span>Konum bazli acil bildirim</span>
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
