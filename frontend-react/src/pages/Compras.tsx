import { useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';

type Producto = {
  id: number;
  name: string;
  category_name?: string;
  stock_quantity: number;
  price: number;
};

type Proveedor = {
  id: number;
  nombre: string;
  telefono?: string | null;
  direccion?: string | null;
};

type CompraForm = {
  producto_id: number | '';
  proveedor_id: number | '';
  proveedor_nombre: string;
  proveedor_ciudad: string;
  proveedor_telefono: string;
  notas: string;
  cantidad: string;
  costo_unitario: string;
};

type CompraRow = {
  id: number;
  proveedor_nombre: string;
  fecha: string;
  total_costo: number;
  moneda: string;
  estado: string;
};

const initialForm: CompraForm = {
  producto_id: '',
  proveedor_id: '',
  proveedor_nombre: '',
  proveedor_ciudad: '',
  proveedor_telefono: '',
  notas: '',
  cantidad: '',
  costo_unitario: '',
};

function getRoleFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base.padEnd(Math.ceil(base.length / 4) * 4, '=');
    const json = atob(padded);
    const payload = JSON.parse(json);
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export default function Compras() {
  const { accessToken } = useAuth();
  const role = useMemo(() => getRoleFromToken(accessToken), [accessToken]);
  const canManagePurchases = role === 'admin' || role === 'gerente';

  const [productos, setProductos] = useState<Producto[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(true);
  const [compras, setCompras] = useState<CompraRow[]>([]);
  const [loadingCompras, setLoadingCompras] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CompraForm>(initialForm);
  const [savedDraft, setSavedDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedProducto = useMemo(
    () => productos.find((p) => p.id === Number(form.producto_id)),
    [productos, form.producto_id]
  );

  const formValid = useMemo(() => {
    const cantidad = Number(form.cantidad || '0');
    const costo = Number(form.costo_unitario || '0');
    const hasExistingProveedor = !!form.proveedor_id;
    const hasNewProveedorData =
      form.proveedor_nombre.trim().length > 0 &&
      form.proveedor_ciudad.trim().length > 0;
    return (
      !!form.producto_id &&
      (hasExistingProveedor || hasNewProveedorData) &&
      cantidad > 0 &&
      costo > 0
    );
  }, [form]);

  const canSubmitNow = formValid && canManagePurchases && !submitting;

  async function loadProductos() {
    setLoadingProductos(true);
    setError(null);
    try {
      const data = await Api.productos();
      setProductos(
        (data || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          category_name: r.category_name,
          stock_quantity: Number(r.stock_quantity ?? 0),
          price: Number(r.price ?? 0),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando productos');
    } finally {
      setLoadingProductos(false);
    }
  }

  async function loadProveedores() {
    setLoadingProveedores(true);
    try {
      const data = await Api.proveedores();
      setProveedores(
        (data || []).map((r: any) => ({
          id: r.id,
          nombre: r.nombre,
          telefono: r.telefono,
          direccion: r.direccion,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando proveedores');
    } finally {
      setLoadingProveedores(false);
    }
  }

  async function loadCompras() {
    setLoadingCompras(true);
    try {
      const data = await Api.compras();
      setCompras(
        (data || []).map((r: any) => ({
          id: r.id,
          proveedor_nombre: r.proveedor_nombre,
          fecha: r.fecha,
          total_costo: Number(r.total_costo ?? 0),
          moneda: r.moneda || 'ARS',
          estado: r.estado || 'pendiente',
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando compras');
    } finally {
      setLoadingCompras(false);
    }
  }

  useEffect(() => {
    loadProductos();
    loadProveedores();
    loadCompras();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManagePurchases) {
      setError('No tienes permisos para registrar compras (solo admin o gerente).');
      return;
    }
    if (!formValid) return;

    setError(null);
    setSavedDraft(false);
    setSubmitting(true);
    try {
      let proveedorId: number;
      if (form.proveedor_id) {
        proveedorId = Number(form.proveedor_id);
      } else {
        // Crear proveedor simple con los datos ingresados
        const proveedor = await Api.crearProveedor({
          nombre: form.proveedor_nombre.trim(),
          telefono: form.proveedor_telefono.trim() || undefined,
          direccion: form.proveedor_ciudad.trim() || undefined,
        });
        proveedorId = Number(proveedor.id);
      }

      const cantidad = Math.max(1, parseInt(form.cantidad || '0', 10) || 0);
      const costoUnitario = Number(form.costo_unitario);

      const compra = await Api.crearCompra({
        proveedor_id: proveedorId,
        fecha: new Date().toISOString(),
        moneda: 'ARS',
        detalle: [
          {
            producto_id: Number(form.producto_id),
            cantidad,
            costo_unitario: costoUnitario,
            costo_envio: 0,
          },
        ],
      });

      await Api.recibirCompra(Number(compra.id), {
        observaciones: form.notas || undefined,
      });

      setForm(initialForm);
      setSavedDraft(true);
      setTimeout(() => setSavedDraft(false), 2500);

      await Promise.all([loadProductos(), loadCompras()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar la compra');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
        Compra de productos
      </h2>

      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4 space-y-4">
        {!canManagePurchases && (
          <Alert
            kind="warning"
            message="No tienes permisos para crear o recibir compras. Solo los usuarios con rol admin o gerente pueden registrar compras."
          />
        )}
        {error && (
          <Alert kind="error" message={error} />
        )}

        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start"
        >
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-200">
              Seleccionar producto
            </div>
            <select
              className="input-modern text-sm w-full"
              disabled={loadingProductos}
              value={form.producto_id}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  producto_id: e.target.value ? Number(e.target.value) : '',
                }))
              }
            >
              <option value="">Elegir producto…</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{' '}
                  {p.category_name ? `(${p.category_name})` : ''}{' '}
                  {`- Stock: ${p.stock_quantity}`}
                </option>
              ))}
            </select>

            {selectedProducto && (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 space-y-1">
                <div className="font-semibold">
                  {selectedProducto.name}{' '}
                  {selectedProducto.category_name
                    ? `(${selectedProducto.category_name})`
                    : ''}
                </div>
                <div>Stock actual: {selectedProducto.stock_quantity}</div>
                <div>
                  Precio referencia venta: ${selectedProducto.price.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-200">
              Datos de proveedor
            </div>
            <select
              className="input-modern text-sm w-full mb-2"
              disabled={loadingProveedores}
              value={form.proveedor_id || ''}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  setForm((prev) => ({
                    ...prev,
                    proveedor_id: '',
                    proveedor_nombre: '',
                    proveedor_ciudad: '',
                    proveedor_telefono: '',
                  }));
                  return;
                }
                const id = Number(value);
                const prov = proveedores.find((p) => p.id === id);
                setForm((prev) => ({
                  ...prev,
                  proveedor_id: id,
                  proveedor_nombre: prov?.nombre ?? prev.proveedor_nombre,
                  proveedor_ciudad: prov?.direccion ?? prev.proveedor_ciudad,
                  proveedor_telefono: prov?.telefono ?? prev.proveedor_telefono,
                }));
              }}
            >
              <option value="">
                Nuevo proveedor...
              </option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                  {p.direccion ? ` - ${p.direccion}` : ''}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                className="input-modern text-sm"
                placeholder="Nombre del proveedor"
                value={form.proveedor_nombre}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, proveedor_nombre: e.target.value }))
                }
              />
              <input
                className="input-modern text-sm"
                placeholder="País / Ciudad"
                value={form.proveedor_ciudad}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, proveedor_ciudad: e.target.value }))
                }
              />
              <input
                className="input-modern text-sm"
                placeholder="Teléfono"
                value={form.proveedor_telefono}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    proveedor_telefono: e.target.value,
                  }))
                }
              />
              <input
                className="input-modern text-sm"
                type="number"
                min={1}
                placeholder="Cantidad a comprar"
                value={form.cantidad}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, cantidad: e.target.value }))
                }
              />
              <input
                className="input-modern text-sm"
                type="number"
                step="0.01"
                min={0}
                placeholder="Costo unitario"
                value={form.costo_unitario}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, costo_unitario: e.target.value }))
                }
              />
            </div>
            <textarea
              className="input-modern text-sm h-20"
              placeholder="Notas (opcional)"
              value={form.notas}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notas: e.target.value }))
              }
            />

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded border border-white/10 bg-white/5 text-xs text-slate-200 hover:bg-white/10"
                onClick={() => {
                  if (submitting) return;
                  setForm(initialForm);
                  setSavedDraft(false);
                }}
              >
                Limpiar
              </button>
              <button
                type="submit"
                disabled={!canSubmitNow}
                className={[
                  'px-4 py-1.5 rounded text-sm font-medium',
                  canSubmitNow
                    ? 'bg-emerald-500/80 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                    : 'bg-emerald-500/30 text-emerald-100 cursor-not-allowed',
                ].join(' ')}
              >
                {submitting ? 'Guardando compra…' : 'Registrar compra'}
              </button>
            </div>
            {savedDraft && (
              <div className="text-xs text-emerald-300">
                Compra registrada correctamente y stock actualizado.
              </div>
            )}
          </div>
        </form>

        <div className="border-t border-white/10 pt-4 space-y-2">
          <div className="text-sm font-medium text-slate-200">
            Historial de compras
          </div>
          {loadingCompras ? (
            <div className="text-xs text-slate-400 py-2">
              Cargando historial de compras...
            </div>
          ) : compras.length === 0 ? (
            <div className="text-xs text-slate-400 py-2">
              Sin compras registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="py-1 pr-2">ID</th>
                    <th className="py-1 pr-2">Fecha</th>
                    <th className="py-1 pr-2">Proveedor</th>
                    <th className="py-1 pr-2">Total</th>
                    <th className="py-1 pr-2">Moneda</th>
                    <th className="py-1 pr-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {compras.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="py-1 pr-2">{c.id}</td>
                      <td className="py-1 pr-2">
                        {c.fecha ? new Date(c.fecha).toLocaleString() : '-'}
                      </td>
                      <td className="py-1 pr-2">{c.proveedor_nombre}</td>
                      <td className="py-1 pr-2">
                        ${Number(c.total_costo || 0).toFixed(2)}
                      </td>
                      <td className="py-1 pr-2">{c.moneda}</td>
                      <td className="py-1 pr-2 capitalize">{c.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
