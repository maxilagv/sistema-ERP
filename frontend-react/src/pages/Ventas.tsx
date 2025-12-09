import { useCallback, useEffect, useMemo, useState } from 'react';
import ChartCard from '../ui/ChartCard';
import DataTable from '../ui/DataTable';
import { Api } from '../lib/api';

type Cliente = { id: number; nombre: string; apellido?: string };
type Producto = {
  id: number;
  name: string;
  price: number;
  category_name?: string;
  precio_final?: number | null;
  price_local?: number | null;
  price_distribuidor?: number | null;
  costo_pesos?: number | null;
  costo_dolares?: number | null;
  margen_local?: number | null;
  margen_distribuidor?: number | null;
};
type Venta = {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  fecha: string;
  total: number;
  descuento: number;
  impuestos: number;
  neto: number;
  estado_pago: string;
  estado_entrega?: 'pendiente' | 'entregado';
  total_pagado?: number;
  saldo_pendiente?: number;
  oculto?: boolean;
};

type ItemDraft = {
	producto_id: number | '';
	cantidad: string;
	precio_unitario: string;
  };
  

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
  const [priceType, setPriceType] = useState<'local' | 'distribuidor' | 'final'>('local');

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
      setProductos(
        (p || []).map((r: any) => ({
          id: Number(r.id),
          name: r.name,
          price: Number(r.price || 0),
          category_name: r.category_name,
          precio_final:
            typeof r.precio_final !== 'undefined' && r.precio_final !== null
              ? Number(r.precio_final)
              : null,
          price_local:
            typeof r.price_local !== 'undefined' && r.price_local !== null
              ? Number(r.price_local)
              : null,
          price_distribuidor:
            typeof r.price_distribuidor !== 'undefined' && r.price_distribuidor !== null
              ? Number(r.price_distribuidor)
              : null,
          costo_pesos:
            typeof r.costo_pesos !== 'undefined' && r.costo_pesos !== null
              ? Number(r.costo_pesos)
              : null,
          costo_dolares:
            typeof r.costo_dolares !== 'undefined' && r.costo_dolares !== null
              ? Number(r.costo_dolares)
              : null,
          margen_local:
            typeof r.margen_local !== 'undefined' && r.margen_local !== null
              ? Number(r.margen_local)
              : null,
          margen_distribuidor:
            typeof r.margen_distribuidor !== 'undefined' && r.margen_distribuidor !== null
              ? Number(r.margen_distribuidor)
              : null,
        })),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const productosById = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);

  const calculatePriceByType = useCallback((prod: Producto | undefined) => {
    if (!prod) return 0;
    const basePrice = Number(prod.price || 0);
    const costoPesos = typeof prod.costo_pesos === 'number' ? prod.costo_pesos || 0 : 0;
    const margenLocal =
      typeof prod.margen_local === 'number' && prod.margen_local !== null
        ? prod.margen_local
        : 0.15;
    const margenDistribuidor =
      typeof prod.margen_distribuidor === 'number' && prod.margen_distribuidor !== null
        ? prod.margen_distribuidor
        : 0.45;

    const precioLocalCalc = costoPesos > 0 ? costoPesos * (1 + margenLocal) : 0;
    const precioDistribuidorCalc = costoPesos > 0 ? costoPesos * (1 + margenDistribuidor) : 0;

    let priceToUse = 0;

    switch (priceType) {
      case 'final': {
        const finalManual =
          typeof prod.precio_final === 'number' && prod.precio_final > 0 ? prod.precio_final : 0;
        priceToUse = finalManual || precioLocalCalc || basePrice || precioDistribuidorCalc;
        break;
      }
      case 'distribuidor': {
        const dist =
          typeof prod.price_distribuidor === 'number' && prod.price_distribuidor > 0
            ? prod.price_distribuidor
            : 0;
        priceToUse = dist || precioDistribuidorCalc || basePrice || precioLocalCalc;
        break;
      }
      case 'local':
      default: {
        const local =
          typeof prod.price_local === 'number' && prod.price_local > 0 ? prod.price_local : 0;
        priceToUse = local || precioLocalCalc || basePrice || precioDistribuidorCalc;
        break;
      }
    }

    try {
      console.log('[Ventas] auto precio', {
        priceType,
        prodId: prod.id,
        basePrice,
        precio_local: prod.price_local,
        precio_distribuidor: prod.price_distribuidor,
        precio_final: prod.precio_final,
        costo_pesos: prod.costo_pesos,
        margen_local: prod.margen_local,
        margen_distribuidor: prod.margen_distribuidor,
        precioLocalCalc,
        precioDistribuidorCalc,
        priceToUse,
      });
    } catch {}

    return priceToUse > 0 ? priceToUse : 0;
  }, [priceType]);

  // Recalculate all item prices when the global priceType changes
  useEffect(() => {
    setItems(prevItems =>
      prevItems.map(it => {
        const prod = productosById.get(Number(it.producto_id));
        const newAutoPrice = calculatePriceByType(prod);
        // Only update the price if the product is already selected
        if (it.producto_id) {
          return { ...it, precio_unitario: newAutoPrice > 0 ? String(newAutoPrice) : '' };
        }
        return it;
      })
    );
  }, [priceType, productosById, calculatePriceByType]);
  

  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => {
      const unit = Number(it.precio_unitario || 0);
      const qty = Number(it.cantidad || 0);
      return acc + unit * qty;
    }, 0);
  }, [items]);

  const neto = useMemo(() => subtotal - (descuento || 0) + (impuestos || 0), [subtotal, descuento, impuestos]);

  function addItemRow() { setItems(prev => [...prev, { producto_id: '', cantidad: '1', precio_unitario: '' }]); }
  function removeItemRow(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  async function submitVenta() {
    setError('');
    try {
      if (!clienteId) {
        setError('Selecciona un cliente');
        return;
      }
      const cleanItems = items
        .map(it => ({
          producto_id: Number(it.producto_id),
          cantidad: Math.max(1, parseInt(it.cantidad || '0', 10) || 0),
          precio_unitario: Number(it.precio_unitario || 0),
        }))
        .filter(it => it.producto_id > 0 && it.cantidad > 0 && it.precio_unitario > 0);

      if (!cleanItems.length) {
        setError('Agrega al menos un producto con cantidad y precio válidos');
        return;
      }
      const body = {
        cliente_id: Number(clienteId),
        fecha: new Date(fecha).toISOString(),
        descuento: Number(descuento || 0),
        impuestos: Number(impuestos || 0),
        items: cleanItems,
      };

      await Api.crearVenta(body);
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
    const pendiente = Math.max(0, (venta.saldo_pendiente ?? (venta.neto - (venta.total_pagado || 0))));
    const montoStr = window.prompt(`Registrar pago para venta #${venta.id} (pendiente: $${pendiente.toFixed(2)})`, '0');
    const monto = Number(montoStr);
    if (!Number.isFinite(monto) || monto <= 0) return;
    try {
      await Api.crearPago({ venta_id: venta.id, cliente_id: venta.cliente_id, monto, metodo: 'efectivo' });
      await loadAll();
    } catch (e) {
      // no-op
    }
  }

  async function ocultarVenta(venta: Venta) {
    if (!window.confirm(`¿Ocultar la venta #${venta.id} del listado principal?`)) return;
    try {
      await Api.ocultarVenta(venta.id);
      await loadAll();
    } catch (e: any) {
      alert(e?.message || 'No se pudo ocultar la venta');
    }
  }

  const abiertas = (ventas || []).filter(
    v => !v.oculto && ((v.estado_entrega || 'pendiente') !== 'entregado' || v.estado_pago !== 'pagada'),
  );
  const cerradas = (ventas || []).filter(
    v => !v.oculto && (v.estado_entrega || 'pendiente') === 'entregado' && v.estado_pago === 'pagada',
  );

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

            <div className="mt-2 text-sm">
              <div className="flex items-center gap-4 text-slate-300">
                <label className="flex items-center gap-2">
                  <span className="text-slate-400">Tipo de Precio:</span>
                  <select
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value as 'local' | 'distribuidor' | 'final')}
                    className="bg-white/10 border border-white/10 rounded px-2 py-1 text-xs"
                  >
                    <option value="local">Precio Local</option>
                    <option value="distribuidor">Precio Distribuidor</option>
                    <option value="final">Precio Final</option>
                  </select>
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
                    const autoPrice = calculatePriceByType(prod);
                    const qty = Number(it.cantidad || 0);
                    const effectivePrice = Number(it.precio_unitario || 0);

                    return (
                      <tr key={idx} className="border-t border-white/10">
                        <td className="py-2 px-2">
                          <select
                            value={it.producto_id}
                            onChange={(e) => {
                              const newProdId = e.target.value ? Number(e.target.value) : '';
                              const newProd = productosById.get(newProdId);
                              const newAutoPrice = calculatePriceByType(newProd);
                              updateItem(idx, {
                                producto_id: newProdId,
                                precio_unitario: newAutoPrice > 0 ? String(newAutoPrice) : '',
                              });
                            }}
                            className="bg-white/10 border border-white/10 rounded px-2 py-1"
                          >
                            <option value="">Seleccionar…</option>
                            {productos.map(p => <option key={p.id} value={p.id}>{p.name} {p.category_name ? `(${p.category_name})` : ''}</option>)}
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder={autoPrice > 0 ? autoPrice.toFixed(2) : 'Ingrese precio'}
                            value={it.precio_unitario}
                            onChange={(e) => updateItem(idx, { precio_unitario: e.target.value })}
                            className="w-28 bg-white/10 border border-white/10 rounded px-2 py-1"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input type="number" min={1} value={it.cantidad} onChange={(e) => updateItem(idx, { cantidad: e.target.value })} className="w-20 bg-white/10 border border-white/10 rounded px-2 py-1" />
                        </td>
                        <td className="py-2 px-2">${(effectivePrice * qty).toFixed(2)}</td>
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
                <th className="py-2 px-2">Saldo</th>
                <th className="py-2 px-2">Pago</th>
                <th className="py-2 px-2">Entrega</th>
                <th className="py-2 px-2">Acciones</th>
              </tr>
            </thead>
          }
        >
          <tbody className="text-slate-200">
            {(loading ? [] : abiertas).map((v) => (
              <tr key={v.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="py-2 px-2">{v.id}</td>
                <td className="py-2 px-2">{v.cliente_nombre}</td>
                <td className="py-2 px-2">{new Date(v.fecha).toLocaleString()}</td>
                <td className="py-2 px-2">${Number(v.total || 0).toFixed(2)}</td>
                <td className="py-2 px-2">${Number(v.neto || 0).toFixed(2)}</td>
                <td className="py-2 px-2">${Math.max(0, Number((v.saldo_pendiente ?? (v.neto - (v.total_pagado || 0))) || 0)).toFixed(2)}</td>
                <td className="py-2 px-2">
                  {(() => {
                    const pendiente = Math.max(0, Number((v.saldo_pendiente ?? (v.neto - (v.total_pagado || 0))) || 0));
                    const pagado = Math.max(0, Number((v.total_pagado != null ? v.total_pagado : ((v.neto || 0) - pendiente))));
                    return (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs">
                          Pagó ${pagado.toFixed(2)}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-xs ${pendiente > 0 ? 'bg-amber-500/20 border-amber-500/30 text-amber-200' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200'}`}>
                          Debe ${pendiente.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                </td>
                <td className="py-2 px-2">{v.estado_entrega || 'pendiente'}</td>
                <td className="py-2 px-2 space-x-2">
                  {v.estado_pago !== 'pagada' && (
                    <button onClick={() => registrarPago(v)} className="px-2 py-1 rounded bg-primary-500/20 border border-primary-500/30 hover:bg-primary-500/30 text-primary-200 text-xs">Registrar pago</button>
                  )}
                  {(v.estado_entrega || 'pendiente') === 'pendiente' && (
                    <button onClick={async () => { try { await Api.entregarVenta(v.id); await loadAll(); } catch (e: any) { alert(e?.message || 'No se pudo marcar entregado'); } }} className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-200 text-xs">Marcar entregado</button>
                  )}
                  {(v.estado_entrega || 'pendiente') === 'entregado' && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            const blob = await Api.descargarRemito(v.id);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `remito-${v.id}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                          } catch (e: any) {
                            alert(e?.message || 'No se pudo descargar el remito');
                          }
                        }}
                        className="px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 text-slate-200 text-xs"
                      >Remito PDF</button>
                      <button
                        onClick={() => ocultarVenta(v)}
                        className="px-2 py-1 rounded bg-slate-700/60 border border-slate-500/60 hover:bg-slate-600/80 text-slate-100 text-xs"
                      >Ocultar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!loading && abiertas.length === 0 && (
              <tr><td className="py-3 px-2 text-slate-400" colSpan={9}>Sin ventas</td></tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>

      {/* Historial de ventas cerradas: pagadas y entregadas */}
      <ChartCard title="Historial" right={null}>
        <DataTable
          headers={
            <thead className="text-left text-slate-400">
              <tr>
                <th className="py-2 px-2">ID</th>
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">Fecha</th>
                <th className="py-2 px-2">Total</th>
                <th className="py-2 px-2">Neto</th>
                <th className="py-2 px-2">Pago</th>
                <th className="py-2 px-2">Entrega</th>
                <th className="py-2 px-2">Acciones</th>
              </tr>
            </thead>
          }
        >
          <tbody className="text-slate-200">
            {(loading ? [] : cerradas).map((v) => (
              <tr key={v.id} className="border-t border-white/10 hover:bg-white/5">
                <td className="py-2 px-2">{v.id}</td>
                <td className="py-2 px-2">{v.cliente_nombre}</td>
                <td className="py-2 px-2">{new Date(v.fecha).toLocaleString()}</td>
                <td className="py-2 px-2">${Number(v.total || 0).toFixed(2)}</td>
                <td className="py-2 px-2">${Number(v.neto || 0).toFixed(2)}</td>
                <td className="py-2 px-2">
                  {(() => {
                    const pendiente = Math.max(0, Number((v.saldo_pendiente ?? (v.neto - (v.total_pagado || 0))) || 0));
                    const pagado = Math.max(0, Number((v.total_pagado != null ? v.total_pagado : ((v.neto || 0) - pendiente))));
                    return (
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs">
                          Pagó ${pagado.toFixed(2)}
                        </span>
                        <span className={`px-2 py-0.5 rounded border text-xs ${pendiente > 0 ? 'bg-amber-500/20 border-amber-500/30 text-amber-200' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200'}`}>
                          Debe ${pendiente.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                </td>
                <td className="py-2 px-2">{v.estado_entrega || 'pendiente'}</td>
                <td className="py-2 px-2 space-x-2">
                  <button
                    onClick={async () => {
                      try {
                        const blob = await Api.descargarRemito(v.id);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `remito-${v.id}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                      } catch (e: any) {
                        alert(e?.message || 'No se pudo descargar el remito');
                      }
                    }}
                    className="px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/20 text-slate-200 text-xs"
                  >Remito PDF</button>
                  <button
                    onClick={() => ocultarVenta(v)}
                    className="px-2 py-1 rounded bg-slate-700/60 border border-slate-500/60 hover:bg-slate-600/80 text-slate-100 text-xs"
                  >Ocultar</button>
                </td>
              </tr>
            ))}
            {!loading && cerradas.length === 0 && (
              <tr><td className="py-3 px-2 text-slate-400" colSpan={8}>Sin historial</td></tr>
            )}
          </tbody>
        </DataTable>
      </ChartCard>
    </div>
  );
}
