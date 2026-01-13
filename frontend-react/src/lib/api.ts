import type { LoginResponse, LoginError } from '../types/auth';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './storage';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';


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
    let errMsg = 'Error de red';
    try {
      const data = await res.json();
      // Propagar error enriquecido si es un requerimiento de aprobación
      if (res.status === 403 && (data?.aprobacion_id || data?.regla)) {
        const err: any = new Error(data?.error || 'Pendiente de aprobación');
        err.code = 'APPROVAL_REQUIRED';
        if (data?.aprobacion_id) err.aprobacionId = data.aprobacion_id;
        if (data?.regla) err.regla = data.regla;
        throw err;
      }
      errMsg = data?.error || JSON.stringify(data);
    } catch (_) {}
    throw new Error(errMsg);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as any);
}

// Domain helpers
export const Api = {
  // Configuración / parámetros del sistema
  getDolarBlue: () => apiFetch('/api/config/dolar-blue'),
  setDolarBlue: (valor: number) =>
    apiFetch('/api/config/dolar-blue', {
      method: 'PUT',
      body: JSON.stringify({ valor }),
    }),

  // Depósitos
  depositos: (opts: { incluirInactivos?: boolean } = {}) => {
    const qs = opts.incluirInactivos ? '?inactivos=1' : '';
    return apiFetch(`/api/depositos${qs}`);
  },
  crearDeposito: (body: any) =>
    apiFetch('/api/depositos', { method: 'POST', body: JSON.stringify(body) }),
  actualizarDeposito: (id: number, body: any) =>
    apiFetch(`/api/depositos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  eliminarDeposito: (id: number) =>
    apiFetch(`/api/depositos/${id}`, { method: 'DELETE' }),

  // Catalogo
  catalogoConfig: () => apiFetch('/api/catalogo/config'),
  guardarCatalogoConfig: (body: {
    nombre?: string;
    logo_url?: string;
    destacado_producto_id?: number | null;
    publicado?: boolean;
  }) =>
    apiFetch('/api/catalogo/config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  catalogoPublico: () => apiFetch('/api/catalogo'),
  productos: (params?: {
    q?: string;
    category_id?: number;
    limit?: number;
    offset?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
    page?: number;
    paginated?: boolean;
  }) => {
    const p = new URLSearchParams();
    if (params?.q) p.set('q', params.q);
    if (params?.category_id != null) p.set('category_id', String(params.category_id));
    if (params?.limit != null) p.set('limit', String(params.limit));
    if (params?.offset != null) p.set('offset', String(params.offset));
    if (params?.sort) p.set('sort', params.sort);
    if (params?.dir) p.set('dir', params.dir);
    if (params?.page != null) p.set('page', String(params.page));
    const qs = p.toString();
    const promise = apiFetch(`/api/productos${qs ? `?${qs}` : ''}`);
    if (params?.paginated) {
      return promise;
    }
    return promise.then((res: any) => {
      if (Array.isArray(res)) return res;
      if (res && Array.isArray(res.data)) return res.data;
      return res;
    });
  },
  crearProducto: (body: any) => apiFetch('/api/productos', { method: 'POST', body: JSON.stringify(body) }),
  actualizarProducto: (id: number, body: any) => apiFetch(`/api/productos/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  eliminarProducto: (id: number) => apiFetch(`/api/productos/${id}`, { method: 'DELETE' }),
  productoHistorial: (id: number, params: { limit?: number; offset?: number } = {}) => {
    const p = new URLSearchParams();
    if (params.limit != null) p.set('limit', String(params.limit));
    if (params.offset != null) p.set('offset', String(params.offset));
    const qs = p.toString();
    return apiFetch(`/api/productos/${id}/historial${qs ? `?${qs}` : ''}`);
  },
  categorias: () => apiFetch('/api/categorias'),
  crearCategoria: (body: any) => apiFetch('/api/categorias', { method: 'POST', body: JSON.stringify(body) }),
  actualizarCategoria: (id: number, body: any) => apiFetch(`/api/categorias/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  eliminarCategoria: (id: number) => apiFetch(`/api/categorias/${id}`, { method: 'DELETE' }),

  // Inventario
  inventario: (q?: string) => apiFetch(`/api/inventario${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  movimientos: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)])
    );
    return apiFetch(`/api/inventario/movimientos${qs.size ? `?${qs}` : ''}`);
  },
  inventarioDeposito: (depositoId: number, q?: string) => {
    const p = new URLSearchParams();
    p.set('deposito_id', String(depositoId));
    if (q) p.set('q', q);
    const qs = p.toString();
    return apiFetch(`/api/inventario${qs ? `?${qs}` : ''}`);
  },
  ajustarInventario: (body: { producto_id: number; cantidad: number; motivo?: string; referencia?: string; deposito_id?: number }) =>
    apiFetch('/api/inventario/ajustes', { method: 'POST', body: JSON.stringify(body) }),
  transferirStock: (body: { producto_id: number; cantidad: number; deposito_origen_id: number; deposito_destino_id: number; motivo?: string; referencia?: string }) =>
    apiFetch('/api/inventario/transferencias', { method: 'POST', body: JSON.stringify(body) }),

  // Clientes y proveedores
  clientes: (arg?: string | { q?: string; estado?: 'activo' | 'inactivo' | 'todos'; limit?: number; offset?: number }) => {
    const p = new URLSearchParams();
    if (typeof arg === 'string') {
      if (arg) p.set('q', arg);
    } else if (arg && typeof arg === 'object') {
      if (arg.q) p.set('q', arg.q);
      if (arg.estado && arg.estado !== 'todos') p.set('estado', arg.estado);
      if (arg.limit != null) p.set('limit', String(arg.limit));
      if (arg.offset != null) p.set('offset', String(arg.offset));
    }
    const qs = p.toString();
    return apiFetch(`/api/clientes${qs ? `?${qs}` : ''}`);
  },
  crearCliente: (body: any) => apiFetch('/api/clientes', { method: 'POST', body: JSON.stringify(body) }),
  actualizarCliente: (id: number, body: any) => apiFetch(`/api/clientes/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  eliminarCliente: (id: number) => apiFetch(`/api/clientes/${id}`, { method: 'DELETE' }),
  clienteAcceso: (clienteId: number) => apiFetch(`/api/clientes/${clienteId}/credenciales`),
  clienteSetPassword: (clienteId: number, body: { password?: string }) =>
    apiFetch(`/api/clientes/${clienteId}/credenciales`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  clienteHistorialPagos: (
    clienteId: number,
    opts: { limit?: number; offset?: number } = {}
  ) => {
    const p = new URLSearchParams();
    if (opts.limit != null) p.set('limit', String(opts.limit));
    if (opts.offset != null) p.set('offset', String(opts.offset));
    const qs = p.toString();
    return apiFetch(`/api/clientes/${clienteId}/historial-pagos${qs ? `?${qs}` : ''}`);
  },
  eliminarPagoClienteVenta: (clienteId: number, pagoId: number) =>
    apiFetch(`/api/clientes/${clienteId}/pagos/${pagoId}`, { method: 'DELETE' }),
  eliminarPagoClienteDeuda: (clienteId: number, pagoId: number) =>
    apiFetch(`/api/clientes/${clienteId}/deudas-iniciales/pagos/${pagoId}`, {
      method: 'DELETE',
    }),
  proveedores: (q?: string) => apiFetch(`/api/proveedores${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  crearProveedor: (body: any) => apiFetch('/api/proveedores', { method: 'POST', body: JSON.stringify(body) }),
  actualizarProveedor: (id: number, body: any) => apiFetch(`/api/proveedores/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Compras, Ventas, Pagos
  compras: () => apiFetch('/api/compras'),
  crearCompra: (body: any) => apiFetch('/api/compras', { method: 'POST', body: JSON.stringify(body) }),
  recibirCompra: (id: number, body: any = {}) => apiFetch(`/api/compras/${id}/recibir`, { method: 'POST', body: JSON.stringify(body) }),
  ventas: (f: { cliente_id?: number; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.entries(f)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    );
    return apiFetch(`/api/ventas${qs.size ? `?${qs}` : ''}`);
  },
  crearVenta: (body: any) => apiFetch('/api/ventas', { method: 'POST', body: JSON.stringify(body) }),
  ventaDetalle: (id: number) => apiFetch(`/api/ventas/${id}/detalle`),
  entregarVenta: (id: number) => apiFetch(`/api/ventas/${id}/entregar`, { method: 'POST' }),
  ocultarVenta: (id: number) => apiFetch(`/api/ventas/${id}/ocultar`, { method: 'POST' }),
  cancelarVenta: (id: number, body?: { motivo?: string }) =>
    apiFetch(`/api/ventas/${id}/cancelar`, {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),
  pagos: (f?: { venta_id?: number; cliente_id?: number }) => apiFetch(`/api/pagos${f ? `?${new URLSearchParams(Object.entries(f as any))}` : ''}`),
  crearPago: (body: any) => apiFetch('/api/pagos', { method: 'POST', body: JSON.stringify(body) }),

  // Deudas iniciales de clientes
  clienteDeudasIniciales: (clienteId: number) =>
    apiFetch(`/api/clientes/${clienteId}/deudas-iniciales`),
  crearDeudaInicialCliente: (
    clienteId: number,
    body: { monto: number; fecha?: string; descripcion?: string }
  ) => apiFetch(`/api/clientes/${clienteId}/deudas-iniciales`, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  clientePagosDeudaInicial: (clienteId: number) =>
    apiFetch(`/api/clientes/${clienteId}/deudas-iniciales/pagos`),
  crearPagoDeudaInicialCliente: (
    clienteId: number,
    body: { monto: number; fecha?: string; descripcion?: string }
  ) =>
    apiFetch(`/api/clientes/${clienteId}/deudas-iniciales/pagos`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Reportes
  deudas: () => apiFetch('/api/reportes/deudas'),
  gananciasMensuales: () => apiFetch('/api/reportes/ganancias-mensuales'),
  movimientosFinancieros: (params: { desde: string; hasta: string; agregado?: string }) => {
    const p = new URLSearchParams();
    if (params.desde) p.set('desde', params.desde);
    if (params.hasta) p.set('hasta', params.hasta);
    if (params.agregado) p.set('agregado', params.agregado);
    const qs = p.toString();
    return apiFetch(`/api/reportes/movimientos${qs ? `?${qs}` : ''}`);
  },
  stockBajo: () => apiFetch('/api/reportes/stock-bajo'),
  topClientes: (limit = 10) => apiFetch(`/api/reportes/top-clientes?limit=${limit}`),
  topProductosCliente: (clienteId: number, limit = 5) =>
    apiFetch(`/api/reportes/clientes/${clienteId}/top-productos?limit=${limit}`),
  descargarRemito: async (ventaId: number): Promise<Blob> => {
    const at = getAccessToken();
    const headers: Record<string, string> = {};
    if (at) headers['Authorization'] = `Bearer ${at}`;
    const res = await fetch(`${API_BASE}/api/reportes/remito/${ventaId}.pdf`, { method: 'GET', headers });
    if (!res.ok) {
      throw new Error('No se pudo descargar el remito');
    }
    return await res.blob();
  },
  descargarInformeGanancias: async (params: { desde: string; hasta: string; agregado?: string }): Promise<Blob> => {
    const at = getAccessToken();
    const headers: Record<string, string> = {};
    if (at) headers['Authorization'] = `Bearer ${at}`;
    const p = new URLSearchParams();
    if (params.desde) p.set('desde', params.desde);
    if (params.hasta) p.set('hasta', params.hasta);
    if (params.agregado) p.set('agregado', params.agregado);
    const qs = p.toString();
    const res = await fetch(`${API_BASE}/api/reportes/ganancias${qs ? `?${qs}` : ''}`, { method: 'GET', headers });
    if (!res.ok) {
      throw new Error('No se pudo descargar el informe de ganancias');
    }
    return await res.blob();
  },

  // Finanzas
  costosProductos: (params: { desde: string; hasta: string; groupBy?: 'dia' | 'producto' | 'proveedor' | 'categoria' }) => {
    const p = new URLSearchParams();
    if (params.desde) p.set('desde', params.desde);
    if (params.hasta) p.set('hasta', params.hasta);
    if (params.groupBy) p.set('groupBy', params.groupBy);
    const qs = p.toString();
    return apiFetch(`/api/finanzas/costos-productos${qs ? `?${qs}` : ''}`);
  },
  gananciaBruta: (params: { desde: string; hasta: string; agregado?: 'dia' | 'mes'; detalle?: 'producto' | 'cliente'; limit?: number }) => {
    const p = new URLSearchParams();
    if (params.desde) p.set('desde', params.desde);
    if (params.hasta) p.set('hasta', params.hasta);
    if (params.agregado) p.set('agregado', params.agregado);
    if (params.detalle) p.set('detalle', params.detalle);
    if (params.limit != null) p.set('limit', String(params.limit));
    const qs = p.toString();
    return apiFetch(`/api/finanzas/ganancia-bruta${qs ? `?${qs}` : ''}`);
  },
  gananciaNeta: (params: { desde: string; hasta: string }) => {
    const p = new URLSearchParams();
    if (params.desde) p.set('desde', params.desde);
    if (params.hasta) p.set('hasta', params.hasta);
    const qs = p.toString();
    return apiFetch(`/api/finanzas/ganancia-neta${qs ? `?${qs}` : ''}`);
  },
  gananciaPorProducto: (params: { desde: string; hasta: string; limit?: number; orderBy?: 'ganancia' | 'ingresos' | 'cantidad' | 'margen'; categoria_id?: number }) => {
    const p = new URLSearchParams();
    if (params.desde) p.set('desde', params.desde);
    if (params.hasta) p.set('hasta', params.hasta);
    if (params.limit != null) p.set('limit', String(params.limit));
    if (params.orderBy) p.set('orderBy', params.orderBy);
    if (params.categoria_id != null) p.set('categoria_id', String(params.categoria_id));
    const qs = p.toString();
    return apiFetch(`/api/finanzas/ganancia-por-producto${qs ? `?${qs}` : ''}`);
  },
  rentabilidadPorCategoria: (params: { desde: string; hasta: string; limit?: number }) => {
    const p = new URLSearchParams();
    if (params.desde) p.set('desde', params.desde);
    if (params.hasta) p.set('hasta', params.hasta);
    if (params.limit != null) p.set('limit', String(params.limit));
    const qs = p.toString();
    return apiFetch(`/api/finanzas/rentabilidad-por-categoria${qs ? `?${qs}` : ''}`);
  },
  rentabilidadPorCliente: (params: { desde: string; hasta: string; limit?: number }) => {
    const p = new URLSearchParams();
    if (params.desde) p.set('desde', params.desde);
    if (params.hasta) p.set('hasta', params.hasta);
    if (params.limit != null) p.set('limit', String(params.limit));
    const qs = p.toString();
    return apiFetch(`/api/finanzas/rentabilidad-por-cliente${qs ? `?${qs}` : ''}`);
  },
  deudasClientes: (opts: { clienteId?: number; detalle?: boolean } = {}) => {
    const p = new URLSearchParams();
    if (opts.clienteId != null) p.set('cliente_id', String(opts.clienteId));
    if (opts.detalle) p.set('detalle', '1');
    const qs = p.toString();
    return apiFetch(`/api/finanzas/deudas-clientes${qs ? `?${qs}` : ''}`);
  },
  deudasProveedores: (opts: { proveedorId?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.proveedorId != null) p.set('proveedor_id', String(opts.proveedorId));
    const qs = p.toString();
    return apiFetch(`/api/finanzas/deudas-proveedores${qs ? `?${qs}` : ''}`);
  },
  cashflow: (params: { desde: string; hasta: string; agrupado?: 'dia' | 'mes' }) => {
    const p = new URLSearchParams();
    if (params.desde) p.set('desde', params.desde);
    if (params.hasta) p.set('hasta', params.hasta);
    if (params.agrupado) p.set('agrupado', params.agrupado);
    const qs = p.toString();
    return apiFetch(`/api/finanzas/cashflow${qs ? `?${qs}` : ''}`);
  },
  presupuestos: (params: { anio?: number; mes?: number } = {}) => {
    const p = new URLSearchParams();
    if (params.anio != null) p.set('anio', String(params.anio));
    if (params.mes != null) p.set('mes', String(params.mes));
    const qs = p.toString();
    return apiFetch(`/api/finanzas/presupuestos${qs ? `?${qs}` : ''}`);
  },
  guardarPresupuesto: (body: { anio: number; mes: number; tipo: string; categoria: string; monto: number }) =>
    apiFetch('/api/finanzas/presupuestos', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  presupuestoVsReal: (params: { anio?: number; mes?: number } = {}) => {
    const p = new URLSearchParams();
    if (params.anio != null) p.set('anio', String(params.anio));
    if (params.mes != null) p.set('mes', String(params.mes));
    const qs = p.toString();
    return apiFetch(`/api/finanzas/presupuesto-vs-real${qs ? `?${qs}` : ''}`);
  },
  simuladorFinanciero: (body: {
    aumentoPrecios?: number;
    aumentoCostos?: number;
    aumentoGastos?: number;
    periodoDias?: number;
  }) =>
    apiFetch('/api/finanzas/simulador', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  
  // AI
  aiForecast: (opts: { days?: number; history?: number; limit?: number; category_id?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.days != null) p.set('days', String(opts.days));
    if (opts.history != null) p.set('history', String(opts.history));
    if (opts.limit != null) p.set('limit', String(opts.limit));
    if (opts.category_id != null) p.set('category_id', String(opts.category_id));
    const qs = p.toString();
    return apiFetch(`/api/ai/forecast${qs ? `?${qs}` : ''}`);
  },
  aiStockouts: (opts: { days?: number; history?: number; limit?: number; category_id?: number } = {}) => {
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
  aiForecastDetail: (productoId: number, opts: { days?: number; history?: number } = {}) => {
    const p = new URLSearchParams();
    if (opts.days != null) p.set('days', String(opts.days));
    if (opts.history != null) p.set('history', String(opts.history));
    const qs = p.toString();
    return apiFetch(`/api/ai/forecast/${productoId}/serie${qs ? `?${qs}` : ''}`);
  },
  aiExplainForecast: (productoId: number, opts: { days?: number; history?: number } = {}) => {
    const body: any = { producto_id: productoId };
    if (opts.days != null) body.forecast_days = opts.days;
    if (opts.history != null) body.history_days = opts.history;
    return apiFetch('/api/ai/explain-forecast', {
      method: 'POST',
      body: JSON.stringify(body),
    });
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
  crmAnalisis: () => apiFetch('/api/crm/analisis'),
  crmSuggestion: (oportunidadId: number) =>
    apiFetch('/api/ai/crm-suggestion', {
      method: 'POST',
      body: JSON.stringify({ oportunidad_id: oportunidadId }),
    }),

  // Tickets
  tickets: (f: { q?: string; estado?: string; prioridad?: string; cliente_id?: number; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return apiFetch(`/api/tickets${qs.size ? `?${qs}` : ''}`);
  },
  crearTicket: (body: any) => apiFetch('/api/tickets', { method: 'POST', body: JSON.stringify(body) }),
  actualizarTicket: (id: number, body: any) => apiFetch(`/api/tickets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  ticketEventos: (id: number) => apiFetch(`/api/tickets/${id}/eventos`),
  crearTicketEvento: (id: number, body: any) => apiFetch(`/api/tickets/${id}/eventos`, { method: 'POST', body: JSON.stringify(body) }),
  ticketReply: (id: number) =>
    apiFetch('/api/ai/ticket-reply', {
      method: 'POST',
      body: JSON.stringify({ ticket_id: id }),
    }),

  // Aprobaciones
  aprobaciones: (f: { estado?: 'pendiente' | 'aprobado' | 'rechazado'; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
    return apiFetch(`/api/aprobaciones${qs.size ? `?${qs}` : ''}`);
  },
  aprobar: (id: number, notas?: string) => apiFetch(`/api/aprobaciones/${id}/aprobar`, { method: 'POST', body: JSON.stringify({ notas }) }),
  rechazar: (id: number, notas?: string) => apiFetch(`/api/aprobaciones/${id}/rechazar`, { method: 'POST', body: JSON.stringify({ notas }) }),
  resetPanelData: () =>
    apiFetch('/api/config/reset-panel', {
      method: 'POST',
    }),
};
