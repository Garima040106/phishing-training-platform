import axios from "axios";

const ACCESS_KEY = "phishguard.access";
const REFRESH_KEY = "phishguard.refresh";

function normalizeApiBaseUrl(rawValue) {
  const normalized = (rawValue || "/api").replace(/\/$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return /\/api$/i.test(normalized) ? normalized : `${normalized}/api`;
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

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
  baseURL: API_BASE_URL,
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

// If VITE_API_BASE_URL is missing/misconfigured on a static host (e.g. a Vercel
// deploy without the env var set), relative "/api" requests get swallowed by
// the SPA's catch-all rewrite and come back as a 200 HTML page instead of a
// 404. Without this check that looks like a successful login/register with
// garbage data instead of a clear error.
api.interceptors.response.use((response) => {
  const isBlobRequest = response.config?.responseType === "blob";
  const contentType = response.headers?.["content-type"] || "";
  if (!isBlobRequest && !contentType.includes("application/json")) {
    return Promise.reject({
      response: {
        status: response.status,
        data: {
          error:
            "The app couldn't reach the API server. VITE_API_BASE_URL is likely missing or incorrect for this deployment.",
        },
      },
    });
  }
  return response;
});

export async function initCsrf() {
  // Optional: kept for backward compatibility (JWT auth does not require CSRF).
  await api.get("/csrf/");
}

export function extractApiErrorMessage(err) {
  const data = err?.response?.data;
  if (typeof data?.error === "string" && data.error.trim()) {
    return data.error;
  }
  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      if (typeof value === "string" && value.trim()) return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }
  return null;
}

export default api;
