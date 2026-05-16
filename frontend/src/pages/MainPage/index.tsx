import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI, EarthquakeItem } from "../../services";
import { Map } from "../../components";
import { EmergencyPayload, MapClickEvent } from "../../types";

// ── profile types ──────────────────────────────────────────────────────
interface Profile { name?: string; blood?: string; chronic?: string; meds?: string; allergy?: string; phone?: string }

// ── earthquake helpers ─────────────────────────────────────────────────
function magColor(m: number) { return m >= 5.0 ? "#ef4444" : m >= 4.0 ? "#f59e0b" : "#10b981"; }

// ── SOS types ─────────────────────────────────────────────────────────
const SOS_OPTIONS = [
  { label: "🚨 Enkaz Altındayım", value: "🚨 Enkaz Altındayım" },
  { label: "🏥 Yaralıyım",        value: "🏥 Yaralıyım" },
  { label: "🔥 Yangın Var",       value: "🔥 Yangın Var" },
  { label: "💧 Sel Var",          value: "💧 Sel Var" },
];

const VIDEO_CARDS = [
  { tag: "Hazırlık", title: "Afet ve Acil Durum Çantası Nasıl Hazırlanır?", url: "https://youtu.be/K0keerAalYE" },
  { tag: "Deprem",   title: "Deprem Anında Yapılması Gerekenler",           url: "https://youtu.be/oZeI0X40EEY" },
  { tag: "Yangın",   title: "Yangın Anında Yapılması Gerekenler",           url: "https://youtu.be/yQjUhzNMNe8" },
  { tag: "Sel",      title: "Sel Anında Yapılması Gerekenler",              url: "https://youtu.be/jy2yf7a5A10" },
  { tag: "Farkındalık", title: "Afet Farkındalık Eğitimi",                 url: "https://youtu.be/IPkQdDeW6Xg" },
  { tag: "İlk Yardım", title: "İlk Yardım Eğitimi",                        url: "https://youtu.be/eYLu7dh6nUI" },
];

const SUPPORT_CARDS = [
  {
    title: "Gönüllü Olabilirim",
    desc: "Becerilerinizi ve musaitlik bilginizi bildirin.",
    action: "Basvur",
    path: "/volunteer",
    tone: "#0d9488",
  },
  {
    title: "Barınma Destegi",
    desc: "Evini gecici destek icin bildirmek isteyenler.",
    action: "Teklif Gonder",
    path: "/shelter-offer",
    tone: "#f97316",
  },
  {
    title: "Psikolojik Destek",
    desc: "Guvenli kaynaklara ve bilgilere ulasin.",
    action: "Kaynaklara Git",
    path: "/psychological-support",
    tone: "#3b82f6",
  },
];

