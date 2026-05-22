import axios from "axios";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { API_DIAGNOSTICS, geoSafeAPI } from "../../services";

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
      return "Backend 60 saniye içinde yanıt vermedi. Render servisi uyanıyor olabilir; biraz sonra tekrar deneyin veya Render loglarını kontrol edin.";
    }

    if (!error.response && error.message === "Network Error") {
      return "Backend'e ulaşılamadı. Render URL'i veya CORS_ORIGINS ayarı hatalı olabilir.";
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
        "Giriş isteği 60 saniye içinde yanıt alamadı. Render servisi, Supabase bağlantısı veya backend logları kontrol edilmeli."
      );
      login(token);
      navigate("/");
    } catch (error) {
      showMsg("error", getErrorMessage(error, "E-posta veya şifre hatalı."));
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
        geoSafeAPI.register(regName || "Kullanıcı", regEmail, regPassword),
        "Kayıt isteği 60 saniye içinde yanıt alamadı. Render servisi, Supabase bağlantısı veya backend logları kontrol edilmeli."
      );
      const token = await withTimeout(
        geoSafeAPI.login(regEmail, regPassword),
        "Giriş isteği 60 saniye içinde yanıt alamadı. Render servisi, Supabase bağlantısı veya backend logları kontrol edilmeli."
      );
      login(token);
      navigate("/");
    } catch (error) {
      showMsg("error", getErrorMessage(error, "Kayıt başarısız. E-posta zaten kullanılıyor olabilir."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-intel-panel" aria-label="GeoSafe platform bağlamı">
        <div className="ops-brand auth-brand">
          <div className="ops-mark">GS</div>
          <div>
            <strong>GeoSafe</strong>
            <span>Acil Durum Lojistiği</span>
          </div>
        </div>

        <div className="auth-intel-copy">
          <span className="ops-eyebrow">Güvenli Operasyon Erişimi</span>
          <h1>Saha afet operasyonları için coğrafi karar desteği.</h1>
          <p>
            Barınma alanları, depo hazırlığı, acil durum raporları ve lojistik sinyaller tek
            kontrollü operasyon alanında tutulur.
          </p>
        </div>

        <div className="auth-signal-grid">
          <div>
            <span>Mod</span>
            <strong>Olaya Hazır</strong>
          </div>
          <div>
            <span>Kapsam</span>
            <strong>Marmara Operasyonu</strong>
          </div>
          <div>
            <span>Veri</span>
            <strong>CBS + Lojistik</strong>
          </div>
        </div>
      </section>

      <section className="auth-card" aria-label="Kimlik doğrulama">
        <div className="auth-card-header">
          <span className="ops-eyebrow">Kimlik Doğrulama</span>
          <h2>{tab === "login" ? "Sisteme Giriş" : "Operasyon Hesabı Oluştur"}</h2>
          <p>Yetkili kullanıcı erişimi. Kimlik doğrulamadan sonra operasyon ekranına geçilir.</p>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Kimlik doğrulama modu">
          {(["login", "register"] as Tab[]).map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => switchTab(item)}
              type="button"
              role="tab"
              aria-selected={tab === item}
            >
              {item === "login" ? "Giriş" : "Yeni Kayıt"}
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
              <span>Şifre</span>
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
              onClick={() => showMsg("info", "Şifre sıfırlama için yönetici ile iletişime geçin.")}
            >
              Şifremi Unuttum?
            </button>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Giriş yapılıyor..." : "Sisteme Giriş Yap"}
            </button>
          </form>
        )}

        {tab === "register" && (
          <form className="auth-form" onSubmit={handleRegister}>
            <label>
              <span>Tam Adınız</span>
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
              <span>Şifre Seçin</span>
              <input
                type="password"
                placeholder="********"
                required
                value={regPassword}
                onChange={(event) => setRegPassword(event.target.value)}
              />
            </label>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Hesap oluşturuluyor..." : "Hesabı Oluştur"}
            </button>
          </form>
        )}

        <div className="auth-footer">
          2026 GEOSAFE GLOBAL / Kontrollü Erişim
          <span>Build {API_DIAGNOSTICS.build} / API {API_DIAGNOSTICS.baseUrl}</span>
        </div>
      </section>
    </main>
  );
}
