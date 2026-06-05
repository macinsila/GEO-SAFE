import React, { FormEvent, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePowerMode } from "../../context/PowerModeContext";
import { geoSafeAPI } from "../../services";
import { EmergencyPayload } from "../../types";
import { ResourceBadge } from "./opsUi";
import ChatPanel from "./ChatPanel";

interface Profile {
  name?: string;
  blood?: string;
  chronic?: string;
  meds?: string;
  allergy?: string;
  phone?: string;
}

type OperationNavItem = {
  label: string;
  icon: string;
  path: string;
  end?: boolean;
};

const OPERATION_NAV_ITEMS: OperationNavItem[] = [
  { label: "Durum Özeti", icon: "D", path: "/ops", end: true },
  { label: "Harita", icon: "M", path: "/ops/map" },
  { label: "Depremler", icon: "S", path: "/ops/earthquakes" },
  { label: "Lojistik", icon: "L", path: "/ops/logistics" },
  { label: "Duyurular", icon: "A", path: "/ops/announcements" },
  { label: "Görev Panosu", icon: "G", path: "/ops/tasks" },
  { label: "Mahalle Kanalları", icon: "K", path: "/channels" },
];

const IDENTITY_NAV_ITEMS: OperationNavItem[] = [
  { label: "Profil", icon: "P", path: "/profile" },
  { label: "QR Kimlik", icon: "Q", path: "/qr-card" },
];

const ADMIN_NAV_ITEM: OperationNavItem = {
  label: "Admin Konsolu",
  icon: "K",
  path: "/admin",
};

const SEARCH_ROUTES = [
  { path: "/ops/map", terms: ["harita", "map", "depo", "rota", "alan"] },
  { path: "/ops/earthquakes", terms: ["deprem", "sismik", "uyari", "seismic"] },
  { path: "/ops/logistics", terms: ["lojistik", "stok", "envanter", "logistic", "inventory"] },
  { path: "/ops/announcements", terms: ["duyuru", "bilgi", "announcement"] },
  { path: "/ops", terms: ["panel", "dashboard", "ozet", "durum"] },
];

const SOS_OPTIONS = [
  { label: "Enkaz Altındayım", value: "Enkaz Altindayim" },
  { label: "Yaralıyım", value: "Yaraliyim" },
  { label: "Yangın Var", value: "Yangin Var" },
  { label: "Sel Var", value: "Sel Var" },
];

