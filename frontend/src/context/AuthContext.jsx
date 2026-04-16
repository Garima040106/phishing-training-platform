/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useState } from "react";
import api, { clearAuthTokens, getAccessToken, setAuthTokens } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const { data } = await api.get("/me/");
      setUser(data);
      return data;
    } catch (err) {
      if (err?.response?.status === 401) {
        clearAuthTokens();
      }
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        if (getAccessToken()) {
          await refreshUser();
        }
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, []);

  const login = async (payload) => {
    const { data } = await api.post("/login/", payload, {
      headers:
        payload instanceof URLSearchParams
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : undefined,
    });
    if (data?.tokens) setAuthTokens(data.tokens);
    await refreshUser();
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post("/register/", payload, {
      headers:
        payload instanceof URLSearchParams
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : undefined,
    });
    if (data?.tokens) setAuthTokens(data.tokens);
    await refreshUser();
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/logout/");
    } catch {
      // ignore
    } finally {
      clearAuthTokens();
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
