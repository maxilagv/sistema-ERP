import type { LoginResponse, LoginError } from '../types/auth';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './storage';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    let msg = 'Error desconocido';
    try {
      const data: LoginError = await res.json();
      if (data.error) msg = data.error;
      else if (Array.isArray(data.errors) && data.errors.length) msg = data.errors[0].msg;
    } catch (_) {}
    throw new Error(msg);
  }

  return res.json();
}

async function refreshAccessToken(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;
  const res = await fetch(`${API_BASE}/api/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.accessToken) {
    // keep same refresh in storage (session/local depending on where it's stored)
    saveTokens(data.accessToken, rt, Boolean(localStorage.getItem('auth.refreshToken')));
    return data.accessToken as string;
  }
  return null;
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as any) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    const newAt = await refreshAccessToken();
    if (newAt) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${newAt}` };
      res = await fetch(`${API_BASE}${path}`, { ...init, headers: retryHeaders });
    } else {
      clearTokens();
    }
  }
  if (!res.ok) {
    let err = 'Error de red';
    try { const data = await res.json(); err = data?.error || JSON.stringify(data); } catch {}
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as any);
}

// Domain helpers
export const Api = {
  // Catalogo
  productos: () => apiFetch('/api/productos'),
  crearProducto: (body: any) => apiFetch('/api/productos', { method: 'POST', body: JSON.stringify(body) }),
  categorias: () => apiFetch('/api/categorias'),
  crearCategoria: (body: any) => apiFetch('/api/categorias', { method: 'POST', body: JSON.stringify(body) }),

  // Inventario
  inventario: (q?: string) => apiFetch(`/api/inventario${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  movimientos: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
    return apiFetch(`/api/inventario/movimientos${qs.size ? `?${qs}` : ''}`);
  },

  // Clientes y proveedores
  clientes: (q?: string) => apiFetch(`/api/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  crearCliente: (body: any) => apiFetch('/api/clientes', { method: 'POST', body: JSON.stringify(body) }),
  proveedores: (q?: string) => apiFetch(`/api/proveedores${q ? `?q=${encodeURIComponent(q)}` : ''}`),

  // Compras, Ventas, Pagos
  compras: () => apiFetch('/api/compras'),
  crearCompra: (body: any) => apiFetch('/api/compras', { method: 'POST', body: JSON.stringify(body) }),
  recibirCompra: (id: number, body: any = {}) => apiFetch(`/api/compras/${id}/recibir`, { method: 'POST', body: JSON.stringify(body) }),
  ventas: () => apiFetch('/api/ventas'),
  crearVenta: (body: any) => apiFetch('/api/ventas', { method: 'POST', body: JSON.stringify(body) }),
  pagos: (f?: { venta_id?: number; cliente_id?: number }) => apiFetch(`/api/pagos${f ? `?${new URLSearchParams(Object.entries(f as any))}` : ''}`),
  crearPago: (body: any) => apiFetch('/api/pagos', { method: 'POST', body: JSON.stringify(body) }),

  // Reportes
  deudas: () => apiFetch('/api/reportes/deudas'),
  gananciasMensuales: () => apiFetch('/api/reportes/ganancias-mensuales'),
  stockBajo: () => apiFetch('/api/reportes/stock-bajo'),
  topClientes: (limit = 10) => apiFetch(`/api/reportes/top-clientes?limit=${limit}`),
};
