import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { API_DIAGNOSTICS, geoSafeAPI } from "../../services";

type Tab = "login" | "register";
type MsgType = "success" | "error" | "info" | null;

interface Msg {
  type: MsgType;
  text: string;
}

interface LoginLocationState {
  from?: {
    pathname?: string;
    search?: string;
  };
}

const LOGIN_TIMEOUT_MS = 60000;
const AUTH_NOTICE_KEY = "geosafe_auth_notice";

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
      return "Backend 60 saniye içinde yanıt vermedi. Servis uyanıyor olabilir; biraz sonra tekrar deneyin.";
    }

    if (!error.response && error.message === "Network Error") {
      return "Backend'e ulaşılamadı. API adresi veya CORS ayarı kontrol edilmeli.";
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

function getReturnPath(state: unknown): string {
  const loginState = state as LoginLocationState | null;
  const pathname = loginState?.from?.pathname;
  if (!pathname || pathname === "/login") return "/ops";
  return `${pathname}${loginState?.from?.search ?? ""}`;
}

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnPath = useMemo(() => getReturnPath(location.state), [location.state]);
  const [tab, setTab] = useState<Tab>("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [msg, setMsg] = useState<Msg>({ type: null, text: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnPath, { replace: true });
    }
  }, [isAuthenticated, navigate, returnPath]);

  useEffect(() => {
    const notice = sessionStorage.getItem(AUTH_NOTICE_KEY);
    if (notice) {
      setMsg({ type: "info", text: notice });
      sessionStorage.removeItem(AUTH_NOTICE_KEY);
    }
  }, []);

  const showMsg = (type: MsgType, text: string) => setMsg({ type, text });
  const clearMsg = () => setMsg({ type: null, text: "" });
  const switchTab = (nextTab: Tab) => {
    if (loading) return;
    setTab(nextTab);
    clearMsg();
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    clearMsg();
    try {
      const token = await withTimeout(
        geoSafeAPI.login(loginEmail.trim(), loginPassword),
        "Giriş isteği 60 saniye içinde yanıt alamadı. Backend bağlantısı veya servis logları kontrol edilmeli."
      );
      login(token);
      navigate(returnPath, { replace: true });
    } catch (error) {
      showMsg("error", getErrorMessage(error, "E-posta veya şifre hatalı."));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = regName.trim();
    const cleanEmail = regEmail.trim();

    if (regPassword.length < 8) {
      showMsg("error", "Şifre en az 8 karakter olmalı.");
      return;
    }

    setLoading(true);
    clearMsg();
    try {
      await withTimeout(
        geoSafeAPI.register(cleanName || "Kullanıcı", cleanEmail, regPassword),
        "Kayıt isteği 60 saniye içinde yanıt alamadı. Backend bağlantısı veya servis logları kontrol edilmeli."
      );
      const token = await withTimeout(
        geoSafeAPI.login(cleanEmail, regPassword),
        "Giriş isteği 60 saniye içinde yanıt alamadı. Backend bağlantısı veya servis logları kontrol edilmeli."
      );
      login(token);
      navigate("/profile", { replace: true });
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
          <p>
            Yetkili kullanıcı erişimi. Korunan bir ekrandan geldiyseniz girişten sonra aynı
            noktaya dönersiniz.
          </p>
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
              disabled={loading}
            >
              {item === "login" ? "Giriş" : "Yeni Kayıt"}
            </button>
          ))}
        </div>

        {msg.type && (
          <div className={`auth-message ${msg.type}`} role="status" aria-live="polite">
            {msg.text}
          </div>
        )}

        {tab === "login" && (
          <form className="auth-form" onSubmit={handleLogin} aria-busy={loading}>
            <label>
              <span>E-posta</span>
              <input
                type="email"
                placeholder="ornek@mail.com"
                autoComplete="email"
                required
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Şifre</span>
              <div className="auth-password-field">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="********"
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((value) => !value)}
                  aria-pressed={showLoginPassword}
                >
                  {showLoginPassword ? "Gizle" : "Göster"}
                </button>
              </div>
            </label>
            <button
              className="auth-forgot"
              type="button"
              onClick={() => showMsg("info", "Şifre sıfırlama için sistem yöneticisiyle iletişime geçin.")}
            >
              Şifremi unuttum
            </button>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Giriş yapılıyor..." : "Sisteme giriş yap"}
            </button>
          </form>
        )}

        {tab === "register" && (
          <form className="auth-form" onSubmit={handleRegister} aria-busy={loading}>
            <label>
              <span>Tam adınız</span>
              <input
                type="text"
                placeholder="Ad Soyad"
                autoComplete="name"
                value={regName}
                onChange={(event) => setRegName(event.target.value)}
              />
            </label>
            <label>
              <span>E-posta</span>
              <input
                type="email"
                placeholder="ornek@mail.com"
                autoComplete="email"
                required
                value={regEmail}
                onChange={(event) => setRegEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Şifre seçin</span>
              <div className="auth-password-field">
                <input
                  type={showRegisterPassword ? "text" : "password"}
                  placeholder="En az 8 karakter"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(event) => setRegPassword(event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowRegisterPassword((value) => !value)}
                  aria-pressed={showRegisterPassword}
                >
                  {showRegisterPassword ? "Gizle" : "Göster"}
                </button>
              </div>
              <small className="auth-field-hint">Profil ve QR kimliği daha sonra profil ekranında tamamlanır.</small>
            </label>
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? "Hesap oluşturuluyor..." : "Hesabı oluştur"}
            </button>
          </form>
        )}

        <div className="auth-public-links" aria-label="Public afet akışları">
          <Link to="/emergency">Acil yardım bildir</Link>
          <Link to="/volunteer">Gönüllü ol</Link>
          <Link to="/shelter-offer">Barınma desteği sun</Link>
        </div>

        <div className="auth-footer">
          2026 GEOSAFE GLOBAL / Kontrollü Erişim
          <span>Build {API_DIAGNOSTICS.build} / API {API_DIAGNOSTICS.baseUrl}</span>
        </div>
      </section>
    </main>
  );
}
