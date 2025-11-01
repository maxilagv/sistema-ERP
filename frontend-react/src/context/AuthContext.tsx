import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../lib/storage';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';

type AuthContextType = {
  isAuthenticated: boolean;
  accessToken: string | null;
  ready: boolean;
  login: (accessToken: string, refreshToken: string, remember: boolean) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccessToken(getAccessToken());
    setReady(true);
  }, []);

  const value = useMemo(() => ({
    isAuthenticated: Boolean(accessToken),
    accessToken,
    ready,
    login: (at: string, rt: string, remember: boolean) => {
      saveTokens(at, rt, remember);
      setAccessToken(at);
    },
    logout: () => {
      const rt = getRefreshToken();
      const at = getAccessToken();
      // best effort logout on server
      fetch(`${API_BASE}/api/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(at ? { Authorization: `Bearer ${at}` } : {}) },
        body: JSON.stringify(rt ? { refreshToken: rt } : {}),
      }).catch(() => {});
      clearTokens();
      setAccessToken(null);
      window.location.href = '/login';
    },
  }), [accessToken, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
