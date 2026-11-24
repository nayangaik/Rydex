import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getInMemoryAccessToken, setInMemoryAccessToken } from "@/lib/accessTokenStore";

const DEVICE_ID_KEY = "rydex.deviceId";

export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;

  let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = window.crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_GATEWAY,
  withCredentials: true,
});

type RetriableRequest = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean };
let refreshRequest: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshRequest) {
    refreshRequest = api.post<{ accessToken?: string }>("/api/auth/refresh", {})
      .then(({ data }) => {
        if (!data.accessToken) throw new Error("Refresh response did not include an access token.");
        setInMemoryAccessToken(data.accessToken);
        return data.accessToken;
      })
      .catch(() => {
        setInMemoryAccessToken(null);
        return null;
      })
      .finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

api.interceptors.request.use(async (config) => {
  const deviceId = getDeviceId();
  if (deviceId) config.headers.set("x-device-id", deviceId);
  let accessToken = getInMemoryAccessToken();
  const isAuthRequest = (config.url || "").includes("/api/auth/");
  if (!accessToken && !isAuthRequest) accessToken = await refreshAccessToken();
  if (accessToken) config.headers.set("Authorization", `Bearer ${accessToken}`);
  return config;
});

api.interceptors.response.use((response) => response, async (error: AxiosError) => {
  const original = error.config as RetriableRequest | undefined;
  const status = error.response?.status;
  const requestUrl = original?.url || "";
  const isAuthFlowRequest = /\/api\/auth\/(register|signin|verify-otp|resend-otp|refresh|login)(?:\?|$)/.test(requestUrl);

  if (status !== 401 || !original || original._retriedAfterRefresh || isAuthFlowRequest || !original.headers.get("Authorization")) {
    return Promise.reject(error);
  }

  original._retriedAfterRefresh = true;
  const nextAccessToken = await refreshAccessToken();
  if (!nextAccessToken) return Promise.reject(error);
  original.headers.set("Authorization", `Bearer ${nextAccessToken}`);
  return api(original);
});

export default api;
