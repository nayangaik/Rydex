"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { refreshAccessToken } from "@/lib/api";
import { getInMemoryAccessToken, setInMemoryAccessToken, subscribeToAccessToken } from "@/lib/accessTokenStore";

import type { AuthContextValue } from "@/types/auth.types";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const updateAccessToken = useCallback((token: string | null) => setInMemoryAccessToken(token), []);
  const clearAccessToken = useCallback(() => updateAccessToken(null), [updateAccessToken]);

  useEffect(() => {
    setAccessToken(getInMemoryAccessToken());
    return subscribeToAccessToken(setAccessToken);
  }, []);

  // On reload, recover the in-memory access token using the HttpOnly refresh
  // cookie. The family ID remains server-side and is resolved from its hash.
  useEffect(() => {
    let active = true;
    void refreshAccessToken().then((token) => { if (active && token) updateAccessToken(token); });
    return () => { active = false; };
  }, [updateAccessToken]);

  const value = useMemo(() => ({ accessToken, setAccessToken: updateAccessToken, clearAccessToken }), [accessToken, updateAccessToken, clearAccessToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
