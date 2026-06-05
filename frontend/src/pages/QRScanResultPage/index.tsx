import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface QRPayload {
  v?: number;
  name?: string;
  blood?: string;
  allergies?: string;
  medications?: string;
  conditions?: string;
  disability?: string;
  issued?: string;
  sig?: string;
}

function decode(encoded: string): QRPayload | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(encoded))));
  } catch {
    return null;
  }
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="identity-scan-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type VerifyStatus = "idle" | "verified" | "unverified" | "offline";

export default function QRScanResultPage() {
  const { t } = useTranslation();

  const { payload, raw } = useMemo<{ payload: QRPayload | null; raw: string | null }>(() => {
    const params = new URLSearchParams(window.location.search);
    const d = params.get("d");
    if (!d) return { payload: null, raw: null };
    return { payload: decode(d), raw: d };
  }, []);

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");

  useEffect(() => {
    if (!raw || !payload?.sig) return;

    const apiBase = process.env.REACT_APP_API_URL || "http://localhost:8000";
    fetch(`${apiBase}/api/v1/qr/verify?d=${encodeURIComponent(raw)}`)
      .then((r) => {
        setVerifyStatus(r.ok ? "verified" : "unverified");
      })
      .catch(() => {
        setVerifyStatus("offline");
      });
  }, [raw, payload?.sig]);

  if (!payload) {
    return (
      <div className="identity-shell">
        <main className="identity-main identity-centered">
          <section className="ops-panel identity-error-state">
            <span className="ops-eyebrow">QR</span>
            <h1>{t("qr.invalidQR")}</h1>
            <p>{t("qr.invalidQRDesc")}</p>
          </section>
        </main>
      </div>
    );
  }

  const hasHealthInfo = Boolean(
    payload.allergies || payload.medications || payload.conditions || payload.disability
  );

  const verifyBadge =
    verifyStatus === "verified" ? (
      <span className="resource-badge tone-safe">✓ {t("qr.verified")}</span>
    ) : verifyStatus === "unverified" ? (
      <span className="resource-badge tone-risk">✗ {t("qr.unverified")}</span>
    ) : verifyStatus === "offline" ? (
      <span className="resource-badge tone-neutral">{t("qr.verifyOffline")}</span>
    ) : null;

  return (
    <div className="identity-shell">
      <main className="identity-main identity-scan-main">
        <section className="identity-scan-header">
          <span className="ops-eyebrow">{t("qr.brand")}</span>
          <h1>{t("qr.scanTitle")}</h1>
          <p>{t("qr.scanSubtitle")}</p>
          {verifyBadge}
        </section>

        <section className="ops-panel identity-scan-card" aria-label={t("qr.scanTitle")}>
          <div className="identity-scan-person">
            <strong>{payload.name || "Ad bilgisi yok"}</strong>
            {payload.blood ? <span>{payload.blood}</span> : null}
          </div>

          <div className="identity-scan-rows">
            <Row label={t("qr.allergies")} value={payload.allergies} />
            <Row label={t("qr.medications")} value={payload.medications} />
            <Row label={t("qr.conditions")} value={payload.conditions} />
            <Row label={t("qr.disability")} value={payload.disability} />
            {!hasHealthInfo ? <p className="identity-qr-empty">{t("qr.noHealthInfo")}</p> : null}
          </div>
        </section>

        <section className="identity-scan-note">
          <strong>{t("qr.scanNote")}</strong>
          <p>{t("qr.scanNoteBody")}</p>
        </section>

        {payload.issued ? (
          <p className="identity-scan-meta">
            {t("qr.cardDate")}: {payload.issued}
          </p>
        ) : null}

        <p className="identity-scan-meta">{t("qr.offlineNote")}</p>
      </main>
    </div>
  );
}
