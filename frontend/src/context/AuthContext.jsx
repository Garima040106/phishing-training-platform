import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { initCsrf } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const { data } = await api.get("/me/");
      setUser(data);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        await initCsrf();
        await refreshUser();
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, []);

  const login = async (payload) => {
    await initCsrf();
    await api.post("/login/", payload, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    await refreshUser();
  };

  const register = async (payload) => {
    await initCsrf();
    await api.post("/register/", payload, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    await refreshUser();
  };

  const logout = async () => {
    await initCsrf();
    await api.post("/logout/");
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
