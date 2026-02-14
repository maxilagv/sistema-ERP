import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Api } from '../lib/api';
import { useClientAuth } from '../context/ClientAuthContext';
import Button from '../ui/Button';

type TabKey = 'compras' | 'deuda' | 'promociones' | 'cuenta';

type Compra = {
  id: number;
  fecha: string;
  neto: number;
  total_pagado: number;
  saldo_pendiente: number;
  estado_pago: string;
  estado_entrega: string;
};

type DeudaResponse = {
  resumen: {
    deuda_total: number;
    deuda_0_30: number;
    deuda_31_60: number;
    deuda_61_90: number;
    deuda_mas_90: number;
    saldo_total: number;
    dias_promedio_atraso: number | null;
  };
  ventas: Array<{
    venta_id: number;
    fecha: string;
    neto: number;
    total_pagado: number;
    saldo: number;
  }>;
  deudas_iniciales: Array<{
    id: number;
    monto: number;
    fecha: string;
    descripcion: string;
  }>;
  pagos_deudas_iniciales: Array<{
    id: number;
    monto: number;
    fecha: string;
    descripcion: string;
  }>;
};

export default function ClientPortal() {
  const navigate = useNavigate();
  const { logout } = useClientAuth();

  const [tab, setTab] = useState<TabKey>('compras');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<any>(null);
  const [deuda, setDeuda] = useState<DeudaResponse | null>(null);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [promos, setPromos] = useState<any[]>([]);

  const [detalleCompra, setDetalleCompra] = useState<any[] | null>(null);
  const [detalleCompraId, setDetalleCompraId] = useState<number | null>(null);

  const [savingCuenta, setSavingCuenta] = useState(false);
  const [cuentaOk, setCuentaOk] = useState<string | null>(null);
  const [cuentaForm, setCuentaForm] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    direccion: '',
  });

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [meRes, deudaRes, comprasRes, promosRes] = await Promise.all([
        Api.clienteMe(),
        Api.clienteDeudaPortal(),
        Api.clienteComprasPortal(),
        Api.clientePromociones().catch(() => []),
      ]);
      setMe(meRes);
      setDeuda(deudaRes as DeudaResponse);
      setCompras(
        ((comprasRes as any[]) || []).map((r: any) => ({
          id: Number(r.id),
          fecha: r.fecha,
          neto: Number(r.neto || 0),
          total_pagado: Number(r.total_pagado || 0),
          saldo_pendiente: Number(r.saldo_pendiente || 0),
          estado_pago: r.estado_pago,
          estado_entrega: r.estado_entrega,
        }))
      );
      setPromos((promosRes as any[]) || []);
      setCuentaForm({
        nombre: meRes?.nombre || '',
        apellido: meRes?.apellido || '',
        telefono: meRes?.telefono || '',
        email: meRes?.email || '',
        direccion: meRes?.direccion || '',
      });
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar el portal del cliente');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const resumenDeuda = deuda?.resumen;
  const saldoFavor = useMemo(() => {
    const saldo = Number(resumenDeuda?.saldo_total || 0);
    return saldo < 0 ? Math.abs(saldo) : 0;
  }, [resumenDeuda]);

  async function openCompraDetalle(id: number) {
    try {
      setDetalleCompraId(id);
      const det = await Api.clienteCompraDetallePortal(id);
      setDetalleCompra((det as any[]) || []);
    } catch (e: any) {
      setError(e?.message || 'No se pudo obtener el detalle de compra');
    }
  }

  async function guardarCuenta(e: React.FormEvent) {
    e.preventDefault();
    setSavingCuenta(true);
    setCuentaOk(null);
    setError(null);
    try {
      const updated = await Api.clienteActualizarCuenta(cuentaForm);
      setMe((prev: any) => ({ ...prev, ...updated }));
      setCuentaOk('Datos actualizados correctamente.');
    } catch (err: any) {
      setError(err?.message || 'No se pudo actualizar la cuenta');
    } finally {
      setSavingCuenta(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div>
            <div className="font-bold text-lg">Portal Cliente</div>
            <div className="text-xs text-slate-400">{me ? `${me.nombre || ''} ${me.apellido || ''}`.trim() : 'Mi cuenta'}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/catalogo')} className="bg-indigo-600 hover:bg-indigo-500 border-none">
              Catalogo y carrito
            </Button>
            <Button onClick={logout} className="bg-slate-800 hover:bg-slate-700 text-slate-100 border-none">
              Cerrar sesion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
          {[
            { k: 'compras', label: 'Mis compras' },
            { k: 'deuda', label: 'Mi deuda' },
            { k: 'promociones', label: 'Promociones' },
            { k: 'cuenta', label: 'Mi cuenta' },
          ].map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k as TabKey)}
              className={`px-3 py-2 rounded-md text-sm ${
                tab === t.k ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={loadAll}
            className="ml-auto px-3 py-2 rounded-md text-sm bg-slate-900 text-slate-300 hover:bg-slate-800"
          >
            Actualizar
          </button>
        </div>

        {error && <div className="rounded-md border border-red-700 bg-red-950/50 text-red-200 px-3 py-2 text-sm">{error}</div>}
        {cuentaOk && <div className="rounded-md border border-emerald-700 bg-emerald-950/50 text-emerald-200 px-3 py-2 text-sm">{cuentaOk}</div>}

        {loading ? (
          <div className="text-sm text-slate-400">Cargando portal...</div>
        ) : (
          <>
            {tab === 'compras' && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="px-3 py-3">ID</th>
                      <th className="px-3 py-3">Fecha</th>
                      <th className="px-3 py-3 text-right">Total</th>
                      <th className="px-3 py-3 text-right">Pagado</th>
                      <th className="px-3 py-3 text-right">Saldo</th>
                      <th className="px-3 py-3">Pago</th>
                      <th className="px-3 py-3">Entrega</th>
                      <th className="px-3 py-3">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compras.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                          Todavia no tenes compras registradas.
                        </td>
                      </tr>
                    )}
                    {compras.map((c) => (
                      <tr key={c.id} className="border-t border-slate-800">
                        <td className="px-3 py-3">#{c.id}</td>
                        <td className="px-3 py-3">{new Date(c.fecha).toLocaleDateString()}</td>
                        <td className="px-3 py-3 text-right">${c.neto.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right">${c.total_pagado.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right">${c.saldo_pendiente.toFixed(2)}</td>
                        <td className="px-3 py-3 capitalize">{c.estado_pago}</td>
                        <td className="px-3 py-3 capitalize">{c.estado_entrega}</td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="text-indigo-300 hover:text-indigo-200"
                            onClick={() => openCompraDetalle(c.id)}
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'deuda' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="text-xs text-slate-400">Deuda total</div>
                    <div className="text-2xl font-semibold">${Number(resumenDeuda?.deuda_total || 0).toFixed(2)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="text-xs text-slate-400">Deuda &gt; 90 dias</div>
                    <div className="text-2xl font-semibold">${Number(resumenDeuda?.deuda_mas_90 || 0).toFixed(2)}</div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="text-xs text-slate-400">Saldo a favor</div>
                    <div className="text-2xl font-semibold">${saldoFavor.toFixed(2)}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-400">
                      <tr>
                        <th className="px-3 py-3">Venta</th>
                        <th className="px-3 py-3">Fecha</th>
                        <th className="px-3 py-3 text-right">Neto</th>
                        <th className="px-3 py-3 text-right">Pagado</th>
                        <th className="px-3 py-3 text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(deuda?.ventas || []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                            Sin saldos pendientes.
                          </td>
                        </tr>
                      )}
                      {(deuda?.ventas || []).map((v) => (
                        <tr key={v.venta_id} className="border-t border-slate-800">
                          <td className="px-3 py-3">#{v.venta_id}</td>
                          <td className="px-3 py-3">{new Date(v.fecha).toLocaleDateString()}</td>
                          <td className="px-3 py-3 text-right">${Number(v.neto || 0).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right">${Number(v.total_pagado || 0).toFixed(2)}</td>
                          <td className="px-3 py-3 text-right">${Number(v.saldo || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'promociones' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {promos.length === 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-400">
                    No hay promociones activas por ahora.
                  </div>
                )}
                {promos.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-2">
                    <div className="text-lg font-semibold">{p.titulo}</div>
                    <div className="text-sm text-slate-300">{p.descripcion || 'Promocion activa para clientes.'}</div>
                    <div className="text-sm text-emerald-300">
                      {p.descuento_porcentaje != null ? `${Number(p.descuento_porcentaje).toFixed(1)}% off` : 'Beneficio especial'}
                    </div>
                    {(p.fecha_inicio || p.fecha_fin) && (
                      <div className="text-xs text-slate-400">
                        Vigencia: {p.fecha_inicio || 'inicio abierto'} - {p.fecha_fin || 'sin fecha de fin'}
                      </div>
                    )}
                    {p.codigo && <div className="text-xs text-indigo-300">Codigo: {p.codigo}</div>}
                  </div>
                ))}
              </div>
            )}

            {tab === 'cuenta' && (
              <form onSubmit={guardarCuenta} className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 max-w-3xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    className="input-modern"
                    placeholder="Nombre"
                    value={cuentaForm.nombre}
                    onChange={(e) => setCuentaForm((p) => ({ ...p, nombre: e.target.value }))}
                  />
                  <input
                    className="input-modern"
                    placeholder="Apellido"
                    value={cuentaForm.apellido}
                    onChange={(e) => setCuentaForm((p) => ({ ...p, apellido: e.target.value }))}
                  />
                  <input
                    className="input-modern"
                    placeholder="Telefono"
                    value={cuentaForm.telefono}
                    onChange={(e) => setCuentaForm((p) => ({ ...p, telefono: e.target.value }))}
                  />
                  <input
                    className="input-modern"
                    placeholder="Email"
                    type="email"
                    value={cuentaForm.email}
                    onChange={(e) => setCuentaForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <textarea
                  className="input-modern w-full min-h-[90px]"
                  placeholder="Direccion"
                  value={cuentaForm.direccion}
                  onChange={(e) => setCuentaForm((p) => ({ ...p, direccion: e.target.value }))}
                />
                <Button type="submit" disabled={savingCuenta}>
                  {savingCuenta ? 'Guardando...' : 'Guardar datos'}
                </Button>
              </form>
            )}
          </>
        )}

        {detalleCompraId != null && (
          <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4" onClick={() => { setDetalleCompraId(null); setDetalleCompra(null); }}>
            <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Detalle compra #{detalleCompraId}</h3>
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-200"
                  onClick={() => { setDetalleCompraId(null); setDetalleCompra(null); }}
                >
                  Cerrar
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="px-2 py-2">Producto</th>
                      <th className="px-2 py-2 text-right">Cantidad</th>
                      <th className="px-2 py-2 text-right">Precio</th>
                      <th className="px-2 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detalleCompra || []).length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-center text-slate-500">
                          Sin items.
                        </td>
                      </tr>
                    )}
                    {(detalleCompra || []).map((it: any) => (
                      <tr key={it.id} className="border-t border-slate-800">
                        <td className="px-2 py-2">{it.producto_nombre}</td>
                        <td className="px-2 py-2 text-right">{it.cantidad}</td>
                        <td className="px-2 py-2 text-right">${Number(it.precio_unitario || 0).toFixed(2)}</td>
                        <td className="px-2 py-2 text-right">${Number(it.subtotal || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
