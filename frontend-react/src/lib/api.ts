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
  // Dev logging (no exponer token completo)
  try {
    if (import.meta?.env?.DEV) {
      const sanitizedHeaders: Record<string, string> = { ...headers };
      if (sanitizedHeaders.Authorization) sanitizedHeaders.Authorization = 'Bearer ***';
      let loggedBody: any = undefined;
      try {
        loggedBody = init.body ? JSON.parse(init.body as any) : undefined;
      } catch {
        loggedBody = (init.body as any) ?? undefined;
      }
      console.debug('[apiFetch] Request', {
        method: init.method || 'GET',
        url: `${API_BASE}${path}`,
        headers: sanitizedHeaders,
        body: loggedBody,
      });
    }
  } catch {}
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
  try {
    if (import.meta?.env?.DEV) {
      console.debug('[apiFetch] Response', { url: `${API_BASE}${path}`, status: res.status });
    }
  } catch {}
  if (!res.ok) {
    try {
      if (import.meta?.env?.DEV) {
        const bodyText = await res.clone().text().catch(() => null);
        console.debug('[apiFetch] Error response body', { status: res.status, body: bodyText });
      }
    } catch {}
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
  
  // AI
  aiForecast: (opts: { days?: number; history?: number; limit?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.days != null) p.set('days', String(opts.days));
    if (opts.history != null) p.set('history', String(opts.history));
    if (opts.limit != null) p.set('limit', String(opts.limit));
    const qs = p.toString();
    return apiFetch(`/api/ai/forecast${qs ? `?${qs}` : ''}`);
  },
  aiStockouts: (opts: { days?: number; history?: number; limit?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.days != null) p.set('days', String(opts.days));
    if (opts.history != null) p.set('history', String(opts.history));
    if (opts.limit != null) p.set('limit', String(opts.limit));
    const qs = p.toString();
    return apiFetch(`/api/ai/stockouts${qs ? `?${qs}` : ''}`);
  },
  aiAnomalias: (opts: { scope?: 'sales' | 'expenses' | 'both'; period?: number; sigma?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.scope) p.set('scope', opts.scope);
    if (opts.period != null) p.set('period', String(opts.period));
    if (opts.sigma != null) p.set('sigma', String(opts.sigma));
    const qs = p.toString();
    return apiFetch(`/api/ai/anomalias${qs ? `?${qs}` : ''}`);
  },
  aiPrecios: (opts: { margin?: number; history?: number; limit?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.margin != null) p.set('margin', String(opts.margin));
    if (opts.history != null) p.set('history', String(opts.history));
    if (opts.limit != null) p.set('limit', String(opts.limit));
    const qs = p.toString();
    return apiFetch(`/api/ai/precios${qs ? `?${qs}` : ''}`);
  },
  
  // CRM
  oportunidades: (f: { q?: string; fase?: string; cliente_id?: number; owner_id?: number; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return apiFetch(`/api/crm/oportunidades${qs.size ? `?${qs}` : ''}`);
  },
  crearOportunidad: (body: any) => apiFetch('/api/crm/oportunidades', { method: 'POST', body: JSON.stringify(body) }),
  actualizarOportunidad: (id: number, body: any) => apiFetch(`/api/crm/oportunidades/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  actividades: (f: { cliente_id?: number; oportunidad_id?: number; estado?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return apiFetch(`/api/crm/actividades${qs.size ? `?${qs}` : ''}`);
  },
  crearActividad: (body: any) => apiFetch('/api/crm/actividades', { method: 'POST', body: JSON.stringify(body) }),
  actualizarActividad: (id: number, body: any) => apiFetch(`/api/crm/actividades/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Tickets
  tickets: (f: { q?: string; estado?: string; prioridad?: string; cliente_id?: number; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return apiFetch(`/api/tickets${qs.size ? `?${qs}` : ''}`);
  },
  crearTicket: (body: any) => apiFetch('/api/tickets', { method: 'POST', body: JSON.stringify(body) }),
  actualizarTicket: (id: number, body: any) => apiFetch(`/api/tickets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  ticketEventos: (id: number) => apiFetch(`/api/tickets/${id}/eventos`),
  crearTicketEvento: (id: number, body: any) => apiFetch(`/api/tickets/${id}/eventos`, { method: 'POST', body: JSON.stringify(body) }),

  // Aprobaciones
  aprobaciones: (f: { estado?: 'pendiente' | 'aprobado' | 'rechazado'; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return apiFetch(`/api/aprobaciones${qs.size ? `?${qs}` : ''}`);
  },
  aprobar: (id: number, notas?: string) => apiFetch(`/api/aprobaciones/${id}/aprobar`, { method: 'POST', body: JSON.stringify({ notas }) }),
  rechazar: (id: number, notas?: string) => apiFetch(`/api/aprobaciones/${id}/rechazar`, { method: 'POST', body: JSON.stringify({ notas }) }),
};
