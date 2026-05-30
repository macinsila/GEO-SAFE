import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface AuthCtx {
  token: string | null;
  isAuthenticated: boolean;
  role: string | null;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

const TOKEN_KEY = "geosafe_token";
const AUTH_EXPIRED_EVENT = "geosafe-auth-expired";

const decodeBase64Url = (value: string): string => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
};

export const extractRole = (token: string | null): string | null => {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [role, setRole] = useState<string | null>(() => extractRole(localStorage.getItem(TOKEN_KEY)));
  const navigate = useNavigate();

  const login = useCallback((t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setRole(extractRole(t));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setRole(null);
    navigate("/login");
  }, [navigate]);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        setToken(e.newValue);
        setRole(extractRole(e.newValue));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      setToken(null);
      setRole(null);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, []);

  return (
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
