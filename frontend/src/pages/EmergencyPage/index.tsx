import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { geoSafeAPI } from "../../services";

type Phase = "select" | "loading" | "done" | "error";

const TYPES = [
  { label: "🚨 Enkaz Altındayım", value: "🚨 Enkaz Altındayım" },
  { label: "🏥 Yaralıyım",        value: "🏥 Yaralıyım" },
  { label: "🔥 Yangın Var",       value: "🔥 Yangın Var" },
  { label: "💧 Sel Var",          value: "💧 Sel Var" },
  { label: "🆘 Diğer Acil",       value: "🆘 Diğer Acil" },
];

export default function EmergencyPage() {
  const navigate = useNavigate();
  const [phase, setPhase]   = useState<Phase>("select");
  const [errMsg, setErrMsg] = useState("");
  const [sent, setSent]     = useState("");

  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [needManual, setNeedManual] = useState(false);
  const [pendingType, setPendingType] = useState("");

  const send = async (type: string, lat: number, lon: number) => {
    setPhase("loading");
    const saat = new Date().toLocaleString("tr-TR");
    const haritaLink = `https://www.google.com/maps?q=${lat},${lon}`;
    try {
      await geoSafeAPI.sendEmergency({ durum: type, saat, harita_link: haritaLink, enlem: lat, boylam: lon });
      setSent(type);
      setPhase("done");
    } catch {
      setErrMsg("Sunucuya bağlanılamadı.");
      setPhase("error");
    }
  };

  const handleType = async (type: string) => {
    setPendingType(type);
    setPhase("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => send(type, pos.coords.latitude, pos.coords.longitude),
      () => {
        setNeedManual(true);
        setPhase("select");
      },
      { timeout: 6000 }
    );
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon)) { setErrMsg("Geçerli koordinat girin."); return; }
    await send(pendingType, lat, lon);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#FFF0F5",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: 20,
      position: "relative",
    }}>
      {/* 112 grid background */}
      <div style={{ position: "fixed", inset: 0, display: "grid", gridTemplateColumns: "repeat(6,1fr)", gridTemplateRows: "repeat(5,1fr)", pointerEvents: "none", zIndex: 0 }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, fontWeight: 900, color: "rgba(211,47,47,0.12)" }}>112</span>
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 520, textAlign: "center" }}>
        <button
          onClick={() => navigate("/")}
          style={{ position: "absolute", top: -50, left: 0, background: "none", border: "1px solid #c53030", color: "#c53030", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          ← Ana Sayfa
        </button>

        <h1 style={{ color: "#b71c1c", fontSize: "2rem", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
          Acil Durum
        </h1>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 28 }}>
          Durumunuzu seçin — konumunuz otomatik iletilecek.
        </p>

        {phase === "loading" && (
          <div style={{ padding: 40, color: "#b71c1c", fontWeight: 700, fontSize: 16 }}>
            ⏳ Konum alınıyor ve bildirim gönderiliyor…
          </div>
        )}

        {phase === "done" && (
          <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 16, padding: 32, color: "#065f46" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Bildiriminiz Alındı</h2>
            <p style={{ marginTop: 8, fontSize: 14 }}>{sent}</p>
            <p style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>Yardım ekipleri yönlendiriliyor.</p>
            <button
              onClick={() => navigate("/")}
              style={{ marginTop: 20, padding: "10px 28px", background: "#065f46", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              Ana Sayfaya Dön
            </button>
          </div>
        )}

        {phase === "error" && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 16, padding: 32, color: "#991b1b" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>❌</div>
            <p style={{ fontWeight: 700 }}>{errMsg}</p>
            <button onClick={() => setPhase("select")} style={{ marginTop: 16, padding: "9px 22px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>
              Tekrar Dene
            </button>
          </div>
        )}

        {phase === "select" && !needManual && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => handleType(t.value)}
                style={{
                  padding: "20px 24px",
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 50,
                  fontSize: 18,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(211,47,47,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  transition: "transform .15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.03)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {phase === "select" && needManual && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 8px 24px rgba(0,0,0,.10)" }}>
            <p style={{ color: "#c53030", fontWeight: 700, marginBottom: 16 }}>
              ⚠️ Konum izni verilmedi. Koordinatı manuel girin.
            </p>
            <form onSubmit={handleManualSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="number" step="any" placeholder="Enlem (ör: 41.01)"
                value={manualLat} onChange={e => setManualLat(e.target.value)}
                required style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
              />
              <input
                type="number" step="any" placeholder="Boylam (ör: 28.97)"
                value={manualLon} onChange={e => setManualLon(e.target.value)}
                required style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
              />
              {errMsg && <p style={{ color: "#c53030", fontSize: 13 }}>{errMsg}</p>}
              <button type="submit" style={{ padding: "13px", background: "#d32f2f", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                Bildir: {pendingType}
              </button>
            </form>
          </div>
        )}

        {/* Emergency info cards */}
        {phase === "select" && (
          <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
            {[
              { title: "Deprem", tips: ["Çök-Kapan-Tutun yap.", "Pencerelerden uzak dur.", "Tahliye ol."] },
              { title: "Yangın", tips: ["Yere yakın hareket et.", "Asansörü kullanma.", "112'yi ara."] },
              { title: "Sel",    tips: ["Yükseklere çık.", "Elektrikleri kapat.", "Suya girme."] },
            ].map(c => (
              <div key={c.title} style={{ background: "linear-gradient(135deg,#fff,#ffe4e1)", borderRadius: 16, padding: 18, border: "1px solid #ffdde1", textAlign: "left" }}>
                <h3 style={{ color: "#b71c1c", margin: "0 0 10px", fontWeight: 800 }}>{c.title}</h3>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {c.tips.map(t => <li key={t} style={{ marginBottom: 6, fontSize: 14, color: "#222" }}>• {t}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
