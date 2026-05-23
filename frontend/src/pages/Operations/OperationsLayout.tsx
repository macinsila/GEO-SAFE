import React, { FormEvent, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI } from "../../services";
import { EmergencyPayload } from "../../types";
import { ResourceBadge } from "./opsUi";

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
  adminOnly?: boolean;
};

const OPERATION_NAV_ITEMS: OperationNavItem[] = [
  { label: "Durum Özeti", icon: "D", path: "/ops", end: true },
  { label: "Harita", icon: "M", path: "/ops/map" },
  { label: "Depremler", icon: "S", path: "/ops/earthquakes" },
  { label: "Lojistik", icon: "L", path: "/ops/logistics" },
  { label: "Duyurular", icon: "A", path: "/ops/announcements" },
  { label: "Yönetim", icon: "R", path: "/admin", adminOnly: true },
  { label: "QR Kimlik", icon: "Q", path: "/qr-card" },
];

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

export default function OperationsLayout() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();
  const profileRef = useRef<HTMLDivElement>(null);

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
    if (role !== "admin") {
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
      <aside className="ops-sidebar" aria-label="Operasyon gezintisi">
        <div className="ops-brand">
          <div className="ops-mark">GS</div>
          <div>
            <strong>GeoSafe</strong>
            <span>Acil Durum Lojistiği</span>
          </div>
        </div>

        <nav className="ops-nav">
          {OPERATION_NAV_ITEMS.map((item) => {
            if (item.adminOnly && role !== "admin") {
              return (
                <span key={item.label} className="ops-nav-item disabled" aria-disabled="true">
                  <i aria-hidden="true">{item.icon}</i>
                  <span>{item.label}</span>
                </span>
              );
            }

            return (
              <NavLink
                key={item.label}
                className={({ isActive }) => `ops-nav-item${isActive ? " active" : ""}`}
                end={item.end}
                to={item.path}
              >
                <i aria-hidden="true">{item.icon}</i>
                <span>{item.label}</span>
                {item.path === "/admin" && emergencyCount ? <b>{emergencyCount}</b> : null}
              </NavLink>
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
            <button
              className="ops-icon-button"
              onClick={() => navigate("/admin")}
              disabled={role !== "admin"}
              type="button"
              aria-label={`Yeni acil bildirimler: ${emergencyCount}`}
            >
              {emergencyCount}
            </button>

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

            <button className="ops-button danger" onClick={() => navigate("/emergency")} type="button">
              Acil Durum
            </button>
            <button className="ops-button secondary" onClick={logout} type="button">
              Çıkış
            </button>
          </div>
        </header>

        <main className="ops-main">
          <Outlet />
        </main>
      </div>

      <button
        className="sos-trigger"
        onClick={() => setSosOpen((open) => !open)}
        type="button"
        aria-expanded={sosOpen}
      >
        SOS
      </button>

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
