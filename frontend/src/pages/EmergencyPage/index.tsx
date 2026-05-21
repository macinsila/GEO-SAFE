import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OfflineConsentNotice,
  useOfflineQueue,
} from "../../offlineQueue/context";
import { geoSafeAPI } from "../../services";

type Phase = "form" | "loading" | "done" | "error";

const CATEGORIES = [
  { label: "Enkaz Altındayım", value: "Enkaz Altindayim" },
  { label: "Yaralıyım", value: "Yaraliyim" },
  { label: "Yangın Var", value: "Yangin Var" },
  { label: "Sel Var", value: "Sel Var" },
  { label: "Diğer Acil", value: "Diger Acil" },
];

export default function EmergencyPage() {
  const navigate = useNavigate();
  const { isOnline, submitOrQueue } = useOfflineQueue();
  const [phase, setPhase] = useState<Phase>("form");
  const [errMsg, setErrMsg] = useState("");
  const [sentMsg, setSentMsg] = useState("");

  const [kategori, setKategori] = useState(CATEGORIES[0].value);
  const [aciklama, setAciklama] = useState("");

  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [needManual, setNeedManual] = useState(false);
  const [queueConsent, setQueueConsent] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);

  const send = async (lat: number, lon: number) => {
    setPhase("loading");
    const saat = new Date().toLocaleString("tr-TR");
    const haritaLink = `https://www.google.com/maps?q=${lat},${lon}`;
    try {
      const result = await submitOrQueue({
        type: "emergency",
        payload: {
          durum: kategori,
          kategori,
          aciklama: aciklama.trim() || undefined,
          saat,
          harita_link: haritaLink,
          enlem: lat,
          boylam: lon,
        },
        hasConsent: isOnline ? true : queueConsent,
        submitOnline: async (payload) => {
          await geoSafeAPI.sendEmergency(payload);
        },
      });

      if (result === "consent_required") {
        setNeedsConsent(true);
        setErrMsg("Çevrimdışı kayıt için önce açık onay vermelisiniz.");
        setPhase("form");
        return;
      }

      setSentMsg(
        result === "queued"
          ? `${kategori} bildirimi internet gelince gönderilecek.`
          : kategori
      );
      setNeedsConsent(false);
      setQueueConsent(false);
      setErrMsg("");
      setPhase("done");
    } catch {
      setErrMsg("Sunucuya bağlanılamadı.");
      setPhase("error");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (needManual) {
      const lat = parseFloat(manualLat);
      const lon = parseFloat(manualLon);
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        setErrMsg("Geçerli koordinat girin.");
        return;
      }
      await send(lat, lon);
      return;
    }

    setPhase("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => void send(pos.coords.latitude, pos.coords.longitude),
      () => {
        setNeedManual(true);
        setPhase("form");
      },
      { timeout: 6000 }
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFF0F5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: 20,
        position: "relative",
      }}
    >
      <div style={{ position: "fixed", inset: 0, display: "grid", gridTemplateColumns: "repeat(6,1fr)", gridTemplateRows: "repeat(5,1fr)", pointerEvents: "none", zIndex: 0 }}>
        {Array.from({ length: 30 }).map((_, index) => (
          <span key={index} style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, fontWeight: 900, color: "rgba(211,47,47,0.12)" }}>112</span>
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 520, textAlign: "center" }}>
        <button
          onClick={() => navigate("/")}
          style={{ position: "absolute", top: -50, left: 0, background: "none", border: "1px solid #c53030", color: "#c53030", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          Ana Sayfa
        </button>

        <h1 style={{ color: "#b71c1c", fontSize: "2rem", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>
          Acil Durum
        </h1>
        <p style={{ color: "#555", fontSize: 14, marginBottom: 28 }}>
          Yardım kategorisini seçin, açıklama ekleyin. Konumunuz otomatik alınır.
        </p>

        {phase === "loading" && (
          <div style={{ padding: 40, color: "#b71c1c", fontWeight: 700, fontSize: 16 }}>
            Konum alınıyor ve bildirim hazırlanıyor...
          </div>
        )}

        {phase === "done" && (
          <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 16, padding: 32, color: "#065f46" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
            <h2 style={{ margin: 0, fontSize: 20 }}>Bildirim Kaydedildi</h2>
            <p style={{ marginTop: 8, fontSize: 14 }}>{sentMsg}</p>
            <p style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>
              Çevrimiçiyseniz hemen gönderildi. Çevrimdışıyseniz internet gelince otomatik veya manuel sync ile iletilecek.
            </p>
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
            <div style={{ fontSize: 40, marginBottom: 10 }}>✕</div>
            <p style={{ fontWeight: 700 }}>{errMsg}</p>
            <button onClick={() => setPhase("form")} style={{ marginTop: 16, padding: "9px 22px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700 }}>
              Tekrar Dene
            </button>
          </div>
        )}

        {(phase === "form") && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 8px 24px rgba(0,0,0,.10)" }}>
            {(needsConsent || !isOnline) && (
              <div style={{ marginBottom: 16 }}>
                <OfflineConsentNotice checked={queueConsent} onChange={setQueueConsent} />
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#7f1d1d", marginBottom: 6 }}>
                  Yardım Kategorisi *
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  required
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: "2px solid #fca5a5", fontSize: 15, fontWeight: 600, color: "#7f1d1d", background: "#fff7f7", cursor: "pointer" }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
                  Açıklama (isteğe bağlı)
                </label>
                <textarea
                  value={aciklama}
                  onChange={(e) => setAciklama(e.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder="Durumunuzu kısaca açıklayın... (kat, konum ipucu vb.)"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
                />
                <div style={{ fontSize: 11, color: "#999", textAlign: "right", marginTop: 2 }}>{aciklama.length}/280</div>
              </div>

              {needManual && (
                <>
                  <p style={{ color: "#c53030", fontWeight: 600, fontSize: 13, margin: 0 }}>
                    Konum izni verilmedi. Koordinatı manuel girin.
                  </p>
                  <input
                    type="number"
                    step="any"
                    placeholder="Enlem (örn: 41.01)"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    required
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Boylam (örn: 28.97)"
                    value={manualLon}
                    onChange={(e) => setManualLon(e.target.value)}
                    required
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ccc", fontSize: 14 }}
                  />
                </>
              )}

              {errMsg && <p style={{ color: "#c53030", fontSize: 13, margin: 0 }}>{errMsg}</p>}

              <button
                type="submit"
                style={{
                  padding: "16px",
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 6px 18px rgba(211,47,47,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Yardım Çağır
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
