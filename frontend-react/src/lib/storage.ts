const ACCESS_KEY = 'auth.accessToken';
const REFRESH_KEY = 'auth.refreshToken';
const CLIENT_ACCESS_KEY = 'client.auth.accessToken';
const CLIENT_REFRESH_KEY = 'client.auth.refreshToken';

export function saveTokens(accessToken: string, refreshToken: string, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(ACCESS_KEY, accessToken);
  storage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return (
    localStorage.getItem(ACCESS_KEY) ||
    sessionStorage.getItem(ACCESS_KEY)
  );
}

export function getRefreshToken(): string | null {
  return (
    localStorage.getItem(REFRESH_KEY) ||
    sessionStorage.getItem(REFRESH_KEY)
  );
}

export function saveClientTokens(accessToken: string, refreshToken: string, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(CLIENT_ACCESS_KEY, accessToken);
  storage.setItem(CLIENT_REFRESH_KEY, refreshToken);
}

export function clearClientTokens() {
  localStorage.removeItem(CLIENT_ACCESS_KEY);
  localStorage.removeItem(CLIENT_REFRESH_KEY);
  sessionStorage.removeItem(CLIENT_ACCESS_KEY);
  sessionStorage.removeItem(CLIENT_REFRESH_KEY);
}

export function getClientAccessToken(): string | null {
  return (
    localStorage.getItem(CLIENT_ACCESS_KEY) ||
    sessionStorage.getItem(CLIENT_ACCESS_KEY)
  );
}

export function getClientRefreshToken(): string | null {
  return (
    localStorage.getItem(CLIENT_REFRESH_KEY) ||
    sessionStorage.getItem(CLIENT_REFRESH_KEY)
  );
}
