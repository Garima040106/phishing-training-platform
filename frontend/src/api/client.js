import axios from "axios";

const ACCESS_KEY = "phishguard.access";
const REFRESH_KEY = "phishguard.refresh";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function setAuthTokens(tokens) {
  if (!tokens) return;
  if (tokens.access) localStorage.setItem(ACCESS_KEY, tokens.access);
  if (tokens.refresh) localStorage.setItem(REFRESH_KEY, tokens.refresh);
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

const api = axios.create({
  baseURL: "/api",
  headers: {
    "X-Requested-With": "XMLHttpRequest",
  },
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function initCsrf() {
  // Optional: kept for backward compatibility (JWT auth does not require CSRF).
  await api.get("/csrf/");
}

export default api;
