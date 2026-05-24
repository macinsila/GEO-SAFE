import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FieldError, FormStatus } from "../../components/FormUX";
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

type VolunteerErrors = Partial<Record<keyof VolunteerApplicationPayload | "queue", string>>;
type SubmitState = "idle" | "submitting" | "submitted" | "queued" | "error";

const emptyForm: VolunteerApplicationPayload = {
  full_name: "",
  contact_info: "",
  district: "",
  neighborhood: "",
  skills: [],
  availability_note: "",
};

function validateVolunteer(form: VolunteerApplicationPayload) {
  const errors: VolunteerErrors = {};
  if (!form.full_name.trim()) errors.full_name = "Ad soyad alanı zorunludur.";
  if (!form.contact_info.trim()) errors.contact_info = "Telefon veya erişilebilir iletişim bilgisi girin.";
  if (form.skills.length === 0) errors.skills = "En az bir destek alanı seçin.";
  return errors;
}

export default function VolunteerPage() {
  const navigate = useNavigate();
  const { isOnline, submitOrQueue } = useOfflineQueue();
  const [form, setForm] = useState<VolunteerApplicationPayload>(emptyForm);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errors, setErrors] = useState<VolunteerErrors>({});
  const [queueConsent, setQueueConsent] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);

  const sending = submitState === "submitting";

  const update = <K extends keyof VolunteerApplicationPayload>(key: K, value: VolunteerApplicationPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (submitState === "error") setSubmitState("idle");
  };

  const toggleSkill = (skill: string) => {
    setForm((prev) => {
      const exists = prev.skills.includes(skill);
      const nextSkills = exists
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill];
      return { ...prev, skills: nextSkills };
    });
    setErrors((prev) => ({ ...prev, skills: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateVolunteer(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setSubmitState("error");
      return;
    }

    setSubmitState("submitting");
    setErrors({});
    try {
      const payload: VolunteerApplicationPayload = {
        ...form,
        district: form.district?.trim() || undefined,
        neighborhood: form.neighborhood?.trim() || undefined,
        availability_note: form.availability_note?.trim() || undefined,
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
        setErrors({ queue: "Çevrimdışı kayıt için açık onay vermelisiniz." });
        setSubmitState("error");
        return;
      }

      setNeedsConsent(false);
      setQueueConsent(false);
      setForm(emptyForm);
      setSubmitState(result === "queued" ? "queued" : "submitted");
    } catch {
      setErrors({ queue: "Başvuru gönderilemedi. Bağlantıyı kontrol edip tekrar deneyin." });
      setSubmitState("error");
    }
  };

  return (
    <div className="public-form-shell">
      <main className="public-form-main">
        <button className="ops-button secondary" onClick={() => navigate("/")} type="button">
          Ana Sayfa
        </button>

        <section className="ops-panel public-form-card">
          <div className="public-form-head">
            <span className="ops-eyebrow">Gönüllü Başvurusu</span>
            <h1>Gönüllü olabilirim</h1>
            <p>
              Bilgileriniz halka açık paylaşılmaz. Başvurular operasyon ekibi tarafından değerlendirilir.
            </p>
          </div>

          {submitState === "submitted" ? (
            <FormStatus
              tone="success"
              title="Başvurunuz alındı"
              actions={
                <>
                  <button className="ops-button primary" onClick={() => navigate("/duyurular")} type="button">
                    Duyurulara Git
                  </button>
                  <button className="ops-button secondary" onClick={() => setSubmitState("idle")} type="button">
                    Yeni Başvuru
                  </button>
                </>
              }
            >
              Yetkililer başvurunuzu inceleyecek. Güncel yönlendirmeleri duyurular ekranından takip edebilirsiniz.
            </FormStatus>
          ) : null}

          {submitState === "queued" ? (
            <FormStatus
              tone="warning"
              title="İnternet gelince gönderilecek"
              actions={
                <button className="ops-button secondary" onClick={() => navigate("/")} type="button">
                  Ana Sayfaya Dön
                </button>
              }
            >
              Başvurunuz bu cihazda geçici olarak saklandı. Bağlantı geri geldiğinde gönderilecek.
            </FormStatus>
          ) : null}

          {errors.queue ? <FormStatus tone="error" title="Form gönderilemedi">{errors.queue}</FormStatus> : null}

          <form className="public-form-grid" onSubmit={handleSubmit} noValidate>
            <label className="form-field" htmlFor="volunteer-full-name">
              <span>Ad Soyad <b>Zorunlu</b></span>
              <input
                id="volunteer-full-name"
                aria-describedby={errors.full_name ? "volunteer-full-name-error" : undefined}
                aria-invalid={Boolean(errors.full_name)}
                value={form.full_name}
                onChange={(event) => update("full_name", event.target.value)}
              />
              <FieldError id="volunteer-full-name-error" message={errors.full_name} />
            </label>

            <label className="form-field" htmlFor="volunteer-contact">
              <span>Telefon / İletişim <b>Zorunlu</b></span>
              <input
                id="volunteer-contact"
                aria-describedby={errors.contact_info ? "volunteer-contact-error" : undefined}
                aria-invalid={Boolean(errors.contact_info)}
                value={form.contact_info}
                onChange={(event) => update("contact_info", event.target.value)}
              />
              <FieldError id="volunteer-contact-error" message={errors.contact_info} />
            </label>

            <div className="public-form-row">
              <label className="form-field" htmlFor="volunteer-district">
                <span>İlçe</span>
                <input
                  id="volunteer-district"
                  value={form.district ?? ""}
                  onChange={(event) => update("district", event.target.value)}
                />
              </label>
              <label className="form-field" htmlFor="volunteer-neighborhood">
                <span>Mahalle</span>
                <input
                  id="volunteer-neighborhood"
                  value={form.neighborhood ?? ""}
                  onChange={(event) => update("neighborhood", event.target.value)}
                />
              </label>
            </div>

            <fieldset className="form-fieldset" aria-describedby={errors.skills ? "volunteer-skills-error" : undefined}>
              <legend>Beceriler <b>Zorunlu</b></legend>
              <div className="form-chip-grid">
                {SKILLS.map((skill) => {
                  const selected = form.skills.includes(skill);
                  return (
                    <button
                      className={`form-chip ${selected ? "selected" : ""}`}
                      type="button"
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      aria-pressed={selected}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
              <FieldError id="volunteer-skills-error" message={errors.skills} />
            </fieldset>

            <label className="form-field" htmlFor="volunteer-note">
              <span>Müsaitlik Notu</span>
              <textarea
                id="volunteer-note"
                rows={3}
                value={form.availability_note ?? ""}
                onChange={(event) => update("availability_note", event.target.value)}
              />
            </label>

            {(!isOnline || needsConsent) ? (
              <OfflineConsentNotice checked={queueConsent} onChange={setQueueConsent} />
            ) : null}

            <button className="ops-button primary public-form-submit" type="submit" disabled={sending}>
              {sending ? "Kaydediliyor..." : "Başvuruyu Gönder"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
