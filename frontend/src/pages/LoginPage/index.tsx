import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI } from "../../services";

type Tab = "login" | "register";
type MsgType = "success" | "error" | "info" | null;

interface Msg {
  type: MsgType;
  text: string;
}

const LOGIN_TIMEOUT_MS = 60000;

function withTimeout<T>(promise: Promise<T>, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), LOGIN_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED") {
      return "Backend 60 saniye icinde yanit vermedi. Render servisi uyaniyor olabilir; biraz sonra tekrar deneyin veya Render loglarini kontrol edin.";
    }

    if (!error.response && error.message === "Network Error") {
      return "Backend'e ulasilamadi. Render URL'i veya CORS_ORIGINS ayari hatali olabilir.";
    }

    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first && typeof first.msg === "string") {
        return first.msg;
      }
    }
    if (typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [msg, setMsg] = useState<Msg>({ type: null, text: "" });
  const [loading, setLoading] = useState(false);

  const showMsg = (type: MsgType, text: string) => setMsg({ type, text });
  const clearMsg = () => setMsg({ type: null, text: "" });
  const switchTab = (nextTab: Tab) => {
    setTab(nextTab);
    clearMsg();
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    clearMsg();
    try {
      const token = await withTimeout(
        geoSafeAPI.login(loginEmail, loginPassword),
        "Login istegi 60 saniye icinde yanit alamadi. Render servisi, Supabase baglantisi veya backend loglari kontrol edilmeli."
      );
      login(token);
      navigate("/");
    } catch (error) {
      showMsg("error", getErrorMessage(error, "E-posta veya sifre hatali."));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    clearMsg();
    try {
      await withTimeout(
        geoSafeAPI.register(regName || "Kullanici", regEmail, regPassword),
        "Kayit istegi 60 saniye icinde yanit alamadi. Render servisi, Supabase baglantisi veya backend loglari kontrol edilmeli."
      );
      const token = await withTimeout(
        geoSafeAPI.login(regEmail, regPassword),
        "Login istegi 60 saniye icinde yanit alamadi. Render servisi, Supabase baglantisi veya backend loglari kontrol edilmeli."
      );
      login(token);
      navigate("/");
    } catch (error) {
      showMsg("error", getErrorMessage(error, "Kayit basarisiz. E-posta zaten kullaniliyor olabilir."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-intel-panel" aria-label="GeoSafe platform context">
        <div className="ops-brand auth-brand">
          <div className="ops-mark">GS</div>
          <div>
            <strong>GeoSafe</strong>
            <span>Emergency Logistics</span>
          </div>
        </div>

        <div className="auth-intel-copy">
          <span className="ops-eyebrow">Secure Operations Access</span>
          <h1>Geospatial decision support for field-ready disaster operations.</h1>
          <p>
            Shelter zones, depot readiness, emergency reports and logistics signals are kept in one
            controlled operational workspace.
          </p>
        </div>

        <div className="auth-signal-grid">
          <div>
            <span>Mode</span>
            <strong>Incident Ready</strong>
          </div>
          <div>
            <span>Coverage</span>
            <strong>Marmara Ops</strong>
          </div>
          <div>
            <span>Data</span>
            <strong>GIS + Logistics</strong>
          </div>
        </div>
      </section>

      <section className="auth-card" aria-label="Authentication">
        <div className="auth-card-header">
          <span className="ops-eyebrow">Identity Verification</span>
          <h2>{tab === "login" ? "Sisteme Giris" : "Operasyon Hesabi Olustur"}</h2>
          <p>Yetkili kullanici erisimi. Kimlik dogrulamadan sonra operasyon ekranina gecilir.</p>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          {(["login", "register"] as Tab[]).map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => switchTab(item)}
              type="button"
              role="tab"
              aria-selected={tab === item}
            >
              {item === "login" ? "Giris" : "Yeni Kayit"}
            </button>
          ))}
        </div>

        {msg.type && <div className={`auth-message ${msg.type}`}>{msg.text}</div>}

        {tab === "login" && (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>E-posta</span>
              <input
                type="email"
                placeholder="ornek@mail.com"
                required
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Sifre</span>
              <input
                type="password"
                placeholder="********"
                required
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>
            <button
              className="auth-forgot"
              type="button"
              onClick={() => showMsg("info", "Sifre sifirlama icin yonetici ile iletisime gecin.")}
            >
              Sifremi Unuttum?
            </button>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Giris yapiliyor..." : "Sisteme Giris Yap"}
            </button>
          </form>
        )}

        {tab === "register" && (
          <form className="auth-form" onSubmit={handleRegister}>
            <label>
              <span>Tam Adiniz</span>
              <input
                type="text"
                placeholder="Ad Soyad"
                value={regName}
                onChange={(event) => setRegName(event.target.value)}
              />
            </label>
            <label>
              <span>E-posta</span>
              <input
                type="email"
                placeholder="ornek@mail.com"
                required
                value={regEmail}
                onChange={(event) => setRegEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Sifre Secin</span>
              <input
                type="password"
                placeholder="********"
                required
                value={regPassword}
                onChange={(event) => setRegPassword(event.target.value)}
              />
            </label>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Hesap olusturuluyor..." : "Hesabi Olustur"}
            </button>
          </form>
        )}

        <div className="auth-footer">2026 GEOSAFE GLOBAL / Controlled Access</div>
      </section>
    </main>
  );
}
