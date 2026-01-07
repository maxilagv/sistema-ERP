import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Api } from '../lib/api';
import Alert from '../components/Alert';

type Deposito = {
  id: number;
  nombre: string;
  codigo?: string | null;
  direccion?: string | null;
  activo: boolean;
};

type InventarioRow = {
  producto_id: number;
  codigo: string;
  nombre: string;
  categoria: string;
  cantidad_disponible: number;
  cantidad_reservada: number;
  stock_minimo: number | null;
};

type DepositoForm = {
  nombre: string;
  codigo: string;
  direccion: string;
};

const initialDepositoForm: DepositoForm = {
  nombre: '',
  codigo: '',
  direccion: '',
};

export default function Multideposito() {
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [selectedDepositoId, setSelectedDepositoId] = useState<number | ''>('');
  const [depositoForm, setDepositoForm] = useState<DepositoForm>(initialDepositoForm);
  const [inventario, setInventario] = useState<InventarioRow[]>([]);
  const [loadingDepositos, setLoadingDepositos] = useState(false);
  const [loadingInventario, setLoadingInventario] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ajusteLoading, setAjusteLoading] = useState(false);

  const depositoSeleccionado = useMemo(
    () => depositos.find((d) => d.id === Number(selectedDepositoId)) || null,
    [depositos, selectedDepositoId],
  );

  async function loadDepositos() {
    setLoadingDepositos(true);
    setError(null);
    try {
      const data = await Api.depositos();
      const list: Deposito[] = (data || []).map((d: any) => ({
        id: d.id,
        nombre: d.nombre,
        codigo: d.codigo ?? null,
        direccion: d.direccion ?? null,
        activo: Boolean(d.activo),
      }));
      setDepositos(list);
      if (!selectedDepositoId && list.length > 0) {
        setSelectedDepositoId(list[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los depósitos');
    } finally {
      setLoadingDepositos(false);
    }
  }

  async function loadInventario(depositoId: number) {
    setLoadingInventario(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('deposito_id', String(depositoId));
      const data = await Api.inventarioDeposito(depositoId);
      const rows: InventarioRow[] = (data || []).map((r: any) => ({
        producto_id: r.producto_id,
        codigo: r.codigo,
        nombre: r.nombre,
        categoria: r.categoria,
        cantidad_disponible: Number(r.cantidad_disponible ?? 0),
        cantidad_reservada: Number(r.cantidad_reservada ?? 0),
        stock_minimo: typeof r.stock_minimo === 'number' ? r.stock_minimo : null,
      }));
      setInventario(rows);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo cargar el inventario por depósito',
      );
    } finally {
      setLoadingInventario(false);
    }
  }

  useEffect(() => {
    loadDepositos();
  }, []);

  useEffect(() => {
    if (selectedDepositoId) {
      loadInventario(Number(selectedDepositoId));
    } else {
      setInventario([]);
    }
  }, [selectedDepositoId]);

  async function onSubmitDeposito(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!depositoForm.nombre.trim()) {
      setError('El nombre del depósito es obligatorio');
      return;
    }
    try {
      await Api.crearDeposito({
        nombre: depositoForm.nombre.trim(),
        codigo: depositoForm.codigo.trim() || undefined,
        direccion: depositoForm.direccion.trim() || undefined,
      });
      setDepositoForm(initialDepositoForm);
      setSuccess('Depósito creado correctamente');
      await loadDepositos();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo crear el depósito',
      );
    }
  }

  async function aplicarAjuste(
    productoId: number,
    delta: number,
  ) {
    if (!selectedDepositoId) return;
    if (!Number.isFinite(delta) || delta === 0) return;
    setAjusteLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await Api.ajustarInventario({
        producto_id: productoId,
        cantidad: delta,
        motivo: 'ajuste multidepósito',
        referencia: `DEP ${selectedDepositoId}`,
        deposito_id: Number(selectedDepositoId),
      });
      await loadInventario(Number(selectedDepositoId));
      setSuccess('Ajuste aplicado correctamente');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo aplicar el ajuste',
      );
    } finally {
      setAjusteLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
        Multidepósito
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4 space-y-3">
          <div className="text-sm font-medium text-slate-200">
            Depósitos
          </div>
          {error && <Alert kind="error" message={error} />}
          {success && <Alert kind="info" message={success} />}
          <form onSubmit={onSubmitDeposito} className="space-y-2">
            <input
              className="input-modern text-sm w-full"
              placeholder="Nombre del depósito"
              value={depositoForm.nombre}
              onChange={(e) =>
                setDepositoForm((prev) => ({
                  ...prev,
                  nombre: e.target.value,
                }))
              }
            />
            <input
              className="input-modern text-sm w-full"
              placeholder="Código (opcional)"
              value={depositoForm.codigo}
              onChange={(e) =>
                setDepositoForm((prev) => ({
                  ...prev,
                  codigo: e.target.value,
                }))
              }
            />
            <input
              className="input-modern text-sm w-full"
              placeholder="Dirección (opcional)"
              value={depositoForm.direccion}
              onChange={(e) =>
                setDepositoForm((prev) => ({
                  ...prev,
                  direccion: e.target.value,
                }))
              }
            />
            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-primary-500 text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loadingDepositos}
            >
              Crear depósito
            </button>
          </form>

          <div className="mt-3">
            <div className="text-xs text-slate-400 mb-1">
              Depósitos existentes
            </div>
            {loadingDepositos ? (
              <div className="text-xs text-slate-400">Cargando depósitos...</div>
            ) : !depositos.length ? (
              <div className="text-xs text-slate-400">
                Aún no hay depósitos creados.
              </div>
            ) : (
              <ul className="text-xs text-slate-200 space-y-1">
                {depositos.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <button
                      type="button"
                      className={[
                        'flex-1 text-left px-2 py-1 rounded',
                        d.id === selectedDepositoId
                          ? 'bg-primary-500/30 text-primary-50'
                          : 'bg-white/5 hover:bg-white/10',
                      ].join(' ')}
                      onClick={() => setSelectedDepositoId(d.id)}
                    >
                      <div className="truncate">
                        {d.nombre}
                        {d.codigo ? ` (${d.codigo})` : ''}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-200">
                Stock por depósito
              </div>
              <div className="text-xs text-slate-400">
                Ajusta el stock disponible por sucursal para cada producto.
              </div>
            </div>
            <div>
              <select
                className="input-modern text-sm"
                value={selectedDepositoId === '' ? '' : String(selectedDepositoId)}
                onChange={(e) =>
                  setSelectedDepositoId(
                    e.target.value ? Number(e.target.value) : '',
                  )
                }
              >
                {depositos.length === 0 && (
                  <option value="">Sin depósitos</option>
                )}
                {depositos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                    {d.codigo ? ` (${d.codigo})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!selectedDepositoId ? (
            <div className="text-xs text-slate-400 py-4">
              Crea y selecciona un depósito para ver y ajustar su stock.
            </div>
          ) : loadingInventario ? (
            <div className="text-xs text-slate-400 py-4">
              Cargando inventario...
            </div>
          ) : !inventario.length ? (
            <div className="text-xs text-slate-400 py-4">
              Sin productos registrados para este depósito.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="py-1 pr-2">Código</th>
                    <th className="py-1 pr-2">Producto</th>
                    <th className="py-1 pr-2">Categoría</th>
                    <th className="py-1 pr-2 text-right">Disponible</th>
                    <th className="py-1 pr-2 text-right">Reservado</th>
                    <th className="py-1 pr-2 text-right">Ajustar</th>
                  </tr>
                </thead>
                <tbody className="text-slate-200">
                  {inventario.map((row) => (
                    <tr
                      key={row.producto_id}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="py-1 pr-2 text-xs">{row.codigo}</td>
                      <td className="py-1 pr-2">{row.nombre}</td>
                      <td className="py-1 pr-2 text-xs">{row.categoria}</td>
                      <td className="py-1 pr-2 text-right">
                        {row.cantidad_disponible}
                      </td>
                      <td className="py-1 pr-2 text-right">
                        {row.cantidad_reservada}
                      </td>
                      <td className="py-1 pr-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 text-[11px]"
                            disabled={ajusteLoading}
                            onClick={() => aplicarAjuste(row.producto_id, 1)}
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 text-[11px]"
                            disabled={ajusteLoading}
                            onClick={() => aplicarAjuste(row.producto_id, 5)}
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-100 text-[11px]"
                            disabled={ajusteLoading || row.cantidad_disponible <= 0}
                            onClick={() => aplicarAjuste(row.producto_id, -1)}
                          >
                            -1
                          </button>
                        </div>
                      </td>
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

