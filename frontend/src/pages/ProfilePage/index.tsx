import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { FieldError, FormStatus } from "../../components/FormUX";
import { geoSafeAPI } from "../../services";
import { GeofenceAlertCard } from "../../components/GeofenceAlertCard";

interface ProfileForm {
  name: string;
  blood: string;
  allergy: string;
  meds: string;
  chronic: string;
  disability_notes: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  phone: string;
}

interface QRPayload {
  v: number;
  name: string;
  blood: string;
  allergies: string;
  medications: string;
  conditions: string;
  disability: string;
  issued: string;
}

type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;

const BLOOD_TYPES = ["", "A Rh+", "A Rh-", "B Rh+", "B Rh-", "AB Rh+", "AB Rh-", "0 Rh+", "0 Rh-"];

const empty: ProfileForm = {
  name: "",
  blood: "",
  allergy: "",
  meds: "",
  chronic: "",
  disability_notes: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  phone: "",
};

export function encodeQrPayload(obj: object): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

export function decodeQrPayload<T = unknown>(value: string): T {
  return JSON.parse(decodeURIComponent(escape(atob(value)))) as T;
}

export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Profil adı bekleniyor";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function buildPreviewPayload(form: ProfileForm): QRPayload {
  return {
    v: 1,
    name: maskName(form.name),
    blood: form.blood,
    allergies: form.allergy.slice(0, 200),
    medications: form.meds.slice(0, 200),
    conditions: form.chronic.slice(0, 200),
    disability: form.disability_notes.slice(0, 200),
    issued: new Date().toISOString().slice(0, 10),
  };
}

function FieldLabel({
  label,
  badge,
  badgeTone = "neutral",
}: {
  label: string;
  badge: string;
  badgeTone?: "safe" | "warning" | "neutral";
}) {
  return (
    <span className="identity-label-row">
      <span>{label}</span>
      <b className={`tone-${badgeTone}`}>{badge}</b>
    </span>
  );
}

function QRRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="identity-qr-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function validateProfile(form: ProfileForm) {
  const errors: ProfileErrors = {};
  if (!form.name.trim()) {
    errors.name = "Ad Soyad alanı zorunludur. QR kartında adınız maskeli gösterilir.";
  }
  if (form.phone.trim() && form.phone.trim().length < 10) {
    errors.phone = "Telefon numarasını alan koduyla birlikte girin.";
  }
  if (form.emergency_contact_phone.trim() && form.emergency_contact_phone.trim().length < 10) {
    errors.emergency_contact_phone = "Yakın kişi telefonu alan koduyla birlikte girilmelidir.";
  }
  return errors;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProfileErrors>({});

  useEffect(() => {
    geoSafeAPI
      .fetchProfile()
      .then((data) => setForm({ ...empty, ...(data as Partial<ProfileForm>) }))
      .catch(() => setMsg({ text: "Profil yüklenemedi. Oturumunuzu yenileyip tekrar deneyin.", ok: false }))
      .finally(() => setLoading(false));
  }, []);

  const previewPayload = useMemo(() => buildPreviewPayload(form), [form]);
  const qrUrl = `${window.location.origin}/qr-result?d=${encodeQrPayload(previewPayload)}`;
  const healthFieldCount = [form.allergy, form.meds, form.chronic, form.disability_notes].filter((value) =>
    value.trim()
  ).length;
  const completionItems = [form.name, form.blood, form.phone, form.emergency_contact_name, form.emergency_contact_phone];
  const completion = Math.round(
    ((completionItems.filter((value) => value.trim()).length + healthFieldCount) /
      (completionItems.length + 4)) *
      100
  );
  const hasHealthInfo = healthFieldCount > 0;

  const set = (key: keyof ProfileForm, val: string) => {
    setForm((current) => ({ ...current, [key]: val }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = async () => {
    const nextErrors = validateProfile(form);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setMsg({ text: "Lütfen işaretlenen alanları düzeltin.", ok: false });
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setMsg(null);
    try {
      await geoSafeAPI.updateProfile(form as unknown as Record<string, string>);
      setMsg({ text: "Profil kaydedildi. QR kartınız güncel bilgilerle oluşturulabilir.", ok: true });
    } catch {
      setMsg({ text: "Kayıt başarısız. Bağlantıyı veya oturum durumunu kontrol edin.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="identity-shell">
        <main className="identity-main identity-centered">
          <div className="ops-panel identity-loading">Profil yükleniyor...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="identity-shell">
      <header className="identity-topbar">
        <div className="identity-brand">
          <div className="ops-mark">GS</div>
          <div>
            <strong>Afet Kimlik Profili</strong>
            <span>Operasyon hesabı / QR sağlık özeti</span>
          </div>
        </div>
        <div className="identity-topbar-actions">
          <button className="ops-button secondary" onClick={() => navigate("/ops")} type="button">
            Operasyona dön
          </button>
          <button className="ops-button primary" onClick={() => navigate("/qr-card")} type="button">
            QR Kimlik
          </button>
        </div>
      </header>

      <main className="identity-main">
        <section className="identity-hero">
          <div>
            <span className="ops-eyebrow">Kişisel Hazırlık</span>
            <h1>QR kimliğiniz için gerekli bilgileri tamamlayın.</h1>
            <p>
              T.C. kimlik numarası, açık adres ve detaylı tıbbi geçmiş kaydedilmez. QR kartında yalnızca
              acil müdahalede işe yarayan kısa sağlık özeti yer alır.
            </p>
          </div>
          <div className="identity-progress">
            <span>Profil tamamlanma</span>
            <strong>{completion}%</strong>
            <div className="identity-progress-bar" aria-hidden="true">
              <i style={{ width: `${completion}%` }} />
            </div>
          </div>
        </section>

        {msg ? (
          <FormStatus
            tone={msg.ok ? "success" : "error"}
            title={msg.ok ? "Profil kaydedildi" : "Profil kaydedilemedi"}
            actions={
              msg.ok ? (
                <button className="ops-button primary" onClick={() => navigate("/qr-card")} type="button">
                  QR Kartı Aç
                </button>
              ) : null
            }
          >
            {msg.text}
          </FormStatus>
        ) : null}

        <div className="identity-grid">
          <div className="identity-form-stack">
            <section className="ops-panel">
              <div className="ops-section-header">
                <div>
                  <span className="ops-eyebrow">Temel Bilgiler</span>
                  <h2>Kimlik Özeti</h2>
                </div>
                <span className="ops-meta">QR için temel</span>
              </div>
              <div className="identity-section-body">
                <label className="identity-field">
                  <FieldLabel label="Ad Soyad" badge="Zorunlu" badgeTone="warning" />
                  <input
                    className="identity-input"
                    type="text"
                    maxLength={100}
                    required
                    aria-describedby={fieldErrors.name ? "profile-name-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.name)}
                    value={form.name}
                    onChange={(event) => set("name", event.target.value)}
                    placeholder="Adınız Soyadınız"
                  />
                  <FieldError id="profile-name-error" message={fieldErrors.name} />
                  <small>QR kartında tam ad yerine maskeli ad görünür. Örnek: Ayşe Y.</small>
                </label>

                <label className="identity-field">
                  <FieldLabel label="Kan Grubu" badge="Önerilir" badgeTone="safe" />
                  <select
                    className="identity-select"
                    value={form.blood}
                    onChange={(event) => set("blood", event.target.value)}
                  >
                    {BLOOD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type || "Seçiniz"}
                      </option>
                    ))}
                  </select>
                  <small>Boş bırakılırsa QR kartında kan grubu satırı gösterilmez.</small>
                </label>

                <label className="identity-field">
                  <FieldLabel label="Telefon" badge="Opsiyonel" />
                  <input
                    className="identity-input"
                    type="tel"
                    maxLength={20}
                    aria-describedby={fieldErrors.phone ? "profile-phone-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    value={form.phone}
                    onChange={(event) => set("phone", event.target.value)}
                    placeholder="0532 XXX XXXX"
                  />
                  <FieldError id="profile-phone-error" message={fieldErrors.phone} />
                  <small>Bu bilgi profilinizde saklanır, QR sağlık özetine yazılmaz.</small>
                </label>
              </div>
            </section>

            <section className="ops-panel">
              <div className="ops-section-header">
                <div>
                  <span className="ops-eyebrow">Sağlık Bilgileri</span>
                  <h2>QR'da Gösterilecek Alanlar</h2>
                </div>
                <span className="ops-meta">Opsiyonel</span>
              </div>
              <div className="identity-section-body">
                <label className="identity-field">
                  <FieldLabel label="Alerjiler" badge="Opsiyonel" />
                  <textarea
                    className="identity-textarea"
                    maxLength={200}
                    rows={3}
                    value={form.allergy}
                    onChange={(event) => set("allergy", event.target.value)}
                    placeholder="Örn. Penisilin, fıstık"
                  />
                </label>

                <label className="identity-field">
                  <FieldLabel label="Süregelen İlaçlar" badge="Opsiyonel" />
                  <textarea
                    className="identity-textarea"
                    maxLength={200}
                    rows={3}
                    value={form.meds}
                    onChange={(event) => set("meds", event.target.value)}
                    placeholder="Örn. Metformin 500mg, Ramipril 5mg"
                  />
                </label>

                <label className="identity-field">
                  <FieldLabel label="Kronik Rahatsızlık" badge="Opsiyonel" />
                  <textarea
                    className="identity-textarea"
                    maxLength={200}
                    rows={3}
                    value={form.chronic}
                    onChange={(event) => set("chronic", event.target.value)}
                    placeholder="Örn. Diyabet Tip 2, Hipertansiyon"
                  />
                </label>

                <label className="identity-field">
                  <FieldLabel label="Hareket / İletişim Kısıtı" badge="Opsiyonel" />
                  <input
                    className="identity-input"
                    type="text"
                    maxLength={200}
                    value={form.disability_notes}
                    onChange={(event) => set("disability_notes", event.target.value)}
                    placeholder="Örn. Tekerlekli sandalye, işitme cihazı"
                  />
                </label>
              </div>
            </section>

            <section className="ops-panel">
              <div className="ops-section-header">
                <div>
                  <span className="ops-eyebrow">Acil İletişim</span>
                  <h2>Profilde Saklanan Bilgiler</h2>
                </div>
                <span className="ops-meta">QR'a yazılmaz</span>
              </div>
              <div className="identity-section-body">
                <p className="identity-note">
                  Yakın kişi bilgileri operasyon hesabınızda tutulur. QR koduna yazılmaz ve tarama ekranında
                  görünmez.
                </p>
                <label className="identity-field">
                  <FieldLabel label="Yakın Kişi Adı" badge="Opsiyonel" />
                  <input
                    className="identity-input"
                    type="text"
                    maxLength={100}
                    value={form.emergency_contact_name}
                    onChange={(event) => set("emergency_contact_name", event.target.value)}
                    placeholder="Ad Soyad"
                  />
                </label>

                <label className="identity-field">
                  <FieldLabel label="Yakın Kişi Telefonu" badge="Opsiyonel" />
                  <input
                    className="identity-input"
                    type="tel"
                    maxLength={20}
                    aria-describedby={fieldErrors.emergency_contact_phone ? "profile-emergency-phone-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.emergency_contact_phone)}
                    value={form.emergency_contact_phone}
                    onChange={(event) => set("emergency_contact_phone", event.target.value)}
                    placeholder="0532 XXX XXXX"
                  />
                  <FieldError id="profile-emergency-phone-error" message={fieldErrors.emergency_contact_phone} />
                </label>
              </div>
            </section>

            <div className="identity-actions">
              <button className="ops-button primary" type="button" onClick={save} disabled={saving}>
                {saving ? "Kaydediliyor..." : "Profili Kaydet"}
              </button>
              <button className="ops-button secondary" type="button" onClick={() => navigate("/qr-card")}>
                QR Kartı Aç
              </button>
            </div>
          </div>

          <aside className="ops-panel identity-preview-panel">
            <div className="ops-section-header">
              <div>
                <span className="ops-eyebrow">Canlı Önizleme</span>
                <h2>QR Kimlik Kartı</h2>
              </div>
              <span className={`resource-badge ${form.name.trim() ? "tone-safe" : "tone-warning"}`}>
                {form.name.trim() ? "Hazır" : "Eksik"}
              </span>
            </div>

            <div className="identity-preview-body">
              <div className="identity-qr-card">
                <div className="identity-qr-card-head">
                  <div>
                    <span className="identity-qr-brand">GeoSafe</span>
                    <span className="identity-qr-title">Afet Kimlik Kartı</span>
                    <strong className="identity-qr-name">{previewPayload.name}</strong>
                    {previewPayload.blood ? <em>{previewPayload.blood}</em> : null}
                  </div>
                  <div className="identity-qr-code">
                    <QRCodeSVG value={qrUrl} size={104} level="M" />
                  </div>
                </div>

                <div className="identity-qr-fields">
                  <QRRow label="Alerjiler" value={previewPayload.allergies} />
                  <QRRow label="İlaçlar" value={previewPayload.medications} />
                  <QRRow label="Kronik" value={previewPayload.conditions} />
                  <QRRow label="Kısıt" value={previewPayload.disability} />
                  {!hasHealthInfo ? <p className="identity-qr-empty">Sağlık bilgisi girilmemiş.</p> : null}
                </div>
              </div>

              <div className="identity-info-list">
                <div>
                  <strong>Profil eksikse QR'da ne görünür?</strong>
                  <span>
                    QR kartı yine oluşturulur; boş bırakılan sağlık alanları kartta ve tarama ekranında
                    gösterilmez.
                  </span>
                </div>
                <div>
                  <strong>Hangi bilgiler QR'a yazılmaz?</strong>
                  <span>Telefon ve acil yakın bilgileri yalnızca profil kaydında tutulur.</span>
                </div>
                <div>
                  <strong>Kaydetmeden önce</strong>
                  <span>Önizleme canlıdır; gerçek QR kart için önce profili kaydedin.</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: "18px" }}>
              <GeofenceAlertCard />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
