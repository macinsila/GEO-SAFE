import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OfflineConsentNotice,
  useOfflineQueue,
} from "../../offlineQueue/context";
import { geoSafeAPI } from "../../services";
import { ShelterOfferPayload } from "../../types";

export default function ShelterOfferPage() {
  const navigate = useNavigate();
  const { isOnline, submitOrQueue } = useOfflineQueue();
  const [form, setForm] = useState<ShelterOfferPayload>({
    host_name: "",
    contact_info: "",
    city: "",
    district: "",
    neighborhood: "",
    address_detail: "",
    capacity: 1,
    available_from: "",
    available_until: "",
    duration_note: "",
    household_notes: "",
    suitability_notes: "",
  });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [queueConsent, setQueueConsent] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        capacity: Number(form.capacity || 1),
        available_from: form.available_from || undefined,
        available_until: form.available_until || undefined,
      };
      const result = await submitOrQueue({
        type: "shelter",
        payload,
        hasConsent: isOnline ? true : queueConsent,
        submitOnline: async (nextPayload) => {
          await geoSafeAPI.submitShelterOffer(nextPayload);
        },
      });

      if (result === "consent_required") {
        setNeedsConsent(true);
        setMessage("Çevrim dışı kayıt için önce açık onay vermelisiniz.");
        return;
      }

      setMessage(
        result === "queued"
          ? "Teklifiniz internet gelince gönderilmek üzere bu cihazda geçici olarak saklandı."
          : "Teklifiniz alındı. Yetkililer tarafından değerlendirilecektir."
      );
      setNeedsConsent(false);
      setQueueConsent(false);
      setForm({
        host_name: "",
        contact_info: "",
        city: "",
        district: "",
        neighborhood: "",
        address_detail: "",
        capacity: 1,
        available_from: "",
        available_until: "",
        duration_note: "",
        household_notes: "",
        suitability_notes: "",
      });
    } catch {
      setMessage("Teklif gönderilemedi. Lütfen tekrar deneyin.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Outfit','Segoe UI',system-ui,sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "1px solid #0f766e", color: "#0f766e", borderRadius: 10, padding: "6px 14px", fontWeight: 600, cursor: "pointer", marginBottom: 16 }}
        >
          Ana Sayfa
        </button>

        <div style={{ background: "#fff", borderRadius: 16, padding: "24px 26px", boxShadow: "0 10px 30px rgba(15,118,110,.12)", border: "1px solid #ccfbf1" }}>
          <h1 style={{ margin: 0, fontSize: 22, color: "#0f766e" }}>Evimi Barınma Desteği İçin Bildirmek İstiyorum</h1>
          <p style={{ marginTop: 6, color: "#475569", fontSize: 13 }}>
            Bu bilgiler halka açık paylaşılmaz. Başvurular yetkililer tarafından değerlendirilir. Otomatik eşleştirme yapılmaz.
          </p>

          <form onSubmit={handleSubmit} style={{ marginTop: 20, display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Ev Sahibi Ad Soyad</label>
              <input
                required
                value={form.host_name}
                onChange={(e) => setForm((prev) => ({ ...prev, host_name: e.target.value }))}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5" }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Telefon / İletişim</label>
              <input
                required
                value={form.contact_info}
                onChange={(e) => setForm((prev) => ({ ...prev, contact_info: e.target.value }))}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Şehir</label>
                <input
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5" }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>İlçe</label>
                <input
                  value={form.district}
                  onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5" }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Mahalle</label>
                <input
                  value={form.neighborhood}
                  onChange={(e) => setForm((prev) => ({ ...prev, neighborhood: e.target.value }))}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Açık Adres Detayı (Admin Görür)</label>
              <textarea
                rows={3}
                value={form.address_detail}
                onChange={(e) => setForm((prev) => ({ ...prev, address_detail: e.target.value }))}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Kapasite</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={form.capacity}
                  onChange={(e) => setForm((prev) => ({ ...prev, capacity: Number(e.target.value) }))}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5" }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Başlangıç Tarihi</label>
                <input
                  type="date"
                  value={form.available_from}
                  onChange={(e) => setForm((prev) => ({ ...prev, available_from: e.target.value }))}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5" }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Bitiş Tarihi</label>
                <input
                  type="date"
                  value={form.available_until}
                  onChange={(e) => setForm((prev) => ({ ...prev, available_until: e.target.value }))}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Süre / Müsaitlik Notu</label>
              <textarea
                rows={2}
                value={form.duration_note}
                onChange={(e) => setForm((prev) => ({ ...prev, duration_note: e.target.value }))}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Hane Notları</label>
              <textarea
                rows={2}
                value={form.household_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, household_notes: e.target.value }))}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5", resize: "vertical" }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Uygunluk Notları</label>
              <textarea
                rows={2}
                value={form.suitability_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, suitability_notes: e.target.value }))}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5", resize: "vertical" }}
              />
            </div>

            {(!isOnline || needsConsent) && (
              <OfflineConsentNotice checked={queueConsent} onChange={setQueueConsent} />
            )}

            {message && (
              <div style={{ fontSize: 13, fontWeight: 600, color: message.startsWith("Teklifiniz") ? "#166534" : "#b91c1c" }}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              style={{
                padding: "12px",
                borderRadius: 12,
                border: "none",
                background: sending ? "#94a3b8" : "linear-gradient(135deg,#14b8a6,#0d9488)",
                color: "#fff",
                fontWeight: 700,
                cursor: sending ? "not-allowed" : "pointer",
              }}
            >
              {sending ? "Gönderiliyor..." : "Teklifi Gönder"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
