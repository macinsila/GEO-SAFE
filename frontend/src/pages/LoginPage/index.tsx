import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { geoSafeAPI } from "../../services";

type Tab = "login" | "register";
type MsgType = "success" | "error" | "info" | null;

interface Msg { type: MsgType; text: string }

const S: Record<string, React.CSSProperties> = {
  body: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #e8efee 0%, #cfe6e2 100%)",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    background: "rgba(255,255,255,0.88)",
    backdropFilter: "blur(14px)",
    borderRadius: 24,
    padding: "36px 36px 28px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.10)",
    border: "1px solid rgba(255,255,255,0.5)",
  },
  logo: { textAlign: "center", fontSize: 28, fontWeight: 800, color: "#245a56", letterSpacing: -1, marginBottom: 4 },
  sub:  { textAlign: "center", fontSize: 13, color: "#618783", marginBottom: 28 },
  tabs: { display: "flex", background: "rgba(0,0,0,0.04)", borderRadius: 12, marginBottom: 22, padding: 4, gap: 4 },
  tab:  { flex: 1, textAlign: "center", padding: "9px 0", borderRadius: 9, cursor: "pointer", fontSize: 14, color: "#5f7f7c", border: "none", background: "transparent", fontWeight: 500 },
  tabActive: { background: "#fff", color: "#2f6f6b", fontWeight: 700, boxShadow: "0 3px 10px rgba(0,0,0,0.07)" },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#4a6f6c", marginBottom: 6, marginLeft: 2 },
  input: { width: "100%", padding: "13px 14px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.10)", marginBottom: 16, fontSize: 14, background: "rgba(255,255,255,0.55)", outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" },
  btn: { width: "100%", padding: "14px 0", background: "#2f6f6b", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 20px rgba(47,111,107,0.35)", fontFamily: "inherit" },
  btnDisabled: { opacity: 0.65, cursor: "not-allowed" },
  msgSuccess: { padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: "center", background: "#d1fae5", color: "#065f46", border: "1px solid #6ee7b7", marginBottom: 14 },
  msgError:   { padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: "center", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", marginBottom: 14 },
  msgInfo:    { padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, textAlign: "center", background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", marginBottom: 14 },
  forgot: { display: "block", textAlign: "right", fontSize: 12, color: "#2f6f6b", fontWeight: 700, cursor: "pointer", marginTop: -10, marginBottom: 16 },
  divider: { textAlign: "center", marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)", fontSize: 11, color: "#9eb5b2", textTransform: "uppercase" as const, letterSpacing: 1 },
};

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

  const switchTab = (t: Tab) => { setTab(t); clearMsg(); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMsg();
    try {
      const token = await geoSafeAPI.login(loginEmail, loginPassword);
      login(token);
      navigate("/");
    } catch {
      showMsg("error", "❌ E-posta veya şifre hatalı.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearMsg();
    try {
      await geoSafeAPI.register(regName || "Kullanıcı", regEmail, regPassword);
      // Auto-login after register
      const token = await geoSafeAPI.login(regEmail, regPassword);
      login(token);
      navigate("/");
    } catch {
      showMsg("error", "❌ Kayıt başarısız. E-posta zaten kullanılıyor olabilir.");
    } finally {
      setLoading(false);
    }
  };

  const msgStyle =
    msg.type === "success" ? S.msgSuccess :
    msg.type === "error"   ? S.msgError   :
    msg.type === "info"    ? S.msgInfo    : {};

  return (
    <div style={S.body}>
      <div style={S.card}>
        <div style={S.logo}>GeoSafe</div>
        <div style={S.sub}>Güvenliğiniz bizim önceliğimiz.</div>

        <div style={S.tabs}>
          {(["login", "register"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}
            >
              {t === "login" ? "Giriş" : "Yeni Kayıt"}
            </button>
          ))}
        </div>

        {msg.type && <div style={msgStyle}>{msg.text}</div>}

        {tab === "login" && (
          <form onSubmit={handleLogin}>
            <label style={S.label}>E-posta</label>
            <input style={S.input} type="email" placeholder="ornek@mail.com" required
              value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
            <label style={S.label}>Şifre</label>
            <input style={S.input} type="password" placeholder="••••••••" required
              value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
            <span
              style={S.forgot}
              onClick={() => showMsg("info", "Şifre sıfırlama için yönetici ile iletişime geçin.")}
            >
              Şifremi Unuttum?
            </span>
            <button
              type="submit"
              style={{ ...S.btn, ...(loading ? S.btnDisabled : {}) }}
              disabled={loading}
            >
              {loading ? "Giriş yapılıyor…" : "Sisteme Giriş Yap"}
            </button>
          </form>
        )}

        {tab === "register" && (
          <form onSubmit={handleRegister}>
            <label style={S.label}>Tam Adınız</label>
            <input style={S.input} type="text" placeholder="Ad Soyad"
              value={regName} onChange={e => setRegName(e.target.value)} />
            <label style={S.label}>E-posta</label>
            <input style={S.input} type="email" placeholder="ornek@mail.com" required
              value={regEmail} onChange={e => setRegEmail(e.target.value)} />
            <label style={S.label}>Şifre Seçin</label>
            <input style={S.input} type="password" placeholder="••••••••" required
              value={regPassword} onChange={e => setRegPassword(e.target.value)} />
            <button
              type="submit"
              style={{ ...S.btn, ...(loading ? S.btnDisabled : {}) }}
              disabled={loading}
            >
              {loading ? "Hesap oluşturuluyor…" : "Hesabı Oluştur"}
            </button>
          </form>
        )}

        <div style={S.divider}>© 2026 GEOSAFE GLOBAL</div>
      </div>
    </div>
  );
}
