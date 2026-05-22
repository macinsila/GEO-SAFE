import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OfflineConsentNotice,
  useOfflineQueue,
} from "../../offlineQueue/context";
import { geoSafeAPI } from "../../services";
import { VolunteerApplicationPayload } from "../../types";

const SKILLS = [
  "İlk yardım",
  "Araç desteği",
  "Taşımacılık/lojistik",
  "Çeviri",
  "Psikolojik destek",
  "Teknik destek",
  "Diğer",
];

export default function VolunteerPage() {
  const navigate = useNavigate();
  const { isOnline, submitOrQueue } = useOfflineQueue();
  const [form, setForm] = useState<VolunteerApplicationPayload>({
    full_name: "",
    contact_info: "",
    district: "",
    neighborhood: "",
    skills: [],
    availability_note: "",
  });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [queueConsent, setQueueConsent] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);

  const toggleSkill = (skill: string) => {
    setForm((prev) => {
      const exists = prev.skills.includes(skill);
      const nextSkills = exists
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill];
      return { ...prev, skills: nextSkills };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        skills: form.skills,
      };
      const result = await submitOrQueue({
        type: "volunteer",
        payload,
        hasConsent: isOnline ? true : queueConsent,
        submitOnline: async (nextPayload) => {
          await geoSafeAPI.submitVolunteerApplication(nextPayload);
        },
      });

      if (result === "consent_required") {
        setNeedsConsent(true);
        setMessage("Çevrim dışı kayıt için önce açık onay vermelisiniz.");
        return;
      }

      setMessage(
        result === "queued"
          ? "Başvurunuz internet gelince gönderilmek üzere bu cihazda geçici olarak saklandı."
          : "Başvurunuz alındı. Yetkililer tarafından değerlendirilecektir."
      );
      setNeedsConsent(false);
      setQueueConsent(false);
      setForm({
        full_name: "",
        contact_info: "",
        district: "",
        neighborhood: "",
        skills: [],
        availability_note: "",
      });
    } catch {
      setMessage("Başvuru gönderilemedi. Lütfen tekrar deneyin.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Outfit','Segoe UI',system-ui,sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "1px solid #0f766e", color: "#0f766e", borderRadius: 10, padding: "6px 14px", fontWeight: 600, cursor: "pointer", marginBottom: 16 }}
        >
          Ana Sayfa
        </button>

        <div style={{ background: "#fff", borderRadius: 16, padding: "24px 26px", boxShadow: "0 10px 30px rgba(15,118,110,.12)", border: "1px solid #ccfbf1" }}>
          <h1 style={{ margin: 0, fontSize: 22, color: "#0f766e" }}>Gönüllü Olabilirim</h1>
          <p style={{ marginTop: 6, color: "#475569", fontSize: 13 }}>
            Bilgileriniz halka açık olarak paylaşılmaz. Başvurular yetkililer tarafından incelenir.
          </p>

          <form onSubmit={handleSubmit} style={{ marginTop: 20, display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Ad Soyad</label>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
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

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Beceriler</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SKILLS.map((skill) => {
                  const selected = form.skills.includes(skill);
                  return (
                    <button
                      type="button"
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: selected ? "1px solid #0f766e" : "1px solid #cbd5f5",
                        background: selected ? "#ccfbf1" : "#fff",
                        color: "#0f766e",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#0f766e" }}>Müsaitlik Notu</label>
              <textarea
                rows={3}
                value={form.availability_note}
                onChange={(e) => setForm((prev) => ({ ...prev, availability_note: e.target.value }))}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5f5", resize: "vertical" }}
              />
            </div>

            {(!isOnline || needsConsent) && (
              <OfflineConsentNotice checked={queueConsent} onChange={setQueueConsent} />
            )}

            {message && (
              <div style={{ fontSize: 13, fontWeight: 600, color: message.startsWith("Başvurunuz") ? "#166534" : "#b91c1c" }}>
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
              {sending ? "Gönderiliyor..." : "Başvuruyu Gönder"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
