import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearClientTokens,
  getClientAccessToken,
  getClientRefreshToken,
  saveClientTokens,
} from '../lib/storage';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

type ClientAuthContextType = {
  isAuthenticated: boolean;
  accessToken: string | null;
  ready: boolean;
  setTokens: (accessToken: string, refreshToken: string, remember?: boolean) => void;
  clearTokens: () => void;
  logout: () => void;
};

const ClientAuthContext = createContext<ClientAuthContextType | undefined>(undefined);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccessToken(getClientAccessToken());
    setReady(true);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(accessToken),
      accessToken,
      ready,
      setTokens: (at: string, rt: string, remember = true) => {
        saveClientTokens(at, rt, remember);
        setAccessToken(at);
      },
      clearTokens: () => {
        clearClientTokens();
        setAccessToken(null);
      },
      logout: () => {
        const rt = getClientRefreshToken();
        const at = getClientAccessToken();
        fetch(`${API_BASE}/api/clientes/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(at ? { Authorization: `Bearer ${at}` } : {}),
          },
          body: JSON.stringify(rt ? { refreshToken: rt } : {}),
        }).catch(() => {});
        clearClientTokens();
        setAccessToken(null);
        window.location.href = '/catalogo';
      },
    }),
    [accessToken, ready]
  );

  return <ClientAuthContext.Provider value={value}>{children}</ClientAuthContext.Provider>;
}

export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth must be used within ClientAuthProvider');
  return ctx;
}