function NavItem({ item }: { item: OperationNavItem }) {
  return (
    <NavLink
      className={({ isActive }) => `ops-nav-item${isActive ? " active" : ""}`}
      end={item.end}
      to={item.path}
    >
      <i aria-hidden="true">{item.icon}</i>
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function OperationsLayout() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const { lowPower, toggle: togglePower, highContrast, toggleHighContrast } = usePowerMode();
  const profileRef = useRef<HTMLDivElement>(null);
  const isAdmin = role === "admin";
  const [chatOpen, setChatOpen] = useState(false);

  const [profile, setProfile] = useState<Profile>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState<Profile>({});
  const [profileMsg, setProfileMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [emergencyCount, setEmergencyCount] = useState(0);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [sosMsg, setSosMsg] = useState("");

  useEffect(() => {
    let mounted = true;

    geoSafeAPI
      .fetchProfile()
      .then((data) => {
        if (!mounted) return;
        setProfile(data as Profile);
        setProfileForm(data as Profile);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setEmergencyCount(0);
      return;
    }

    let mounted = true;
    geoSafeAPI
      .fetchEmergenciesAdmin("new")
      .then((items) => {
        if (mounted) setEmergencyCount(items.length);
      })
      .catch(() => {
        if (mounted) setEmergencyCount(0);
      });

    return () => {
      mounted = false;
    };
  }, [isAdmin]);

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
      setProfileMsg("Kaydedilemedi.");
    }
  };

  const navigateFromSearch = (query: string) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    const route = SEARCH_ROUTES.find((candidate) =>
      candidate.terms.some((term) => normalizedQuery.includes(term))
    );
    navigate(route?.path ?? "/ops");
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigateFromSearch(searchQuery);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    navigateFromSearch(event.currentTarget.value);
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

  return (
    <div className="ops-shell">
      {/* GS-070: skip-to-main for keyboard users */}
      <a href="#ops-main-content" className="skip-to-main">
        Ana içeriğe geç
      </a>

      <aside className="ops-sidebar" aria-label="Operasyon gezintisi">
        <div className="ops-brand">
          <div className="ops-mark">GS</div>
          <div>
            <strong>GeoSafe</strong>
            <span>Acil Durum Lojistiği</span>
          </div>
        </div>

        <nav className="ops-nav">
          <span className="ops-nav-section-label">Operasyon</span>
          {OPERATION_NAV_ITEMS.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}

          <span className="ops-nav-section-label">Kimlik</span>
          {IDENTITY_NAV_ITEMS.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}

          <span className="ops-nav-section-label">Yetki</span>
          {isAdmin ? (
            <NavLink
              className={({ isActive }) => `ops-nav-item ops-nav-admin${isActive ? " active" : ""}`}
              to={ADMIN_NAV_ITEM.path}
            >
              <i aria-hidden="true">{ADMIN_NAV_ITEM.icon}</i>
              <span>{ADMIN_NAV_ITEM.label}</span>
              {emergencyCount ? <b>{emergencyCount}</b> : null}
            </NavLink>
          ) : (
            <span
              className="ops-nav-item disabled locked"
              aria-disabled="true"
              title="Admin konsolu sadece yetkili kullanıcılar içindir."
            >
              <i aria-hidden="true">{ADMIN_NAV_ITEM.icon}</i>
              <span>{ADMIN_NAV_ITEM.label}</span>
              <small>Admin yetkisi gerekir</small>
            </span>
          )}
        </nav>

        <div className="ops-sidebar-footer">
          <span>Operasyon Alanı</span>
          <strong>IST-OPS / Marmara</strong>
          <small>Canlı CBS ve lojistik görünümü</small>
        </div>
      </aside>

      <div className="ops-workspace">
        <header className="ops-topbar">
          <div className="topbar-brand">
            <div className="ops-mark" aria-hidden="true">GS</div>
            <span>GeoSafe</span>
          </div>

          <div className="incident-context">
            <span className="ops-eyebrow">Aktif Olay Bağlamı</span>
            <strong>Marmara Bölgesel Hazırlığı</strong>
            <span>Operasyon paneli, harita analizi, depo ve resmi bilgi akışı</span>
          </div>

          <form className="ops-search" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="ops-route-search">
              Operasyon ekranlarında ara
            </label>
            <input
              id="ops-route-search"
              type="search"
              placeholder="Harita, stok veya duyuru ara..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <button className="sr-only" onClick={() => navigateFromSearch(searchQuery)} type="submit">
              Ara
            </button>
          </form>

          <div className="ops-topbar-actions">
            <ResourceBadge tone="safe">Sistem Çevrim İçi</ResourceBadge>
            <span className="ops-role-badge">{isAdmin ? "Rol: Admin" : "Rol: Operasyon"}</span>
            {isAdmin ? (
              <button
                className="ops-icon-button ops-admin-alert-button"
                onClick={() => navigate("/admin")}
                type="button"
                aria-label={`Admin acil bildirim kuyruğu: ${emergencyCount}`}
              >
                {emergencyCount}
              </button>
            ) : null}

            <div ref={profileRef} className="profile-menu">
              <button
                className="profile-trigger"
                onClick={() => setProfileOpen((open) => !open)}
                type="button"
                aria-expanded={profileOpen}
              >
                <span>{(profile.name || "P").slice(0, 1).toUpperCase()}</span>
                <strong>{profile.name || "Profil"}</strong>
              </button>

              {profileOpen ? (
                <div className="profile-popover">
                  <div className="profile-popover-head">
                    <strong>Kişisel Acil Durum Bilgileri</strong>
                    <span>Saha operasyonlarında doğrulanabilir bilgi</span>
                  </div>
                  <div className="profile-fields">
                    {(["name", "blood", "chronic", "meds", "allergy", "phone"] as (keyof Profile)[]).map(
                      (key) => (
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
                            onChange={(event) =>
                              setProfileForm((form) => ({ ...form, [key]: event.target.value }))
                            }
                          />
                        </label>
                      )
                    )}
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
                  <div className="profile-shortcuts">
                    <button className="ops-button secondary" onClick={() => navigate("/profile")} type="button">
                      Profil
                    </button>
                    <button className="ops-button primary" onClick={() => navigate("/qr-card")} type="button">
                      QR Kimlik
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              className={`ops-button secondary${chatOpen ? " active" : ""}`}
              onClick={() => setChatOpen((o) => !o)}
              type="button"
              aria-pressed={chatOpen}
              title="Ops sohbet kanalını aç/kapat"
            >
              Sohbet
            </button>
            <button
              className={`ops-button secondary${highContrast ? " active" : ""}`}
              onClick={toggleHighContrast}
              type="button"
              aria-pressed={highContrast}
              title={highContrast ? "Normal görünüme dön" : "Yüksek kontrast modunu etkinleştir"}
              aria-label={highContrast ? "Yüksek kontrast modu etkin — devre dışı bırak" : "Yüksek kontrast modunu etkinleştir"}
            >
              {highContrast ? "◑ Y.Kontrast" : "◑"}
            </button>
            <button
              className={`ops-button secondary${lowPower ? " active" : ""}`}
              onClick={togglePower}
              type="button"
              aria-pressed={lowPower}
              title={lowPower ? "Normal moda dön" : "Düşük güç modunu etkinleştir"}
              aria-label={lowPower ? "Düşük güç modu etkin — devre dışı bırak" : "Düşük güç modunu etkinleştir"}
            >
              {lowPower ? "⚡ Düşük Güç" : "⚡"}
            </button>
            <button className="ops-button danger" onClick={() => navigate("/emergency")} type="button">
              Acil Durum
            </button>
            <button className="ops-button secondary" onClick={logout} type="button">
              Çıkış
            </button>
          </div>
        </header>

        <main className="ops-main" id="ops-main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <button
        className="sos-trigger"
        onClick={() => setSosOpen((open) => !open)}
        type="button"
        aria-expanded={sosOpen}
        aria-label="Acil durum SOS panelini aç"
        aria-haspopup="dialog"
      >
        SOS
      </button>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />

      {sosOpen ? (
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
      ) : null}
    </div>
  );
}
