import { useEffect, useMemo, useState } from 'react';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';
import { Api } from '../lib/api';

type Cliente = { id: number; nombre: string; apellido?: string };
type Producto = { id: number; name: string; price: number; category_name?: string };
type Venta = { id: number; cliente_id: number; cliente_nombre: string; fecha: string; total: number; descuento: number; impuestos: number; neto: number; estado_pago: string };

type ItemDraft = { producto_id: number | ''; cantidad: string; precio_unitario: string };

export default function Ventas() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  // Nueva venta state
  const [open, setOpen] = useState(false);
  const [clienteId, setClienteId] = useState<number | ''>('');
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 16)); // yyyy-MM-ddTHH:mm
  const [descuento, setDescuento] = useState<number>(0);
  const [impuestos, setImpuestos] = useState<number>(0);
  const [items, setItems] = useState<ItemDraft[]>([{ producto_id: '', cantidad: '1', precio_unitario: '' }]);
  const [error, setError] = useState<string>('');

  async function loadAll() {
    setLoading(true);
    try {
      const [v, c, p] = await Promise.all([
        Api.ventas(),
        Api.clientes(),
        Api.productos(),
      ]);
      setVentas(v || []);
      setClientes(c || []);
      setProductos((p || []).map((r: any) => ({ id: r.id, name: r.name, price: Number(r.price || 0), category_name: r.category_name })));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const productosById = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => {
      const prod = productosById.get(Number(it.producto_id));
      const unit = it.precio_unitario !== '' ? Number(it.precio_unitario) : (prod?.price ?? 0);
      const qty = Number(it.cantidad || 0);
      return acc + unit * qty;
    }, 0);
  }, [items, productosById]);

  const neto = useMemo(() => subtotal - (descuento || 0) + (impuestos || 0), [subtotal, descuento, impuestos]);

  function addItemRow() { setItems(prev => [...prev, { producto_id: '', cantidad: '1', precio_unitario: '' }]); }
  function removeItemRow(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  async function submitVenta() {
    setError('');
    try {
      if (import.meta?.env?.DEV) {
        console.debug('[Ventas] submitVenta called', { clienteId, items });
      }
      if (!clienteId) {
        if (import.meta?.env?.DEV) {
          console.warn('[Ventas] Validación: cliente no seleccionado');
        }
        setError('Selecciona un cliente');
        return;
      }
      const cleanItems = items
        .map(it => ({
          producto_id: Number(it.producto_id),
          cantidad: Math.max(1, parseInt(it.cantidad || '0', 10) || 0),
          precio_unitario: it.precio_unitario !== '' ? Number(it.precio_unitario) : undefined,
        }))
        .filter(it => it.producto_id > 0 && it.cantidad > 0);
      if (!cleanItems.length) {
        if (import.meta?.env?.DEV) {
          console.warn('[Ventas] Validación: sin items válidos', { items });
        }
        setError('Agrega al menos un producto');
        return;
      }
      const body = {
        cliente_id: Number(clienteId),
        fecha: new Date(fecha).toISOString(),
        descuento: Number(descuento || 0),
        impuestos: Number(impuestos || 0),
        items: cleanItems,
      };
      if (import.meta?.env?.DEV) {
        console.debug('[Ventas] Enviando venta', body);
      }
      const r = await Api.crearVenta(body);
      // reset form
      setClienteId('');
      setFecha(new Date().toISOString().slice(0,16));
      setDescuento(0);
      setImpuestos(0);
      setItems([{ producto_id: '', cantidad: '1', precio_unitario: '' }]);
      setOpen(false);
      await loadAll();
    } catch (e: any) {
      if (import.meta?.env?.DEV) {
        console.error('[Ventas] Error creando venta', e);
      }
      setError(e?.message || 'Error al crear la venta');
    }
  }

  async function registrarPago(venta: Venta) {
    const montoStr = window.prompt(`Registrar pago para venta #${venta.id} (pendiente: $${Math.max(0, venta.neto).toFixed(2)})`, '0');
    const monto = Number(montoStr);
    if (!Number.isFinite(monto) || monto <= 0) return;
    try {
      await Api.crearPago({ venta_id: venta.id, cliente_id: venta.cliente_id, monto, metodo: 'efectivo' });
      await loadAll();
    } catch (e) {
      // no-op
    }
  }

  return (
    <div className="space-y-6">
      <ChartCard title="Ventas" right={
        <button onClick={() => setOpen(o => !o)} className="px-3 py-1.5 rounded bg-primary-500/20 border border-primary-500/30 hover:bg-primary-500/30 text-primary-200 text-sm">{open ? 'Cancelar' : 'Nueva venta'}</button>
      }>
        {open && (
          <div className="mb-4 p-3 rounded-lg border border-white/10 bg-white/5 space-y-3">
            {error && <div className="text-rose-300 text-sm">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Cliente</div>
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')} className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-sm">
                  <option value="">Seleccionar…</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}{c.apellido ? ` ${c.apellido}` : ''}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Fecha</div>
                <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="text-slate-400 mb-1">Descuento</div>
                  <input type="number" step="0.01" value={descuento} onChange={(e) => setDescuento(Number(e.target.value))} className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-sm" />
                </label>
                <label className="text-sm">
                  <div className="text-slate-400 mb-1">Impuestos</div>
                  <input type="number" step="0.01" value={impuestos} onChange={(e) => setImpuestos(Number(e.target.value))} className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-sm" />
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="py-2 px-2">Producto</th>
                    <th className="py-2 px-2">Precio</th>
                    <th className="py-2 px-2">Cantidad</th>
                    <th className="py-2 px-2">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {items.map((it, idx) => {
                    const prod = productosById.get(Number(it.producto_id));
                    const price = it.precio_unitario !== '' ? Number(it.precio_unitario) : (prod?.price ?? 0);
                    const qty = Number(it.cantidad || 0);
                    return (
                      <tr key={idx} className="border-t border-white/10">
                        <td className="py-2 px-2">
                          <select value={it.producto_id} onChange={(e) => updateItem(idx, { producto_id: e.target.value ? Number(e.target.value) : '' })} className="bg-white/10 border border-white/10 rounded px-2 py-1">
                            <option value="">Seleccionar…</option>
                            {productos.map(p => <option key={p.id} value={p.id}>{p.name} {p.category_name ? `(${p.category_name})` : ''}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" step="0.01" placeholder={prod ? String(prod.price) : ''} value={it.precio_unitario} onChange={(e) => updateItem(idx, { precio_unitario: e.target.value })} className="w-28 bg-white/10 border border-white/10 rounded px-2 py-1" />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" min={1} value={it.cantidad} onChange={(e) => updateItem(idx, { cantidad: e.target.value })} className="w-20 bg-white/10 border border-white/10 rounded px-2 py-1" />
                        </td>
                        <td className="py-2 px-2">${(price * qty).toFixed(2)}</td>
                        <td className="py-2 px-2">
                          <button onClick={() => removeItemRow(idx)} className="px-2 py-1 rounded bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-200 text-xs">Quitar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-2">
                <button onClick={addItemRow} className="px-2 py-1 rounded bg-white/10 border border-white/10 hover:bg-white/15 text-slate-200 text-xs">+ Agregar ítem</button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-6 text-sm">
              <div className="text-slate-300">Subtotal: <span className="font-semibold text-slate-100">${subtotal.toFixed(2)}</span></div>
              <div className="text-slate-300">Neto: <span className="font-semibold text-slate-100">${neto.toFixed(2)}</span></div>
              <button onClick={submitVenta} className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-200 text-sm">Crear venta</button>
            </div>
          </div>
        )}

        <DataTable
          headers={
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 px-2">ID</th>
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">Fecha</th>
                <th className="py-2 px-2">Total</th>
                <th className="py-2 px-2">Neto</th>
                <th className="py-2 px-2">Estado</th>
                <th className="py-2 px-2">Acciones</th>
              </tr>
            </thead>
          }
        >
          <tbody className="text-slate-200">
            {(loading ? [] : ventas).map((v) => (
              <tr key={v.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="py-2 px-2">{v.id}</td>
                <td className="py-2 px-2">{v.cliente_nombre}</td>
                <td className="py-2 px-2">{new Date(v.fecha).toLocaleString()}</td>
                <td className="py-2 px-2">${Number(v.total || 0).toFixed(2)}</td>
                <td className="py-2 px-2">${Number(v.neto || 0).toFixed(2)}</td>
                <td className="py-2 px-2">{v.estado_pago}</td>
                <td className="py-2 px-2 space-x-2">
                  <button onClick={() => registrarPago(v)} className="px-2 py-1 rounded bg-primary-500/20 border border-primary-500/30 hover:bg-primary-500/30 text-primary-200 text-xs">Registrar pago</button>
                </td>
              </tr>
            ))}
            {!loading && ventas.length === 0 && (
              <tr><td className="py-3 px-2 text-slate-400" colSpan={7}>Sin ventas</td></tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>
    </div>
  );
}