export default function MainPage() {
  const { isAuthenticated, role, logout } = useAuth();
  const navigate = useNavigate();

  // ── profile ──
  const [profile, setProfile] = useState<Profile>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState<Profile>({});
  const [profileMsg, setProfileMsg] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);

  // ── earthquakes ──
  const [earthquakes, setEarthquakes] = useState<EarthquakeItem[]>([]);
  const [eqLoading, setEqLoading] = useState(true);

  // ── SOS ──
  const [sosOpen, setSosOpen]     = useState(false);
  const [sosSending, setSosSending] = useState(false);
  const [sosMsg, setSosMsg]       = useState("");

  // ── map click state ──
  const [, setClickedCoord] = useState<MapClickEvent | null>(null);

  // ── load profile ──
  useEffect(() => {
    if (!isAuthenticated) return;
    geoSafeAPI.fetchProfile().then(d => {
      setProfile(d as Profile);
      setProfileForm(d as Profile);
    }).catch(() => {});
  }, [isAuthenticated]);

  // ── load earthquakes ──
  useEffect(() => {
    setEqLoading(true);
    geoSafeAPI.fetchEarthquakes().then(d => {
      setEarthquakes((d?.result ?? []).slice(0, 10));
    }).catch(() => setEarthquakes([])).finally(() => setEqLoading(false));
  }, []);

  // close profile on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
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
      setProfileMsg("✅ Kaydedildi!");
      setTimeout(() => setProfileMsg(""), 3000);
    } catch { setProfileMsg("❌ Hata oluştu."); }
  };

  const sendSOS = async (type: string) => {
    setSosSending(true);
    setSosMsg("⏳ Konum alınıyor…");
    const doSend = async (lat: number, lon: number) => {
      try {
        await geoSafeAPI.sendEmergency({
          durum: type,
          saat: new Date().toLocaleString("tr-TR"),
          harita_link: `https://www.google.com/maps?q=${lat},${lon}`,
          enlem: lat,
          boylam: lon,
        } satisfies EmergencyPayload);
        setSosMsg("Bildiriminiz alındı, yetkili ekiplerce değerlendirilecektir.");
        setTimeout(() => { setSosOpen(false); setSosMsg(""); }, 3000);
      } catch { setSosMsg("❌ Gönderilemedi."); }
      setSosSending(false);
    };
    navigator.geolocation.getCurrentPosition(
      p => doSend(p.coords.latitude, p.coords.longitude),
      () => { setSosMsg("❌ Konum alınamadı."); setSosSending(false); },
      { timeout: 7000 }
    );
  };


  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#ecfeff,#f0fdfa,#dcfce7,#fef9c3)", fontFamily: "'Outfit','Segoe UI',system-ui,sans-serif", color: "#134e4a" }}>

      {/* ── HEADER ── */}
      <header className="main-header" style={{ position: "sticky", top: 0, zIndex: 2000, background: "linear-gradient(135deg,#fff,#f0fdfa)", borderBottom: "2px solid #0d9488", padding: "0 36px", height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 20px rgba(13,148,136,.14)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, background: "linear-gradient(135deg,#14b8a6,#0d9488)", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, background: "linear-gradient(90deg,#0f766e,#14b8a6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -0.5 }}>GeoSafe</div>
            <div style={{ fontSize: 10, color: "#94a3b0", fontWeight: 600 }}>Afet Yönetim ve Güvenli Toplanma Ağı</div>
          </div>
        </div>

        <div className="main-header-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {/* Profile dropdown */}
          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", background: "linear-gradient(135deg,#f0fdfa,#ccfbf1)", border: "2px solid #0d9488", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, color: "#134e4a", fontFamily: "inherit" }}
            >
              <span style={{ width: 26, height: 26, background: "linear-gradient(135deg,#14b8a6,#0d9488)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff" }}>👤</span>
              <span>{profile.name || "Profilim"}</span>
            </button>

            {profileOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 284, background: "#fff", border: "2px solid #0d9488", borderRadius: 14, boxShadow: "0 12px 40px rgba(13,148,136,.22)", zIndex: 3000 }}>
                <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid #ccfbf1", background: "linear-gradient(180deg,#f0fdfa,#fff)", borderRadius: "12px 12px 0 0", display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 24 }}>🧑</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Kişisel Bilgiler</div>
                    <div style={{ fontSize: 10, color: "#94a3b0", marginTop: 2 }}>Acil durum bilgilerinizi güncel tutun</div>
                  </div>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  {(["name","blood","chronic","meds","allergy","phone"] as (keyof Profile)[]).map(k => (
                    <div key={k} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#94a3b0", marginBottom: 3, letterSpacing: .06 }}>
                        {k === "name" ? "Ad Soyad" : k === "blood" ? "Kan Grubu" : k === "chronic" ? "Kronik Rahatsızlık" : k === "meds" ? "Kullanılan İlaçlar" : k === "allergy" ? "Alerjiler" : "Yakın Tel"}
                      </div>
                      <input
                        type={k === "phone" ? "tel" : "text"}
                        readOnly={!profileEdit}
                        value={(profileForm as Record<string,string>)[k] ?? ""}
                        onChange={e => setProfileForm(f => ({ ...f, [k]: e.target.value }))}
                        style={{ width: "100%", padding: "7px 9px", border: "1px solid #ccfbf1", borderRadius: 6, fontSize: 12, background: profileEdit ? "#fff" : "#f0fdfa", cursor: profileEdit ? "text" : "not-allowed", color: "#134e4a", boxSizing: "border-box", fontFamily: "inherit" }}
                      />
                    </div>
                  ))}
                  {profileMsg && <div style={{ fontSize: 12, fontWeight: 600, color: profileMsg.startsWith("✅") ? "#065f46" : "#991b1b", marginBottom: 8 }}>{profileMsg}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button onClick={() => setProfileEdit(true)} style={{ flex: 1, padding: 8, background: "#f0fdfa", border: "1px solid #ccfbf1", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>Güncelle</button>
                    <button onClick={saveProfile} style={{ flex: 1, padding: 8, background: "linear-gradient(135deg,#14b8a6,#0d9488)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>Kaydet</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => navigate("/emergency")} style={{ padding: "8px 14px", background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
            🚨 Acil Durum
          </button>
          {role === "admin" && (
            <button onClick={() => navigate("/admin")} style={{ padding: "8px 14px", background: "transparent", border: "1px solid rgba(13,148,136,.6)", color: "#0f766e", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>
              Admin Panel →
            </button>
          )}
          <button onClick={logout} style={{ padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>
            Çıkış
          </button>
        </div>
      </header>

      {/* ── STATUS BAR ── */}
      <div className="main-status-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 36px", background: "#fff", borderBottom: "1px solid #ccfbf1", boxShadow: "0 2px 8px rgba(13,148,136,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, background: "#4ade80", borderRadius: "50%", boxShadow: "0 0 0 3px rgba(74,222,128,.3)", display: "inline-block" }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Sistem çevrimiçi — Veriler canlı güncelleniyor</span>
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          {["🗺️ Haritadan toplanma alanı seçin","📦 Envanter bilgilerini görüntüleyin","🚨 SOS ile hızlı müdahale"].map(h => (
            <span key={h} style={{ fontSize: 11, color: "#5c7a75", fontWeight: 500 }}>{h}</span>
          ))}
        </div>
      </div>

      {/* ── MAIN: MAP ── */}
      <div style={{ maxWidth: 1400, margin: "24px auto", padding: "0 28px" }}>
        <Map onClickCoordinates={setClickedCoord} />
      </div>

      {/* ── SUPPORT ACTIONS ── */}
      <div style={{ maxWidth: 1400, margin: "0 auto 24px", padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 4, height: 28, background: "linear-gradient(180deg,#14b8a6,#0d9488)", borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, textTransform: "uppercase", letterSpacing: .06 }}>Katilim ve Destek</div>
            <div style={{ fontSize: 12, color: "#94a3b0", marginTop: 2 }}>Gonullu ve barinma bildirimi icin guvenli alan</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          {SUPPORT_CARDS.map(card => (
            <div key={card.title} style={{ background: "#fff", border: "2px solid #ccfbf1", borderRadius: 16, padding: "18px 18px 16px", boxShadow: "0 8px 22px rgba(13,148,136,.08)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#134e4a" }}>{card.title}</div>
              <div style={{ fontSize: 12, color: "#5c7a75", lineHeight: 1.5 }}>{card.desc}</div>
              <button
                onClick={() => navigate(card.path)}
                style={{ marginTop: "auto", padding: "9px 12px", background: card.tone, color: "#fff", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                {card.action}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── EARTHQUAKES ── */}
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 28px 20px" }}>
        <div style={{ background: "#fff", border: "2px solid #ccfbf1", borderRadius: 14, overflow: "hidden", boxShadow: "0 8px 24px rgba(13,148,136,.13)" }}>
          <div style={{ padding: "14px 22px", borderBottom: "1px solid #ccfbf1", display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(90deg,#f0fdfa,#fff)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#ef4444,#dc2626)", borderRadius: 12, padding: "3px 10px" }}>
              <span style={{ width: 6, height: 6, background: "#fff", borderRadius: "50%", display: "inline-block" }} /> CANLI
            </span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Son Depremler</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "3px 10px" }}>Kandilli Rasathanesi</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b0" }}>Son 3 gün / M 3.5+</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f0fdfa" }}>
                  {["Büyüklük","Konum","Tarih & Saat","Derinlik"].map(h => (
                    <th key={h} style={{ padding: "11px 22px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: .06, color: "#94a3b0", borderBottom: "1px solid #ccfbf1" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eqLoading ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "#94a3b0" }}>Yükleniyor…</td></tr>
                ) : earthquakes.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: 32, color: "#94a3b0", fontSize: 12 }}>Son 3 günde M 3.5+ deprem kaydı bulunamadı.</td></tr>
                ) : earthquakes.map((eq, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f0fdfa" }}>
                    <td style={{ padding: "13px 22px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 40, padding: "4px 10px", borderRadius: 6, background: magColor(eq.mag), color: "#fff", fontWeight: 800, fontSize: 12 }}>{eq.mag}</span>
                    </td>
                    <td style={{ padding: "13px 22px", fontWeight: 600 }}>{eq.title}</td>
                    <td style={{ padding: "13px 22px", color: "#5c7a75", fontSize: 12 }}>{eq.date}</td>
                    <td style={{ padding: "13px 22px", color: "#5c7a75", fontSize: 12 }}>{eq.depth} km</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── EDUCATION VIDEOS ── */}
      <div style={{ maxWidth: 1400, margin: "0 auto 100px", padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{ width: 4, height: 28, background: "linear-gradient(180deg,#14b8a6,#0d9488)", borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, textTransform: "uppercase", letterSpacing: .06 }}>Afet Hazırlık Eğitimleri</div>
            <div style={{ fontSize: 12, color: "#94a3b0", marginTop: 2 }}>Bilinçli ve hazırlıklı ol</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
          {VIDEO_CARDS.map(c => (
            <div key={c.url} style={{ background: "#fff", border: "2px solid #ccfbf1", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 8px rgba(13,148,136,.08)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "18px 18px 14px", flex: 1 }}>
                <span style={{ display: "inline-block", fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#fff", background: "linear-gradient(135deg,#14b8a6,#0d9488)", borderRadius: 10, padding: "3px 8px", marginBottom: 9 }}>{c.tag}</span>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#134e4a", lineHeight: 1.45 }}>{c.title}</div>
              </div>
              <div style={{ padding: "10px 18px 14px", borderTop: "1px solid #ccfbf1" }}>
                <a href={c.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#0d9488", textDecoration: "none" }}>
                  ▶ YouTube'da İzle →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: "linear-gradient(135deg,#134e4a,#115e59,#0f766e)", color: "#fff", padding: "32px 36px 20px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>GeoSafe</div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.75)", maxWidth: 300, lineHeight: 1.6, margin: 0 }}>
              Afet durumlarında güvenli toplanma alanlarını bulun, sevdiklerinize ulaşın.
            </p>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#2dd4bf", marginBottom: 10, letterSpacing: .08 }}>Acil Durum</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>
              <span style={{ color: "#ef4444" }}>112</span> — Acil Çağrı
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 4 }}>Tüm acil durumlar için tek numara.</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#2dd4bf", marginBottom: 10, letterSpacing: .08 }}>İletişim</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)" }}>📧 bilgi.geosafe@gmail.com</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", marginTop: 4 }}>🌐 www.geosafe.org</div>
          </div>
        </div>
        <div style={{ maxWidth: 1400, margin: "20px auto 0", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,.15)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,.6)", flexWrap: "wrap", gap: 8 }}>
          <span>© 2026 GeoSafe. Tüm hakları saklıdır.</span>
          <span>Gizlilik Politikası · Kullanım Şartları · KVKK</span>
        </div>
      </footer>

      {/* ── SOS BUTTON ── */}
      <div
        onClick={() => setSosOpen(o => !o)}
        style={{ position: "fixed", bottom: 28, right: 28, width: 62, height: 62, background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, cursor: "pointer", zIndex: 9999, border: "3px solid #fff", boxShadow: "0 6px 20px rgba(239,68,68,.45)", userSelect: "none", animation: "sosPulse 2s ease-in-out infinite" }}
      >
        SOS
      </div>

      {sosOpen && (
        <div style={{ position: "fixed", bottom: 104, right: 28, width: 260, background: "#fff", border: "2px solid #ccfbf1", borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,.15)", zIndex: 9998, overflow: "hidden" }}>
          <div style={{ padding: "11px 16px 8px", background: "linear-gradient(180deg,#fef2f2,#fff)", borderBottom: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, background: "#ef4444", borderRadius: "50%", display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: .05, color: "#ef4444" }}>Acil Eylem</span>
          </div>
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {sosSending ? (
              <div style={{ textAlign: "center", padding: 16, fontSize: 13, fontWeight: 600, color: sosMsg.startsWith("✅") ? "#065f46" : sosMsg.startsWith("❌") ? "#991b1b" : "#b45309" }}>{sosMsg}</div>
            ) : (
              SOS_OPTIONS.map(o => (
                <button key={o.value} onClick={() => sendSOS(o.value)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
                  {o.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes sosPulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,.6); }
          70%  { box-shadow: 0 0 0 14px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  );
}
